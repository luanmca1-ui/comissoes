import { randomUUID } from 'node:crypto';
import { requireUser } from './auth.js';
import {
  appendValues,
  ensureSheetWithHeader,
  getValues,
  updateValues,
} from './sheetsClient.js';

const TABLES = {
  CAD_UNIDADES: ['id', 'nome', 'ativo', 'createdAt', 'updatedAt'],
  CAD_PROFISSIONAIS: ['id', 'unidade_id', 'nome', 'pct', 'chave_pix', 'ativo', 'createdAt', 'updatedAt'],
  MOV_DIARIO: ['id', 'unidade_id', 'dataISO', 'dinheiro', 'pix', 'debito', 'credito', 'outros', 'obs', 'deleted', 'createdAt', 'updatedAt'],
  MOV_SAIDAS: ['id', 'mov_diario_id', 'tipo', 'forma', 'valor', 'obs', 'deleted', 'createdAt', 'updatedAt'],
  MOV_PROF: ['id', 'unidade_id', 'dataISO', 'prof_id', 'faturado', 'vales', 'descontos', 'pct', 'comissao', 'saldo', 'deleted', 'createdAt', 'updatedAt'],
  PAGAMENTOS: ['id', 'unidade_id', 'semanaInicioISO', 'semanaFimISO', 'prof_id', 'a_vista', 'pix', 'status', 'deleted', 'createdAt', 'updatedAt'],
  LOG: ['timestampISO', 'user_email', 'action', 'entity', 'entity_id', 'field', 'old_value', 'new_value'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'sim';
}

function isDeleted(row) {
  return toBool(row.deleted);
}

function nowISO() {
  return new Date().toISOString();
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function actionFrom(event, body) {
  return event.queryStringParameters?.action || body.action;
}

async function ensureSchema() {
  for (const [sheet, header] of Object.entries(TABLES)) {
    await ensureSheetWithHeader(sheet, header);
  }
}

async function readSheetObjects(sheetName, fallbackHeader) {
  const values = await getValues(`${sheetName}!A:ZZ`);
  if (!values.length) {
    return { headers: fallbackHeader, rows: [] };
  }

  const headers = values[0].length ? values[0] : fallbackHeader;
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    return obj;
  });

  return { headers, rows };
}

async function writeSheetObjects(sheetName, headers, rows) {
  const values = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  await updateValues(`${sheetName}!A1`, values);
}

function diffLogs({ logs, userEmail, action, entity, entityId, oldObj = {}, newObj = {} }) {
  const timestampISO = nowISO();

  if (action === 'CREATE') {
    Object.keys(newObj).forEach((field) => {
      logs.push([timestampISO, userEmail, action, entity, entityId, field, '', String(newObj[field] ?? '')]);
    });
    return;
  }

  if (action === 'DELETE') {
    Object.keys(oldObj).forEach((field) => {
      logs.push([timestampISO, userEmail, action, entity, entityId, field, String(oldObj[field] ?? ''), '']);
    });
    return;
  }

  const fields = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  fields.forEach((field) => {
    const oldValue = String(oldObj[field] ?? '');
    const newValue = String(newObj[field] ?? '');
    if (oldValue !== newValue) {
      logs.push([timestampISO, userEmail, action, entity, entityId, field, oldValue, newValue]);
    }
  });
}

async function flushLogs(logRows) {
  if (!logRows.length) return;
  await appendValues('LOG!A:H', logRows);
}

function sortByDateAsc(a, b) {
  return String(a.dataISO).localeCompare(String(b.dataISO));
}

async function handleCadList(params = {}) {
  const { rows: units } = await readSheetObjects('CAD_UNIDADES', TABLES.CAD_UNIDADES);
  const { rows: profs } = await readSheetObjects('CAD_PROFISSIONAIS', TABLES.CAD_PROFISSIONAIS);

  const unidadeFilter = params.unidade_id || null;
  const onlyActive = params.onlyActive !== false;

  const filteredUnits = units.filter((u) => (onlyActive ? toBool(u.ativo) : true));
  const filteredProfs = profs.filter((p) => {
    const activeOk = onlyActive ? toBool(p.ativo) : true;
    const unitOk = unidadeFilter ? p.unidade_id === unidadeFilter : true;
    return activeOk && unitOk;
  });

  return { unidades: filteredUnits, profissionais: filteredProfs };
}

async function handleCadUpsertUnit(params, userEmail) {
  const logs = [];
  const { headers, rows } = await readSheetObjects('CAD_UNIDADES', TABLES.CAD_UNIDADES);
  const timestamp = nowISO();

  let current = null;
  if (params.id) {
    current = rows.find((r) => r.id === params.id) || null;
  }

  if (!current) {
    const created = {
      id: params.id || randomUUID(),
      nome: String(params.nome || '').trim(),
      ativo: String(params.ativo ?? true),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    rows.push(created);
    diffLogs({ logs, userEmail, action: 'CREATE', entity: 'CAD_UNIDADES', entityId: created.id, newObj: created });
    await writeSheetObjects('CAD_UNIDADES', headers, rows);
    await flushLogs(logs);
    return { unidade: created };
  }

  const updated = {
    ...current,
    nome: String(params.nome ?? current.nome).trim(),
    ativo: String(params.ativo ?? current.ativo),
    updatedAt: timestamp,
  };

  const idx = rows.findIndex((r) => r.id === current.id);
  rows[idx] = updated;

  diffLogs({ logs, userEmail, action: 'UPDATE', entity: 'CAD_UNIDADES', entityId: updated.id, oldObj: current, newObj: updated });
  await writeSheetObjects('CAD_UNIDADES', headers, rows);
  await flushLogs(logs);
  return { unidade: updated };
}

async function handleCadUpsertProf(params, userEmail) {
  const logs = [];
  const { headers, rows } = await readSheetObjects('CAD_PROFISSIONAIS', TABLES.CAD_PROFISSIONAIS);
  const timestamp = nowISO();

  let current = null;
  if (params.id) {
    current = rows.find((r) => r.id === params.id) || null;
  }

  if (!current) {
    const created = {
      id: params.id || randomUUID(),
      unidade_id: String(params.unidade_id || ''),
      nome: String(params.nome || '').trim(),
      pct: String(toNumber(params.pct || params.pct_comissao || 0)),
      chave_pix: String(params.chave_pix || ''),
      ativo: String(params.ativo ?? true),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    rows.push(created);
    diffLogs({ logs, userEmail, action: 'CREATE', entity: 'CAD_PROFISSIONAIS', entityId: created.id, newObj: created });
    await writeSheetObjects('CAD_PROFISSIONAIS', headers, rows);
    await flushLogs(logs);
    return { profissional: created };
  }

  const updated = {
    ...current,
    unidade_id: String(params.unidade_id ?? current.unidade_id),
    nome: String(params.nome ?? current.nome).trim(),
    pct: String(toNumber(params.pct ?? params.pct_comissao ?? current.pct)),
    chave_pix: String(params.chave_pix ?? current.chave_pix),
    ativo: String(params.ativo ?? current.ativo),
    updatedAt: timestamp,
  };

  const idx = rows.findIndex((r) => r.id === current.id);
  rows[idx] = updated;

  diffLogs({ logs, userEmail, action: 'UPDATE', entity: 'CAD_PROFISSIONAIS', entityId: updated.id, oldObj: current, newObj: updated });
  await writeSheetObjects('CAD_PROFISSIONAIS', headers, rows);
  await flushLogs(logs);
  return { profissional: updated };
}

async function handleGetDay(params) {
  const unidade_id = String(params.unidade_id || '');
  const dataISO = String(params.dataISO || '');

  const { rows: diarioRows } = await readSheetObjects('MOV_DIARIO', TABLES.MOV_DIARIO);
  const day = diarioRows.find((r) => !isDeleted(r) && r.unidade_id === unidade_id && r.dataISO === dataISO) || null;

  if (!day) {
    return {
      dia: null,
      saidas: [],
      profissionais: [],
    };
  }

  const { rows: saidasRows } = await readSheetObjects('MOV_SAIDAS', TABLES.MOV_SAIDAS);
  const { rows: profRows } = await readSheetObjects('MOV_PROF', TABLES.MOV_PROF);

  const saidas = saidasRows.filter((s) => !isDeleted(s) && s.mov_diario_id === day.id);
  const profissionais = profRows.filter((p) => !isDeleted(p) && p.unidade_id === unidade_id && p.dataISO === dataISO);

  return { dia: day, saidas, profissionais };
}

async function handleUpsertDay(params, userEmail) {
  const logs = [];
  const timestamp = nowISO();
  const unidade_id = String(params.unidade_id || '');
  const dataISO = String(params.dataISO || '');
  const entradas = params.entradas || {};
  const saidasIn = Array.isArray(params.saidas) ? params.saidas : [];
  const profsIn = Array.isArray(params.profissionais) ? params.profissionais : [];

  const diarioData = await readSheetObjects('MOV_DIARIO', TABLES.MOV_DIARIO);
  const saidasData = await readSheetObjects('MOV_SAIDAS', TABLES.MOV_SAIDAS);
  const profData = await readSheetObjects('MOV_PROF', TABLES.MOV_PROF);

  let day = diarioData.rows.find((r) => !isDeleted(r) && r.unidade_id === unidade_id && r.dataISO === dataISO) || null;

  if (!day) {
    day = {
      id: randomUUID(),
      unidade_id,
      dataISO,
      dinheiro: String(toNumber(entradas.dinheiro)),
      pix: String(toNumber(entradas.pix)),
      debito: String(toNumber(entradas.debito)),
      credito: String(toNumber(entradas.credito)),
      outros: String(toNumber(entradas.outros)),
      obs: String(params.obs || ''),
      deleted: 'false',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    diarioData.rows.push(day);
    diffLogs({ logs, userEmail, action: 'CREATE', entity: 'MOV_DIARIO', entityId: day.id, newObj: day });
  } else {
    const updated = {
      ...day,
      dinheiro: String(toNumber(entradas.dinheiro)),
      pix: String(toNumber(entradas.pix)),
      debito: String(toNumber(entradas.debito)),
      credito: String(toNumber(entradas.credito)),
      outros: String(toNumber(entradas.outros)),
      obs: String(params.obs ?? day.obs),
      deleted: 'false',
      updatedAt: timestamp,
    };
    const idx = diarioData.rows.findIndex((r) => r.id === day.id);
    diarioData.rows[idx] = updated;
    diffLogs({ logs, userEmail, action: 'UPDATE', entity: 'MOV_DIARIO', entityId: day.id, oldObj: day, newObj: updated });
    day = updated;
  }

  const activeSaidas = saidasData.rows.filter((r) => !isDeleted(r) && r.mov_diario_id === day.id);
  activeSaidas.forEach((oldRow) => {
    const idx = saidasData.rows.findIndex((r) => r.id === oldRow.id);
    const deletedRow = { ...oldRow, deleted: 'true', updatedAt: timestamp };
    saidasData.rows[idx] = deletedRow;
    diffLogs({ logs, userEmail, action: 'DELETE', entity: 'MOV_SAIDAS', entityId: oldRow.id, oldObj: oldRow, newObj: deletedRow });
  });

  saidasIn.forEach((row) => {
    const created = {
      id: randomUUID(),
      mov_diario_id: day.id,
      tipo: String(row.tipo || ''),
      forma: String(row.forma || ''),
      valor: String(toNumber(row.valor)),
      obs: String(row.obs || ''),
      deleted: 'false',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    saidasData.rows.push(created);
    diffLogs({ logs, userEmail, action: 'CREATE', entity: 'MOV_SAIDAS', entityId: created.id, newObj: created });
  });

  const activeProfRows = profData.rows.filter((r) => !isDeleted(r) && r.unidade_id === unidade_id && r.dataISO === dataISO);
  const activeProfMap = new Map(activeProfRows.map((r) => [r.prof_id, r]));
  const sentProfIds = new Set();

  profsIn.forEach((row) => {
    const prof_id = String(row.prof_id || '');
    if (!prof_id) return;
    sentProfIds.add(prof_id);

    const pct = toNumber(row.pct);
    const faturado = toNumber(row.faturado);
    const vales = toNumber(row.vales);
    const descontos = toNumber(row.descontos);
    const comissao = faturado * pct;
    const saldo = comissao - vales - descontos;

    const normalized = {
      unidade_id,
      dataISO,
      prof_id,
      faturado: String(faturado),
      vales: String(vales),
      descontos: String(descontos),
      pct: String(pct),
      comissao: String(comissao),
      saldo: String(saldo),
      deleted: 'false',
      updatedAt: timestamp,
    };

    const current = activeProfMap.get(prof_id);
    if (!current) {
      const created = {
        id: randomUUID(),
        createdAt: timestamp,
        ...normalized,
      };
      profData.rows.push(created);
      diffLogs({ logs, userEmail, action: 'CREATE', entity: 'MOV_PROF', entityId: created.id, newObj: created });
      return;
    }

    const updated = {
      ...current,
      ...normalized,
    };
    const idx = profData.rows.findIndex((r) => r.id === current.id);
    profData.rows[idx] = updated;
    diffLogs({ logs, userEmail, action: 'UPDATE', entity: 'MOV_PROF', entityId: updated.id, oldObj: current, newObj: updated });
  });

  activeProfRows
    .filter((row) => !sentProfIds.has(row.prof_id))
    .forEach((oldRow) => {
      const idx = profData.rows.findIndex((r) => r.id === oldRow.id);
      const deletedRow = { ...oldRow, deleted: 'true', updatedAt: timestamp };
      profData.rows[idx] = deletedRow;
      diffLogs({ logs, userEmail, action: 'DELETE', entity: 'MOV_PROF', entityId: oldRow.id, oldObj: oldRow, newObj: deletedRow });
    });

  await writeSheetObjects('MOV_DIARIO', diarioData.headers, diarioData.rows);
  await writeSheetObjects('MOV_SAIDAS', saidasData.headers, saidasData.rows);
  await writeSheetObjects('MOV_PROF', profData.headers, profData.rows);
  await flushLogs(logs);

  return { ok: true, mov_diario_id: day.id, logs: logs.length };
}

async function handleGetConsolidated(params) {
  const unidade_id = String(params.unidade_id || '');
  const fromISO = String(params.fromISO || '');
  const toISO = String(params.toISO || '');

  const dayData = await readSheetObjects('MOV_DIARIO', TABLES.MOV_DIARIO);
  const saidasData = await readSheetObjects('MOV_SAIDAS', TABLES.MOV_SAIDAS);
  const profData = await readSheetObjects('MOV_PROF', TABLES.MOV_PROF);
  const profCad = await readSheetObjects('CAD_PROFISSIONAIS', TABLES.CAD_PROFISSIONAIS);

  const days = dayData.rows
    .filter((d) => !isDeleted(d) && d.unidade_id === unidade_id && d.dataISO >= fromISO && d.dataISO <= toISO)
    .sort(sortByDateAsc);

  const dayIdToDate = new Map(days.map((d) => [d.id, d.dataISO]));
  const saidas = saidasData.rows.filter((s) => !isDeleted(s) && dayIdToDate.has(s.mov_diario_id));
  const profRows = profData.rows.filter((p) => !isDeleted(p) && p.unidade_id === unidade_id && p.dataISO >= fromISO && p.dataISO <= toISO);

  const entradas = {
    dinheiro: 0,
    pix: 0,
    debito: 0,
    credito: 0,
    outros: 0,
  };

  days.forEach((d) => {
    entradas.dinheiro += toNumber(d.dinheiro);
    entradas.pix += toNumber(d.pix);
    entradas.debito += toNumber(d.debito);
    entradas.credito += toNumber(d.credito);
    entradas.outros += toNumber(d.outros);
  });

  const totalEntradas = entradas.dinheiro + entradas.pix + entradas.debito + entradas.credito + entradas.outros;
  const totalSaidas = saidas.reduce((sum, s) => sum + toNumber(s.valor), 0);
  const totalFaturado = profRows.reduce((sum, p) => sum + toNumber(p.faturado), 0);
  const totalComissao = profRows.reduce((sum, p) => sum + toNumber(p.comissao), 0);

  const cadById = new Map(profCad.rows.map((p) => [p.id, p]));
  const profAgg = new Map();

  profRows.forEach((row) => {
    const current = profAgg.get(row.prof_id) || {
      prof_id: row.prof_id,
      nome: cadById.get(row.prof_id)?.nome || row.prof_id,
      chave_pix: cadById.get(row.prof_id)?.chave_pix || '',
      faturado: 0,
      comissao: 0,
      vales: 0,
      descontos: 0,
      saldo_a_pagar: 0,
    };

    current.faturado += toNumber(row.faturado);
    current.comissao += toNumber(row.comissao);
    current.vales += toNumber(row.vales);
    current.descontos += toNumber(row.descontos);
    current.saldo_a_pagar += toNumber(row.saldo);
    profAgg.set(row.prof_id, current);
  });

  const saidaPorDia = new Map();
  saidas.forEach((s) => {
    const date = dayIdToDate.get(s.mov_diario_id);
    const curr = saidaPorDia.get(date) || 0;
    saidaPorDia.set(date, curr + toNumber(s.valor));
  });

  const fatPorDia = new Map();
  profRows.forEach((p) => {
    const curr = fatPorDia.get(p.dataISO) || 0;
    fatPorDia.set(p.dataISO, curr + toNumber(p.faturado));
  });

  const detalheDiario = days.map((d) => ({
    dataISO: d.dataISO,
    dinheiro: toNumber(d.dinheiro),
    pix: toNumber(d.pix),
    debito: toNumber(d.debito),
    credito: toNumber(d.credito),
    outros: toNumber(d.outros),
    totalEntradas: toNumber(d.dinheiro) + toNumber(d.pix) + toNumber(d.debito) + toNumber(d.credito) + toNumber(d.outros),
    totalSaidas: saidaPorDia.get(d.dataISO) || 0,
    totalFaturado: fatPorDia.get(d.dataISO) || 0,
  }));

  return {
    periodo: { fromISO, toISO },
    kpis: {
      entradas,
      totalEntradas,
      totalSaidas,
      totalFaturado,
      totalComissao,
    },
    profissionais: Array.from(profAgg.values()),
    detalheDiario,
  };
}

async function handleUpsertPayments(params, userEmail) {
  const logs = [];
  const timestamp = nowISO();
  const unidade_id = String(params.unidade_id || '');
  const semanaInicioISO = String(params.semanaInicioISO || '');
  const semanaFimISO = String(params.semanaFimISO || '');
  const pagamentos = Array.isArray(params.pagamentos) ? params.pagamentos : [];

  const payData = await readSheetObjects('PAGAMENTOS', TABLES.PAGAMENTOS);
  const active = payData.rows.filter(
    (r) =>
      !isDeleted(r) &&
      r.unidade_id === unidade_id &&
      r.semanaInicioISO === semanaInicioISO &&
      r.semanaFimISO === semanaFimISO,
  );

  const activeMap = new Map(active.map((r) => [r.prof_id, r]));
  const sent = new Set();

  pagamentos.forEach((p) => {
    const prof_id = String(p.prof_id || '');
    if (!prof_id) return;
    sent.add(prof_id);

    const normalized = {
      unidade_id,
      semanaInicioISO,
      semanaFimISO,
      prof_id,
      a_vista: String(toNumber(p.a_vista)),
      pix: String(toNumber(p.pix)),
      status: String(p.status || 'Rascunho'),
      deleted: 'false',
      updatedAt: timestamp,
    };

    const current = activeMap.get(prof_id);
    if (!current) {
      const created = {
        id: randomUUID(),
        createdAt: timestamp,
        ...normalized,
      };
      payData.rows.push(created);
      diffLogs({ logs, userEmail, action: 'CREATE', entity: 'PAGAMENTOS', entityId: created.id, newObj: created });
      return;
    }

    const updated = { ...current, ...normalized };
    const idx = payData.rows.findIndex((r) => r.id === current.id);
    payData.rows[idx] = updated;
    diffLogs({ logs, userEmail, action: 'UPDATE', entity: 'PAGAMENTOS', entityId: updated.id, oldObj: current, newObj: updated });
  });

  active
    .filter((r) => !sent.has(r.prof_id))
    .forEach((oldRow) => {
      const idx = payData.rows.findIndex((r) => r.id === oldRow.id);
      const deletedRow = { ...oldRow, deleted: 'true', updatedAt: timestamp };
      payData.rows[idx] = deletedRow;
      diffLogs({ logs, userEmail, action: 'DELETE', entity: 'PAGAMENTOS', entityId: oldRow.id, oldObj: oldRow, newObj: deletedRow });
    });

  await writeSheetObjects('PAGAMENTOS', payData.headers, payData.rows);
  await flushLogs(logs);

  return { ok: true, logs: logs.length };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  const auth = await requireUser(event);
  if (!auth.ok) {
    return json(auth.statusCode, auth.body);
  }

  try {
    await ensureSchema();
    const body = parseBody(event);
    const action = actionFrom(event, body);
    const params = event.httpMethod === 'GET' ? event.queryStringParameters || {} : body;

    if (!action) {
      return json(400, { error: 'action obrigatória.' });
    }

    if (action === 'cadList') {
      return json(200, await handleCadList(params));
    }
    if (action === 'cadUpsertUnit') {
      return json(200, await handleCadUpsertUnit(params, auth.user.email));
    }
    if (action === 'cadUpsertProf') {
      return json(200, await handleCadUpsertProf(params, auth.user.email));
    }
    if (action === 'getDay') {
      return json(200, await handleGetDay(params));
    }
    if (action === 'upsertDay') {
      return json(200, await handleUpsertDay(params, auth.user.email));
    }
    if (action === 'getConsolidated') {
      return json(200, await handleGetConsolidated(params));
    }
    if (action === 'upsertPayments') {
      return json(200, await handleUpsertPayments(params, auth.user.email));
    }

    return json(400, { error: `action inválida: ${action}` });
  } catch (error) {
    return json(500, {
      error: 'Erro interno.',
      detail: error.message,
    });
  }
}