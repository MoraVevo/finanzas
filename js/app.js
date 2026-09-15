// Punto de entrada: arranque, enrutado por hash, barra de pestañas, botón + y toast.
import { html, render, useEffect, Component } from '../vendor/preact-standalone.module.js';
import fin from './db.js';
import { useStore, recargar, nav, getState } from './store.js';
import { fijosPendientes, cuotasPendientes } from './model.js';
import { uid, isoDia } from './util.js';
import { ICONOS_TAB } from './iconos.js';
import Onboarding from './screens/onboarding.js';
import Hoy from './screens/hoy.js';
import Agregar from './screens/agregar.js';
import Movimientos from './screens/movimientos.js';
import Estadisticas from './screens/estadisticas.js';
import Cuentas from './screens/cuentas.js';
import Ajustes from './screens/ajustes.js';

/* Barrera de errores: si una pantalla falla al renderizar, se muestra un aviso
   local y el resto de la app (pestañas, captura) sigue funcionando. */
class Guarda extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) {
    if (prev.remane !== this.props.remane && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return html`<div class="vista"><div class="tarjeta" style=${{ textAlign: 'center', marginTop: '40px' }}>
        <div style=${{ fontSize: '40px' }}>😅</div>
        <h3>Esta pantalla falló, pero la app sigue viva</h3>
        <div class="dato-cuenta" style=${{ marginBottom: '12px' }}>${String(this.state.error?.message || this.state.error)}</div>
        <button class="btn btn-primario" onClick=${() => this.setState({ error: null })}>Reintentar</button>
      <//><//>`;
    }
    return this.props.children;
  }
}

/* ---------- arranque ---------- */
(async () => {
  await fin.inicial();
  await recargar();
  // Fijos con impacto real (ingreso → cuenta destino, gasto → fuente): el día
  // que llegan se vuelven transacción real (08:00) — dinero en el saldo, no
  // solo en las proyecciones. Las cuotas pagan solas: transferencia de la
  // cuenta elegida a la tarjeta/deuda. Si ya lo registraste a mano, no duplica.
  const S0 = getState();
  const materializables = f => f.activa !== false && ((f.tipo === 'ingreso' && f.cuenta) || (f.tipo === 'gasto' && f.fuente));
  const cuotasActivas = p => p.activa !== false && p.pagaCon && p.cuentaId;
  if (S0.ajustes?.iniciado && ((S0.fijos || []).some(materializables) || (S0.cuotas || []).some(cuotasActivas))) {
    const hoy = isoDia();
    const todas = await fin.todasTx();
    const pend = fijosPendientes({ fijos: S0.fijos, txs: todas, hoyD: hoy });
    for (const { fijo, fecha } of pend) {
      await fin.guardarTx({
        id: uid(), tipo: fijo.tipo, monto: fijo.monto, moneda: fijo.moneda,
        cuenta: fijo.tipo === 'ingreso' ? fijo.cuenta : fijo.fuente,
        cuentaDestino: null, categoria: null, etiquetas: [],
        motivo: fijo.nombre || (fijo.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo'),
        fijoId: fijo.id,
        fecha: fecha + 'T08:00', adjuntos: [], eliminada: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    const cuotasPend = cuotasPendientes({ cuotas: S0.cuotas, txs: todas, hoyD: hoy });
    for (const { plan, fecha, monto } of cuotasPend) {
      await fin.guardarTx({
        id: uid(), tipo: 'transferencia', monto, moneda: plan.moneda,
        cuenta: plan.pagaCon, cuentaDestino: plan.cuentaId, montoDestino: null,
        categoria: null, etiquetas: [],
        motivo: 'Cuota ' + (plan.nombre || 'plan'), fijoId: plan.id,
        fecha: fecha + 'T08:00', adjuntos: [], eliminada: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    // ventana procesada (aunque no hubiera nada pendiente): una ocurrencia
    // borrada a mano no vuelve a crearse
    for (const f of S0.fijos) {
      if (materializables(f) && f.materializadoHasta !== hoy) {
        await fin.guardarFijo({ ...f, materializadoHasta: hoy });
      }
    }
    for (const p of S0.cuotas) {
      if (cuotasActivas(p) && p.materializadoHasta !== hoy) {
        await fin.guardarCuota({ ...p, materializadoHasta: hoy });
      }
    }
    if (pend.length + cuotasPend.length > 0) await recargar();
  }
  if (!location.hash) location.hash = '#/';
  render(html`<${App} />`, document.getElementById('app'));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

/* ---------- router ---------- */
function App() {
  const S = useStore();

  useEffect(() => {
    // primera visita => onboarding
    if (S.listo && !S.ajustes.iniciado && S.route !== '#/onboarding') nav('#/onboarding');
  }, [S.listo, S.ajustes.iniciado]);

  if (!S.listo) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '90px' }}>Cargando…</div></div>`;
  if (!S.ajustes.iniciado) return html`<div class="vista sin-tab"><${Onboarding} /></div>`;

  const [ruta, query] = S.route.split('?');
  const params = new URLSearchParams(query || '');
  const esAgregar = ruta === '#/agregar' || ruta === '#/agregar/';

  let pantalla;
  switch (ruta) {
    case '#/movimientos': pantalla = html`<${Movimientos} />`; break;
    case '#/estadisticas': pantalla = html`<${Estadisticas} />`; break;
    case '#/cuentas': pantalla = html`<${Cuentas} />`; break;
    case '#/ajustes': pantalla = html`<${Ajustes} />`; break;
    case '#/onboarding': pantalla = html`<${Onboarding} />`; break;
    default: pantalla = html`<${Hoy} />`;
  }
  pantalla = html`<${Guarda} remane=${S.route}>${pantalla}<//>`;

  if (esAgregar) {
    return html`<div class="vista sin-tab" style=${{ padding: 0 }}>
      <${Agregar} key=${params.get('id') || 'nueva'} txId=${params.get('id')} />
      ${S.toast && html`<div class="toast">${S.toast}</div>`}
    <//>`;
  }

// Iconos de la barra en js/iconos.js. Sin texto: solo icono (evita mezclar
// español/inglés en las etiquetas) + aria-label para accesibilidad.
const tabs = [
  ['#/', 'inicio', 'Inicio'],
  ['#/movimientos', 'movs', 'Movs'],
  [null, null, ''],
  ['#/estadisticas', 'stats', 'Stats'],
  ['#/cuentas', 'cuentas', 'Cuentas'],
];

  return html`<div>
    ${pantalla}
    <button class="fab" aria-label="Agregar transacción" onClick=${() => nav('#/agregar')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5.2v13.6M5.2 12h13.6" />
      </svg>
    </button>
    <nav class="tabbar">
      ${tabs.map(([hash, ico, nom]) => hash
        ? html`<button key=${nom} aria-label=${nom} class=${'tab' + (S.route === hash ? ' activa' : '')} onClick=${() => nav(hash)}>
            <span class="ico">${ICONOS_TAB[ico]}</span>
          </button>`
        : html`<span key="fab" class="espacio-fab"></span>`)}
    </nav>
    ${S.toast && html`<div class="toast">${S.toast}</div>`}
  </div>`;
}
