// Punto de entrada: arranque, enrutado por hash, barra de pestañas, botón + y toast.
import { html, render, useEffect, Component } from '../vendor/preact-standalone.module.js';
import fin from './db.js';
import { useStore, recargar, nav } from './store.js';
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
