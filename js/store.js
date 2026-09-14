// Store mínimo global (pub/sub) + hook de Preact para suscribirse.
import { useState, useEffect } from '../vendor/preact-standalone.module.js';
import fin from './db.js';

let state = {
  listo: false,
  route: location.hash || '#/',
  routeAnterior: '#/',
  toast: null,
  cuentas: [], categorias: [], etiquetas: [], presupuestos: [], tasas: [], futuros: [], fijos: [], cuotas: [],
  ajustes: { monedaPrincipal: 'GTQ', iniciado: false },
};
const subs = new Set();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...patch };
  subs.forEach(f => f());
}
export function useStore() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump(x => x + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return state;
}

export function nav(hash) {
  if (hash === state.route) return;
  setState({ routeAnterior: state.route });
  location.hash = hash;
}
window.addEventListener('hashchange', () => setState({ route: location.hash || '#/' }));

/** Recarga los catálogos desde IndexedDB al store en memoria. */
export async function recargar() {
  const [cuentas, categorias, etiquetas, presupuestos, tasas, futuros, fijos, cuotas, ajustes] = await Promise.all([
    fin.cuentas(), fin.categorias(), fin.etiquetas(), fin.presupuestos(), fin.tasas(), fin.futuros(), fin.fijos(),
    fin.cuotas(), fin.getAjuste('app', { monedaPrincipal: 'GTQ', iniciado: false }),
  ]);
  setState({ cuentas, categorias, etiquetas, presupuestos, tasas, futuros, fijos, cuotas, ajustes, listo: true });
}

let timerToast = null;
export function toast(msj) {
  setState({ toast: msj });
  clearTimeout(timerToast);
  timerToast = setTimeout(() => setState({ toast: null }), 2400);
}
