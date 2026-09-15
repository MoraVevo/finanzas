import { html, useState } from '../vendor/preact-standalone.module.js';
import { actividadCuenta } from './actividad-cuenta.js';
import { fmtConMoneda, fmtCompacto, fmtMesLargo, monedaInfo } from './util.js';

const fechaCorta = fecha => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(2, 4)}`;

export default function ActividadBancaria({ cuenta, txs, tasas, cuentas = [], desde, hasta }) {
  const a = actividadCuenta({ cuenta, txs, tasas, desde, hasta });
  const moneda = cuenta.moneda, fmt = n => fmtConMoneda(n, moneda);
  const max = Math.max(1, ...a.periodos.flatMap(p => [p.entra, p.sale]));
  const nombre = id => cuentas.find(c => c.id === id)?.nombre || 'Cuenta no disponible';
  const periodo = p => a.granularidad === 'mes' ? fmtMesLargo(p.desde.slice(0, 7))
    : a.granularidad === 'año' ? p.desde.slice(0, 4)
    : p.desde === p.hasta ? fechaCorta(p.desde) : `${fechaCorta(p.desde)} – ${fechaCorta(p.hasta)}`;
  return html`<section class="actividad-bancaria" aria-label="Actividad bancaria">
    <p class="ab-contexto">Dinero que entra y sale de esta cuenta · ${moneda}<br/>
      ${a.serie.length ? `${fechaCorta(a.inicio)} – ${fechaCorta(a.serie.at(-1).fecha)}` : 'Sin días transcurridos en este período'}</p>
    <div class="stats-grid-3 ab-metricas">
      ${[['Entradas', a.entradas, 'm-ingreso'], ['Salidas', a.salidas, 'm-gasto'], ['Cambio de saldo', a.cambio, '']].map(([titulo, valor, clase]) => html`
        <div class="stat-box"><div class="etq">${titulo}</div><div class=${'val num ' + clase}>${fmt(valor)}</div></div>`)}
    </div>
    <div class="tarjeta">
      <h3>Qué movió tu dinero</h3>
      <dl class="ab-desglose">
        ${[['Ingresos registrados', a.ingresos], ['Transferencias recibidas', a.recibidas], ['Gastos registrados', a.gastos], ['Transferencias enviadas', a.enviadas]].map(([titulo, valor]) => html`
          <div><dt>${titulo}</dt><dd class="num">${fmt(valor)}</dd></div>`)}
      </dl>
      <p class="ab-nota">Entradas = ingresos + transferencias recibidas. Salidas = gastos + transferencias enviadas. Mover dinero entre tus cuentas no es un gasto ni un ingreso global.</p>
      ${!a.movimientos && html`<p class="vacio">Sin movimientos en este período. Puedes elegir otro período arriba.</p>`}
      ${a.contrapartes.length > 0 && html`<details class="ab-transferencias"><summary>Ver origen y destino de las transferencias</summary>
        ${a.contrapartes.map(c => html`<div class="ab-contraparte"><b>${nombre(c.id)}</b>
          ${c.recibidas > 0 && html`<span>Recibido <strong class="num">${fmt(c.recibidas)}</strong></span>`}
          ${c.enviadas > 0 && html`<span>Enviado <strong class="num">${fmt(c.enviadas)}</strong></span>`}
        </div>`)}
      </details>`}
    </div>
    <div class="tarjeta">
      <h3>Entradas y salidas por ${a.granularidad}</h3>
      <p class="ab-nota">Incluye transferencias. El período en curso llega hasta hoy.</p>
      ${a.periodos.map(p => html`<div class="ab-periodo">
        <div class="ab-periodo-titulo">${periodo(p)}</div>
        ${[['Entró', p.entra, 'var(--ingreso)'], ['Salió', p.sale, 'var(--gasto)']].map(([etq, val, color]) => html`
          <div class="ab-barra-etq"><span>${etq}</span><b class="num">${fmt(val)}</b></div>
          <div class="ab-pista" aria-hidden="true"><div style=${{ width: val / max * 100 + '%', background: color }}></div></div>`)}
      </div>`)}
    </div>
    ${a.serie.length > 0 && html`<div class="tarjeta">
      <h3>Evolución del saldo</h3>
      <dl class="ab-desglose">
        <div><dt>Antes del período</dt><dd class="num">${fmt(a.saldoInicial)}</dd></div>
        <div><dt>Al cierre del período</dt><dd class="num">${fmt(a.saldoFinal)}</dd></div>
      </dl>
      <${SaldoDiario} key=${cuenta.id + desde + hasta} datos=${a.serie} moneda=${moneda} />
      <p class="ab-nota">Saldo reconstruido con el saldo inicial y los movimientos registrados. No incluye movimientos programados. Cambiar el saldo inicial modifica este historial.</p>
    </div>`}
  </section>`;
}

function SaldoDiario({ datos, moneda }) {
  const [indice, setIndice] = useState(datos.length - 1);
  const punto = datos[indice];
  const W = 300, H = 180, L = 55, R = 14, T = 20, B = 26;
  const min = Math.min(...datos.map(p => p.balance)), max = Math.max(...datos.map(p => p.balance));
  const margen = Math.max(10 ** monedaInfo(moneda).dec, (max - min) * .12, Math.abs(max) * .02);
  const lo = min - margen, hi = max + margen;
  const x = i => datos.length === 1 ? (L + W - R) / 2 : L + i / (datos.length - 1) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const path = datos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.balance).toFixed(2)}`).join(' ');
  return html`<div class="ab-saldo">
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`Saldo diario en ${moneda}, desde ${fechaCorta(datos[0].fecha)} hasta ${fechaCorta(datos.at(-1).fecha)}`}>
      <text x="0" y="12">${moneda}</text>
      ${[lo, (lo + hi) / 2, hi].map(v => html`<g>
        <line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} stroke="var(--line)" />
        <text x=${L - 6} y=${y(v) + 4} text-anchor="end">${fmtCompacto(v, moneda)}</text>
      </g>`)}
      <path d=${path} stroke="var(--accent)" stroke-width="2" fill="none" stroke-linejoin="round" />
      <circle cx=${x(indice)} cy=${y(punto.balance)} r="4" fill="var(--accent)" />
      <text x=${L} y=${H - 5}>${fechaCorta(datos[0].fecha)}</text>
      ${datos.length > 1 && html`<text x=${W - R} y=${H - 5} text-anchor="end">${fechaCorta(datos.at(-1).fecha)}</text>`}
    </svg>
    <label class="ab-lectura">Consultar saldo diario
      <input type="range" min="0" max=${datos.length - 1} step="1" value=${indice} disabled=${datos.length === 1}
        aria-valuetext=${`${fechaCorta(punto.fecha)}: ${fmtConMoneda(punto.balance, moneda)}`}
        onInput=${e => setIndice(Number(e.target.value))} />
    </label>
    <div class="ab-valor num" aria-live="polite">${fechaCorta(punto.fecha)} · ${fmtConMoneda(punto.balance, moneda)}</div>
  </div>`;
}
