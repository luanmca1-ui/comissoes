import { getWeekBounds, todayISO } from './dates.js';

const week = getWeekBounds();

export const state = {
  user: null,
  loading: false,
  error: '',
  activeTab: 'dia',
  selectedUnidade: '',
  selectedDate: todayISO(),
  weekFrom: week.fromISO,
  weekTo: week.toISO,
  unidades: [],
  profissionais: [],
  dayData: {
    entradas: {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      outros: 0,
    },
    obs: '',
    saidas: [],
    profissionais: [],
  },
  consolidated: null,
  payments: [],
  messages: {
    dia: '',
    semana: '',
    pagamentos: '',
  },
};

export function setState(patch) {
  Object.assign(state, patch);
}

export function setError(message) {
  state.error = message || '';
}
