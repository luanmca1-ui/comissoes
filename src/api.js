async function getToken() {
  const identity = window.netlifyIdentity;
  const user = identity?.currentUser();
  if (!user) {
    throw new Error('Usuário não autenticado.');
  }
  return user.jwt();
}

async function request(action, payload = {}) {
  const token = await getToken();
  const response = await fetch('/.netlify/functions/sheets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Falha na API');
  }
  return data;
}

export function getDay(unidade_id, dataISO) {
  return request('getDay', { unidade_id, dataISO });
}

export function upsertDay(payload) {
  return request('upsertDay', payload);
}

export function getConsolidated(unidade_id, fromISO, toISO) {
  return request('getConsolidated', { unidade_id, fromISO, toISO });
}

export function upsertPayments(payload) {
  return request('upsertPayments', payload);
}

export function cadList({ unidade_id = '', onlyActive = false } = {}) {
  return request('cadList', { unidade_id, onlyActive });
}

export function cadUpsertUnit(payload) {
  return request('cadUpsertUnit', payload);
}

export function cadUpsertProf(payload) {
  return request('cadUpsertProf', payload);
}