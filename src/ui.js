import {
  cadList,
  cadUpsertProf,
  cadUpsertUnit,
  getConsolidated,
  getDay,
  upsertDay,
  upsertPayments,
} from './api.js';
import { formatMoney, toNumber } from './money.js';
import { setError, setState, state } from './state.js';

let rootEl;

function unidadeOptions(selected) {
  return state.unidades
    .map((u) => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${u.nome}</option>`)
    .join('');
}

function statusOptions(value) {
  const opts = ['Rascunho', 'Aguardando aprovação', 'Aprovado', 'Pago'];
  return opts.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('');
}

function activeProfsByUnit() {
  return state.profissionais.filter((p) => p.unidade_id === state.selectedUnidade && String(p.ativo) === 'true');
}

function ensureDayProfRows() {
  const byId = new Map((state.dayData.profissionais || []).map((p) => [p.prof_id, p]));
  state.dayData.profissionais = activeProfsByUnit().map((p) => {
    const current = byId.get(p.id);
    const faturado = toNumber(current?.faturado);
    const vales = toNumber(current?.vales);
    const descontos = toNumber(current?.descontos);
    const pct = toNumber(current?.pct ?? p.pct);
    const comissao = faturado * pct;
    const saldo = comissao - vales - descontos;

    return {
      prof_id: p.id,
      nome: p.nome,
      pct,
      faturado,
      vales,
      descontos,
      comissao,
      saldo,
    };
  });
}

function totalEntradasDia() {
  const e = state.dayData.entradas;
  return toNumber(e.dinheiro) + toNumber(e.pix) + toNumber(e.debito) + toNumber(e.credito) + toNumber(e.outros);
}

function totalFaturadoDia() {
  return (state.dayData.profissionais || []).reduce((sum, p) => sum + toNumber(p.faturado), 0);
}

function dayWhatsappText() {
  const e = state.dayData.entradas;
  const saidasTotal = (state.dayData.saidas || []).reduce((sum, s) => sum + toNumber(s.valor), 0);
  const lines = [];
  lines.push(`*Resumo do Dia* ${state.selectedDate}`);
  lines.push(`Unidade: ${state.unidades.find((u) => u.id === state.selectedUnidade)?.nome || state.selectedUnidade}`);
  lines.push('');
  lines.push(`Entradas: ${formatMoney(totalEntradasDia())}`);
  lines.push(`- Dinheiro: ${formatMoney(e.dinheiro)}`);
  lines.push(`- PIX: ${formatMoney(e.pix)}`);
  lines.push(`- Débito: ${formatMoney(e.debito)}`);
  lines.push(`- Crédito: ${formatMoney(e.credito)}`);
  lines.push(`- Outros: ${formatMoney(e.outros)}`);
  lines.push(`Saídas: ${formatMoney(saidasTotal)}`);
  lines.push('');
  lines.push('*Profissionais*');
  state.dayData.profissionais.forEach((p) => {
    lines.push(`${p.nome}: faturado ${formatMoney(p.faturado)} | comissão ${formatMoney(p.comissao)} | saldo ${formatMoney(p.saldo)}`);
  });

  return lines.join('\n');
}

function weekWhatsappText() {
  if (!state.consolidated) return '';
  const { kpis, profissionais } = state.consolidated;
  const lines = [];
  lines.push(`*Consolidado ${state.weekFrom} a ${state.weekTo}*`);
  lines.push(`Entradas: ${formatMoney(kpis.totalEntradas)}`);
  lines.push(`Saídas: ${formatMoney(kpis.totalSaidas)}`);
  lines.push(`Faturado: ${formatMoney(kpis.totalFaturado)}`);
  lines.push(`Comissão: ${formatMoney(kpis.totalComissao)}`);
  lines.push('');
  lines.push('*Profissionais*');
  profissionais.forEach((p) => {
    lines.push(`${p.nome}: saldo ${formatMoney(p.saldo_a_pagar)}`);
  });
  return lines.join('\n');
}

function paymentsApprovalText() {
  const lines = ['*Aprovação PIX*'];
  state.payments
    .filter((p) => toNumber(p.pix) > 0)
    .forEach((p) => {
      lines.push(`${p.nome} | PIX ${formatMoney(p.pix)} | chave: ${p.chave_pix || 'não informada'}`);
    });
  return lines.join('\n');
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
}

function withLoading(run) {
  return async (...args) => {
    try {
      setState({ loading: true });
      setError('');
      redraw();
      await run(...args);
    } catch (error) {
      setError(error.message);
    } finally {
      setState({ loading: false });
      redraw();
    }
  };
}

export async function loadCadastros() {
  const data = await cadList({ onlyActive: false });
  setState({ unidades: data.unidades || [], profissionais: data.profissionais || [] });
  if (!state.selectedUnidade && state.unidades[0]) {
    state.selectedUnidade = state.unidades[0].id;
  }
  ensureDayProfRows();
}

async function handleLoadDay() {
  const data = await getDay(state.selectedUnidade, state.selectedDate);
  if (!data.dia) {
    state.dayData = {
      entradas: { dinheiro: 0, pix: 0, debito: 0, credito: 0, outros: 0 },
      obs: '',
      saidas: [],
      profissionais: [],
    };
    ensureDayProfRows();
    return;
  }

  state.dayData = {
    entradas: {
      dinheiro: toNumber(data.dia.dinheiro),
      pix: toNumber(data.dia.pix),
      debito: toNumber(data.dia.debito),
      credito: toNumber(data.dia.credito),
      outros: toNumber(data.dia.outros),
    },
    obs: data.dia.obs || '',
    saidas: (data.saidas || []).map((s) => ({
      tipo: s.tipo || '',
      forma: s.forma || '',
      valor: toNumber(s.valor),
      obs: s.obs || '',
    })),
    profissionais: (data.profissionais || []).map((p) => ({
      prof_id: p.prof_id,
      nome: state.profissionais.find((x) => x.id === p.prof_id)?.nome || p.prof_id,
      pct: toNumber(p.pct),
      faturado: toNumber(p.faturado),
      vales: toNumber(p.vales),
      descontos: toNumber(p.descontos),
      comissao: toNumber(p.comissao),
      saldo: toNumber(p.saldo),
    })),
  };

  ensureDayProfRows();
}

async function handleSaveDay() {
  ensureDayProfRows();
  await upsertDay({
    unidade_id: state.selectedUnidade,
    dataISO: state.selectedDate,
    entradas: state.dayData.entradas,
    obs: state.dayData.obs,
    saidas: state.dayData.saidas,
    profissionais: state.dayData.profissionais,
  });
}

async function handleLoadConsolidated() {
  state.consolidated = await getConsolidated(state.selectedUnidade, state.weekFrom, state.weekTo);
  state.payments = [];
  state.paymentsKey = '';
}

function ensurePaymentsFromConsolidated() {
  if (!state.consolidated) return;
  const key = `${state.selectedUnidade}|${state.weekFrom}|${state.weekTo}`;
  if (state.paymentsKey === key) return;

  state.payments = state.consolidated.profissionais.map((p) => ({
    prof_id: p.prof_id,
    nome: p.nome,
    chave_pix: p.chave_pix || '',
    saldo_a_pagar: toNumber(p.saldo_a_pagar),
    a_vista: 0,
    pix: Math.max(0, toNumber(p.saldo_a_pagar)),
    status: 'Rascunho',
  }));
  state.paymentsKey = key;
}

async function handleSavePayments() {
  await upsertPayments({
    unidade_id: state.selectedUnidade,
    semanaInicioISO: state.weekFrom,
    semanaFimISO: state.weekTo,
    pagamentos: state.payments,
  });
}

function exportExcel() {
  if (!state.consolidated || !window.XLSX) return;

  const wb = window.XLSX.utils.book_new();

  const resumo = [
    ['Período', `${state.weekFrom} a ${state.weekTo}`],
    ['Total Entradas', state.consolidated.kpis.totalEntradas],
    ['Total Saídas', state.consolidated.kpis.totalSaidas],
    ['Total Faturado', state.consolidated.kpis.totalFaturado],
    ['Total Comissão', state.consolidated.kpis.totalComissao],
  ];

  const profissionais = [
    ['Profissional', 'Faturado', 'Comissão', 'Vales', 'Descontos', 'Saldo a Pagar'],
    ...state.consolidated.profissionais.map((p) => [p.nome, p.faturado, p.comissao, p.vales, p.descontos, p.saldo_a_pagar]),
  ];

  const detalhe = [
    ['Data', 'Dinheiro', 'PIX', 'Débito', 'Crédito', 'Outros', 'Total Entradas', 'Total Saídas', 'Total Faturado'],
    ...state.consolidated.detalheDiario.map((d) => [d.dataISO, d.dinheiro, d.pix, d.debito, d.credito, d.outros, d.totalEntradas, d.totalSaidas, d.totalFaturado]),
  ];

  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(profissionais), 'Profissionais');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(detalhe), 'Detalhe Diário');
  window.XLSX.writeFile(wb, `consolidado_${state.weekFrom}_${state.weekTo}.xlsx`);
}

export function renderTabs() {
  const tabs = [
    { id: 'dia', label: 'Dia' },
    { id: 'consolidado', label: 'Consolidado' },
    { id: 'pagamentos', label: 'Pagamentos' },
    { id: 'cadastros', label: 'Cadastros' },
  ];
  return `
    <div class="tabs">
      ${tabs
        .map(
          (t) => `<button class="tab ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`,
        )
        .join('')}
    </div>
  `;
}

export function renderDaily() {
  ensureDayProfRows();

  const mismatch = Math.abs(totalEntradasDia() - totalFaturadoDia()) > 0.009;

  return `
    <section class="card">
      <h2>Dia</h2>
      <div class="grid cols-3">
        <label>Unidade<select id="dia-unidade">${unidadeOptions(state.selectedUnidade)}</select></label>
        <label>Data<input type="date" id="dia-data" value="${state.selectedDate}" /></label>
        <label>Observação<textarea id="dia-obs">${state.dayData.obs || ''}</textarea></label>
      </div>

      <h3>Entradas</h3>
      <div class="grid cols-5">
        <label>Dinheiro<input type="number" step="0.01" class="entrada" data-field="dinheiro" value="${toNumber(state.dayData.entradas.dinheiro)}" /></label>
        <label>PIX<input type="number" step="0.01" class="entrada" data-field="pix" value="${toNumber(state.dayData.entradas.pix)}" /></label>
        <label>Débito<input type="number" step="0.01" class="entrada" data-field="debito" value="${toNumber(state.dayData.entradas.debito)}" /></label>
        <label>Crédito<input type="number" step="0.01" class="entrada" data-field="credito" value="${toNumber(state.dayData.entradas.credito)}" /></label>
        <label>Outros<input type="number" step="0.01" class="entrada" data-field="outros" value="${toNumber(state.dayData.entradas.outros)}" /></label>
      </div>

      <h3>Saídas</h3>
      <table>
        <thead><tr><th>Tipo</th><th>Forma</th><th>Valor</th><th>Obs</th><th></th></tr></thead>
        <tbody>
          ${state.dayData.saidas
            .map(
              (s, idx) => `
                <tr>
                  <td><input class="saida-input" data-idx="${idx}" data-field="tipo" value="${s.tipo || ''}" /></td>
                  <td><input class="saida-input" data-idx="${idx}" data-field="forma" value="${s.forma || ''}" /></td>
                  <td><input type="number" step="0.01" class="saida-input" data-idx="${idx}" data-field="valor" value="${toNumber(s.valor)}" /></td>
                  <td><input class="saida-input" data-idx="${idx}" data-field="obs" value="${s.obs || ''}" /></td>
                  <td><button data-remove-saida="${idx}">Remover</button></td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
      <button id="add-saida">Adicionar saída</button>

      <h3>Profissionais</h3>
      <table>
        <thead><tr><th>Profissional</th><th>% Comissão</th><th>Faturado</th><th>Vales</th><th>Descontos</th><th>Comissão</th><th>Saldo</th></tr></thead>
        <tbody>
          ${state.dayData.profissionais
            .map(
              (p) => `
              <tr>
                <td>${p.nome}</td>
                <td>${(toNumber(p.pct) * 100).toFixed(2)}%</td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${p.prof_id}" data-field="faturado" value="${toNumber(p.faturado)}" /></td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${p.prof_id}" data-field="vales" value="${toNumber(p.vales)}" /></td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${p.prof_id}" data-field="descontos" value="${toNumber(p.descontos)}" /></td>
                <td>${formatMoney(p.comissao)}</td>
                <td>${formatMoney(p.saldo)}</td>
              </tr>
            `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <span>Total Entradas: ${formatMoney(totalEntradasDia())}</span>
        <span>Total Faturado: ${formatMoney(totalFaturadoDia())}</span>
        ${mismatch ? '<span class="badge">Aviso: Entradas diferente do faturado</span>' : ''}
      </div>

      <div class="actions">
        <button id="btn-carregar-dia">Carregar Dia</button>
        <button id="btn-salvar-dia">Salvar Dia</button>
        <button id="btn-whats-dia">Gerar WhatsApp (Dia)</button>
      </div>

      <textarea id="msg-dia" rows="6" placeholder="Mensagem do dia">${state.messages.dia || ''}</textarea>
      <button id="copy-dia">Copiar</button>
    </section>
  `;
}

export function renderConsolidated() {
  const c = state.consolidated;

  return `
    <section class="card">
      <h2>Consolidado</h2>
      <div class="grid cols-3">
        <label>Unidade<select id="cons-unidade">${unidadeOptions(state.selectedUnidade)}</select></label>
        <label>De<input type="date" id="cons-from" value="${state.weekFrom}" /></label>
        <label>Até<input type="date" id="cons-to" value="${state.weekTo}" /></label>
      </div>

      <div class="actions">
        <button id="btn-carregar-cons">Atualizar Consolidado</button>
        <button id="btn-whats-semana">Gerar WhatsApp (Semana)</button>
        <button id="btn-export-xlsx">Exportar Excel</button>
      </div>

      ${
        c
          ? `
        <div class="kpis">
          <div>Entradas: ${formatMoney(c.kpis.totalEntradas)}</div>
          <div>Saídas: ${formatMoney(c.kpis.totalSaidas)}</div>
          <div>Faturado: ${formatMoney(c.kpis.totalFaturado)}</div>
          <div>Comissão: ${formatMoney(c.kpis.totalComissao)}</div>
        </div>
        <table>
          <thead><tr><th>Profissional</th><th>Faturado</th><th>Comissão</th><th>Vales</th><th>Descontos</th><th>Saldo a pagar</th></tr></thead>
          <tbody>
            ${c.profissionais
              .map(
                (p) => `
                <tr>
                  <td>${p.nome}</td>
                  <td>${formatMoney(p.faturado)}</td>
                  <td>${formatMoney(p.comissao)}</td>
                  <td>${formatMoney(p.vales)}</td>
                  <td>${formatMoney(p.descontos)}</td>
                  <td>${formatMoney(p.saldo_a_pagar)}</td>
                </tr>
              `,
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p>Carregue o consolidado para visualizar os dados.</p>'
      }

      <textarea id="msg-semana" rows="6" placeholder="Mensagem da semana">${state.messages.semana || ''}</textarea>
      <button id="copy-semana">Copiar</button>
    </section>
  `;
}

export function renderPayments() {
  ensurePaymentsFromConsolidated();

  return `
    <section class="card">
      <h2>Pagamentos</h2>
      <p>Baseado no consolidado atual (${state.weekFrom} a ${state.weekTo}).</p>

      <table>
        <thead><tr><th>Profissional</th><th>Saldo a pagar</th><th>À vista</th><th>PIX</th><th>Status</th></tr></thead>
        <tbody>
          ${state.payments
            .map(
              (p, idx) => `
                <tr>
                  <td>${p.nome}</td>
                  <td>${formatMoney(p.saldo_a_pagar)}</td>
                  <td><input type="number" step="0.01" class="pay-avista" data-idx="${idx}" value="${toNumber(p.a_vista)}" /></td>
                  <td><input type="number" step="0.01" class="pay-pix" data-idx="${idx}" value="${toNumber(p.pix)}" /></td>
                  <td><select class="pay-status" data-idx="${idx}">${statusOptions(p.status)}</select></td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="actions">
        <button id="btn-msg-pix">Gerar mensagem Aprovação PIX</button>
        <button id="btn-salvar-pag">Salvar Pagamentos</button>
      </div>

      <textarea id="msg-pag" rows="6">${state.messages.pagamentos || ''}</textarea>
      <button id="copy-pag">Copiar</button>
    </section>
  `;
}

export function renderCadastros() {
  return `
    <section class="card">
      <h2>Cadastros</h2>

      <div class="split">
        <div>
          <h3>Unidades</h3>
          <form id="form-unidade" class="inline-form">
            <input type="hidden" id="unit-id" />
            <input id="unit-nome" placeholder="Nome da unidade" required />
            <label><input type="checkbox" id="unit-ativo" checked /> Ativo</label>
            <button type="submit">Salvar Unidade</button>
          </form>
          <table>
            <thead><tr><th>Nome</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              ${state.unidades
                .map(
                  (u) => `
                    <tr>
                      <td>${u.nome}</td>
                      <td>${String(u.ativo) === 'true' ? 'Sim' : 'Não'}</td>
                      <td><button data-edit-unit="${u.id}">Editar</button></td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Profissionais</h3>
          <form id="form-prof" class="inline-form">
            <input type="hidden" id="prof-id" />
            <select id="prof-unidade" required>${unidadeOptions(state.selectedUnidade)}</select>
            <input id="prof-nome" placeholder="Nome" required />
            <input id="prof-pct" type="number" step="0.01" min="0" max="1" placeholder="Pct (0.5)" required />
            <input id="prof-pix" placeholder="Chave PIX" />
            <label><input type="checkbox" id="prof-ativo" checked /> Ativo</label>
            <button type="submit">Salvar Profissional</button>
          </form>
          <table>
            <thead><tr><th>Nome</th><th>Unidade</th><th>%</th><th>PIX</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              ${state.profissionais
                .filter((p) => p.unidade_id === state.selectedUnidade)
                .map(
                  (p) => `
                    <tr>
                      <td>${p.nome}</td>
                      <td>${state.unidades.find((u) => u.id === p.unidade_id)?.nome || p.unidade_id}</td>
                      <td>${(toNumber(p.pct) * 100).toFixed(2)}%</td>
                      <td>${p.chave_pix || '-'}</td>
                      <td>${String(p.ativo) === 'true' ? 'Sim' : 'Não'}</td>
                      <td><button data-edit-prof="${p.id}">Editar</button></td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderLogin() {
  return `
    <section class="login-screen">
      <div class="login-card">
        <h1>Comissões</h1>
        <p>Faça login para acessar o sistema.</p>
        <button id="btn-login">Entrar</button>
      </div>
    </section>
  `;
}

function renderAppShell() {
  return `
    <div class="container">
      <header>
        <h1>Comissões</h1>
        <div>
          <span>${state.user?.email || ''}</span>
          <button id="btn-reload">Atualizar Cadastros</button>
          <button id="btn-logout">Sair</button>
        </div>
      </header>

      ${renderTabs()}

      ${state.error ? `<p class="error">${state.error}</p>` : ''}
      ${state.loading ? '<p class="loading">Carregando...</p>' : ''}

      <main>
        ${state.activeTab === 'dia' ? renderDaily() : ''}
        ${state.activeTab === 'consolidado' ? renderConsolidated() : ''}
        ${state.activeTab === 'pagamentos' ? renderPayments() : ''}
        ${state.activeTab === 'cadastros' ? renderCadastros() : ''}
      </main>
    </div>
  `;
}

function bindCommonEvents() {
  document.getElementById('btn-login')?.addEventListener('click', () => window.netlifyIdentity?.open('login'));
  document.getElementById('btn-logout')?.addEventListener('click', () => window.netlifyIdentity?.logout());
  document.getElementById('btn-reload')?.addEventListener('click', withLoading(loadCadastros));

  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      state.activeTab = el.getAttribute('data-tab');
      redraw();
    });
  });
}

function bindDailyEvents() {
  document.getElementById('dia-unidade')?.addEventListener('change', (e) => {
    state.selectedUnidade = e.target.value;
    ensureDayProfRows();
    redraw();
  });

  document.getElementById('dia-data')?.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
  });

  document.getElementById('dia-obs')?.addEventListener('input', (e) => {
    state.dayData.obs = e.target.value;
  });

  document.querySelectorAll('.entrada').forEach((el) => {
    el.addEventListener('input', (e) => {
      state.dayData.entradas[e.target.dataset.field] = toNumber(e.target.value);
      redraw();
    });
  });

  document.getElementById('add-saida')?.addEventListener('click', () => {
    state.dayData.saidas.push({ tipo: '', forma: '', valor: 0, obs: '' });
    redraw();
  });

  document.querySelectorAll('[data-remove-saida]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = Number(el.getAttribute('data-remove-saida'));
      state.dayData.saidas.splice(idx, 1);
      redraw();
    });
  });

  document.querySelectorAll('.saida-input').forEach((el) => {
    el.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      state.dayData.saidas[idx][field] = field === 'valor' ? toNumber(e.target.value) : e.target.value;
    });
  });

  document.querySelectorAll('.prof-input').forEach((el) => {
    el.addEventListener('input', (e) => {
      const profId = e.target.dataset.prof;
      const field = e.target.dataset.field;
      const row = state.dayData.profissionais.find((p) => p.prof_id === profId);
      if (!row) return;
      row[field] = toNumber(e.target.value);
      row.comissao = toNumber(row.faturado) * toNumber(row.pct);
      row.saldo = row.comissao - toNumber(row.vales) - toNumber(row.descontos);
      redraw();
    });
  });

  document.getElementById('btn-carregar-dia')?.addEventListener('click', withLoading(handleLoadDay));
  document.getElementById('btn-salvar-dia')?.addEventListener('click', withLoading(handleSaveDay));

  document.getElementById('btn-whats-dia')?.addEventListener('click', () => {
    state.messages.dia = dayWhatsappText();
    redraw();
  });

  document.getElementById('msg-dia')?.addEventListener('input', (e) => {
    state.messages.dia = e.target.value;
  });

  document.getElementById('copy-dia')?.addEventListener('click', () => copyText(state.messages.dia));
}

function bindConsolidatedEvents() {
  document.getElementById('cons-unidade')?.addEventListener('change', (e) => {
    state.selectedUnidade = e.target.value;
  });
  document.getElementById('cons-from')?.addEventListener('change', (e) => {
    state.weekFrom = e.target.value;
  });
  document.getElementById('cons-to')?.addEventListener('change', (e) => {
    state.weekTo = e.target.value;
  });

  document.getElementById('btn-carregar-cons')?.addEventListener('click', withLoading(handleLoadConsolidated));
  document.getElementById('btn-whats-semana')?.addEventListener('click', () => {
    state.messages.semana = weekWhatsappText();
    redraw();
  });
  document.getElementById('btn-export-xlsx')?.addEventListener('click', exportExcel);
  document.getElementById('copy-semana')?.addEventListener('click', () => copyText(state.messages.semana));
  document.getElementById('msg-semana')?.addEventListener('input', (e) => {
    state.messages.semana = e.target.value;
  });
}

function bindPaymentsEvents() {
  document.querySelectorAll('.pay-avista').forEach((el) => {
    el.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const row = state.payments[idx];
      if (!row) return;
      row.a_vista = Math.max(0, toNumber(e.target.value));
      row.pix = Math.max(0, row.saldo_a_pagar - row.a_vista);
      redraw();
    });
  });

  document.querySelectorAll('.pay-pix').forEach((el) => {
    el.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const row = state.payments[idx];
      if (!row) return;
      row.pix = Math.max(0, Math.min(row.saldo_a_pagar, toNumber(e.target.value)));
      row.a_vista = Math.max(0, row.saldo_a_pagar - row.pix);
      redraw();
    });
  });

  document.querySelectorAll('.pay-status').forEach((el) => {
    el.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      const row = state.payments[idx];
      if (!row) return;
      row.status = e.target.value;
    });
  });

  document.getElementById('btn-msg-pix')?.addEventListener('click', () => {
    state.messages.pagamentos = paymentsApprovalText();
    redraw();
  });

  document.getElementById('btn-salvar-pag')?.addEventListener('click', withLoading(handleSavePayments));
  document.getElementById('msg-pag')?.addEventListener('input', (e) => {
    state.messages.pagamentos = e.target.value;
  });
  document.getElementById('copy-pag')?.addEventListener('click', () => copyText(state.messages.pagamentos));
}

function bindCadEvents() {
  document.querySelectorAll('[data-edit-unit]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-edit-unit');
      const unit = state.unidades.find((u) => u.id === id);
      if (!unit) return;
      document.getElementById('unit-id').value = unit.id;
      document.getElementById('unit-nome').value = unit.nome;
      document.getElementById('unit-ativo').checked = String(unit.ativo) === 'true';
    });
  });

  document.querySelectorAll('[data-edit-prof]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-edit-prof');
      const prof = state.profissionais.find((p) => p.id === id);
      if (!prof) return;
      document.getElementById('prof-id').value = prof.id;
      document.getElementById('prof-unidade').value = prof.unidade_id;
      document.getElementById('prof-nome').value = prof.nome;
      document.getElementById('prof-pct').value = toNumber(prof.pct);
      document.getElementById('prof-pix').value = prof.chave_pix || '';
      document.getElementById('prof-ativo').checked = String(prof.ativo) === 'true';
    });
  });

  document.getElementById('form-unidade')?.addEventListener(
    'submit',
    withLoading(async (e) => {
      e.preventDefault();
      await cadUpsertUnit({
        id: document.getElementById('unit-id').value || undefined,
        nome: document.getElementById('unit-nome').value,
        ativo: document.getElementById('unit-ativo').checked,
      });
      e.target.reset();
      await loadCadastros();
    }),
  );

  document.getElementById('form-prof')?.addEventListener(
    'submit',
    withLoading(async (e) => {
      e.preventDefault();
      await cadUpsertProf({
        id: document.getElementById('prof-id').value || undefined,
        unidade_id: document.getElementById('prof-unidade').value,
        nome: document.getElementById('prof-nome').value,
        pct: toNumber(document.getElementById('prof-pct').value),
        chave_pix: document.getElementById('prof-pix').value,
        ativo: document.getElementById('prof-ativo').checked,
      });
      e.target.reset();
      await loadCadastros();
    }),
  );

  document.getElementById('prof-unidade')?.addEventListener('change', (e) => {
    state.selectedUnidade = e.target.value;
    ensureDayProfRows();
    redraw();
  });
}

function bindTabEvents() {
  if (state.activeTab === 'dia') bindDailyEvents();
  if (state.activeTab === 'consolidado') bindConsolidatedEvents();
  if (state.activeTab === 'pagamentos') bindPaymentsEvents();
  if (state.activeTab === 'cadastros') bindCadEvents();
}

export function redraw() {
  if (!rootEl) return;
  rootEl.innerHTML = state.user ? renderAppShell() : renderLogin();
  bindCommonEvents();
  bindTabEvents();
}

export function mountUI(el) {
  rootEl = el;
  redraw();
}