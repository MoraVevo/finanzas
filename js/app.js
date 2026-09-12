// Punto de entrada: arranque, enrutado por hash, barra de pestañas, botón + y toast.
import { html, render, useEffect } from '../vendor/preact-standalone.module.js';
import fin from './db.js';
import { useStore, recargar, nav } from './store.js';
import Onboarding from './screens/onboarding.js';
import Hoy from './screens/hoy.js';
import Agregar from './screens/agregar.js';
import Movimientos from './screens/movimientos.js';
import Estadisticas from './screens/estadisticas.js';
import Cuentas from './screens/cuentas.js';
import Ajustes from './screens/ajustes.js';

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

  if (esAgregar) {
    return html`<div class="vista sin-tab" style=${{ padding: 0 }}>
      <${Agregar} key=${params.get('id') || 'nueva'} txId=${params.get('id')} />
      ${S.toast && html`<div class="toast">${S.toast}</div>`}
    <//>`;
  }

  const tabs = [
    ['#/', '🏠', 'Hoy'],
    ['#/movimientos', '🧾', 'Movs'],
    [null, '＋', ''],
    ['#/estadisticas', '📊', 'Stats'],
    ['#/cuentas', '💳', 'Cuentas'],
  ];

  return html`<div>
    ${pantalla}
    <button class="fab" aria-label="Agregar transacción" onClick=${() => nav('#/agregar')}>＋</button>
    <nav class="tabbar">
      ${tabs.map(([hash, ico, nom]) => hash
        ? html`<button key=${nom} class=${'tab' + (S.route === hash ? ' activa' : '')} onClick=${() => nav(hash)}>
            <span class="ico">${ico}</span>${nom}
          </button>`
        : html`<span key="fab" class="espacio-fab"></span>`)}
    </nav>
    ${S.toast && html`<div class="toast">${S.toast}</div>`}
  </div>`;
}
