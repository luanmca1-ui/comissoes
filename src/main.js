import './styles.css';
import { setError, setState, state } from './state.js';
import { loadCadastros, mountUI, redraw } from './ui.js';

async function bootstrapData() {
  if (!state.user) return;

  try {
    setState({ loading: true });
    setError('');
    redraw();
    await loadCadastros();
  } catch (error) {
    setError(error.message);
  } finally {
    setState({ loading: false });
    redraw();
  }
}

function initIdentity() {
  const identity = window.netlifyIdentity;
  if (!identity) {
    setError('Netlify Identity não carregado.');
    redraw();
    return;
  }

  identity.on('init', async (user) => {
    setState({ user });
    redraw();
    await bootstrapData();
  });

  identity.on('login', async (user) => {
    setState({ user });
    identity.close();
    redraw();
    await bootstrapData();
  });

  identity.on('logout', () => {
    setState({
      user: null,
      unidades: [],
      profissionais: [],
      consolidated: null,
      payments: [],
    });
    redraw();
  });

  identity.on('error', (err) => {
    const detail = err?.message || 'Falha no Netlify Identity.';
    setError(`Erro de autenticação: ${detail}`);
    redraw();
  });

  const siteUrl = import.meta.env.VITE_NETLIFY_SITE_URL;
  if (siteUrl) {
    identity.init({
      APIUrl: `${siteUrl.replace(/\/$/, '')}/.netlify/identity`,
    });
    return;
  }

  identity.init();
}

mountUI(document.getElementById('app'));
initIdentity();
