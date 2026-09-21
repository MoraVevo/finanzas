// Ahorro: la historia de una cuenta que crece. Distinta de una corriente:
// aquí importa cuánto has aportado, cuánto has retirado, qué te pagó el
// banco y hacia dónde va la línea — no conciliar gastos del mes.
import { html } from '../vendor/preact-standalone.module.js';
import { actividadCuenta } from './actividad-cuenta.js';
import { historialAhorro, proyeccionAhorro } from './model.js';
import { EncabezadoEstado, FilaEstado, SaldoDiario } from './actividad-bancaria.js';
import { fmtConMoneda, fmtCompacto, fmtMesLargo, sumarMesClave, claveMesActual } from './util.js';

const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesAnio = clave => {
  const t = fmtMesLargo(clave);
  return t.includes(clave.slice(0, 4)) ? t : `${t} ${clave.slice(0, 4)}`;
};
const mesCorto = clave => `${MESES3[+clave.slice(5, 7) - 1]} ${clave.slice(2, 4)}`;

export default function VistaAhorro({ cuenta, txs, tasas, cuentas = [], categorias = [], desde, hasta, onFiltro = null }) {
  const moneda = cuenta.moneda, fmt = n => fmtConMoneda(n, moneda);
  // el período de arriba mueve fichas, evolución y estado de cuenta; la
  // descomposición, la meta y la proyección son de toda la vida de la cuenta
  const a = actividadCuenta({ cuenta, txs, tasas, desde, hasta });
  const proy = proyeccionAhorro({ cuenta, txs, tasas, meses: 12 });
  const aportadoPeriodo = a.recibidas + a.ingresos, retiradoPeriodo = a.enviadas + a.gastos;
  const pctMeta = proy.meta ? Math.min(100, Math.round(proy.saldoHoy / proy.meta * 100)) : null;
  const cumplida = proy.meta && proy.saldoHoy >= proy.meta;
  const nombre = id => cuentas.find(c => c.id === id)?.nombre || 'Cuenta no disponible';
  const catPorId = new Map(categorias.map(c => [c.id, c]));

  return html`<section class="actividad-bancaria" aria-label="Historia del ahorro">
    <p class="ab-contexto">Lo que ha crecido esta cuenta · ${moneda}<br/>
      ${proy.porMes.length ? `guardando desde ${mesAnio(proy.porMes[0].clave)}` : 'aún sin movimientos'}</p>
    <div class="stats-grid-3 ab-metricas">
      <div class="stat-box"><div class="etq">Aportado (período)</div>
        <div class="val num m-ingreso">${fmt(aportadoPeriodo)}</div>
        ${a.ingresos > 0 && html`<div class="etq" style=${{ marginTop: '2px' }}>incluye ${fmt(a.ingresos)} de rendimiento</div>`}</div>
      <div class="stat-box"><div class="etq">Retirado (período)</div>
        <div class="val num m-gasto">${fmt(retiradoPeriodo)}</div></div>
      <div class="stat-box"><div class="etq">Crecimiento (período)</div>
        <div class=${'val num ' + (aportadoPeriodo - retiradoPeriodo >= 0 ? 'm-ingreso' : 'm-gasto')}>
          ${aportadoPeriodo - retiradoPeriodo >= 0 ? '+' : '−'}${fmt(Math.abs(aportadoPeriodo - retiradoPeriodo))}</div></div>
    </div>

    ${proy.meta && html`<div class="tarjeta">
      <h3>Tu meta</h3>
      <div class="num" style=${{ fontSize: '24px', fontWeight: 800 }}>
        ${fmt(proy.saldoHoy)} <span style=${{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>de ${fmt(proy.meta)}</span>
      </div>
      <div class="barra-fila" style=${{ margin: '10px 0 6px' }}>
        <div class="pista" style=${{ height: '10px' }}>
          <div class="lleno" style=${{ width: pctMeta + '%', background: cumplida ? 'var(--ingreso)' : 'var(--accent)' }}></div>
        </div>
      </div>
      <div class="dato-cuenta num">
        ${cumplida
          ? `✓ meta cumplida${proy.saldoHoy > proy.meta ? ` · te sobran ${fmt(proy.saldoHoy - proy.meta)}` : ''}`
          : html`falta ${fmt(proy.meta - proy.saldoHoy)} · ${pctMeta}%`}
      </div>
      ${!cumplida && html`<div class="dato-cuenta" style=${{ marginTop: '2px' }}>
        ${proy.mesesParaMeta != null && proy.mesesParaMeta <= 12
          ? (proy.mesesParaMeta <= 1
            ? 'al ritmo actual, la alcanzás el próximo mes'
            : `al ritmo actual (${fmt(proy.promedio)}/mes), la alcanzás en ${mesAnio(sumarMesClave(claveMesActual(), proy.mesesParaMeta))}`)
          : proy.promedio > 0
            ? 'al ritmo actual tardarías más de un año — súbele a los aportes'
            : 'sin aportes recientes que la muevan'}
      <//>`}
      <div class="dato-cuenta" style=${{ marginTop: '6px', color: 'var(--muted)' }}>La meta se pone al editar la cuenta, en Cuentas.</div>
    <//>`}

    <div class="tarjeta">
      <h3>De dónde sale lo que llevas guardado</h3>
      <${Descomposicion} proy=${proy} fmt=${fmt} />
      ${proy.rendimientos === 0 && html`<p class="ab-nota">
        Cuando el banco te pague interés, registralo como ingreso en esta cuenta: aparecerá aquí y verás cuánto trabaja tu dinero solo.</p>`}
    </div>

    <div class="tarjeta">
      <h3>Constancia mes a mes</h3>
      <div class="dato-cuenta" style=${{ marginBottom: '8px' }}>
        ${proy.racha >= 2 ? `Llevás ${proy.racha} meses seguidos aportando.`
          : proy.racha === 1 ? 'Aportaste este mes.'
          : proy.porMes.length ? 'Este mes aún sin aportes — la constancia es lo que hace crecer la línea.'
          : 'Aporta con una transferencia a esta cuenta y la historia empieza.'}
      </div>
      <${Constancia} meses=${proy.porMes.slice(-12)} fmt=${fmt} />
      <p class="ab-nota">Aportes y retiros de los últimos 12 meses — no cambian con el período de arriba.</p>
    </div>

    ${a.serie.length > 0 && html`<div class="tarjeta">
      <h3>Evolución del saldo</h3>
      <dl class="ab-desglose">
        <div><dt>Antes del período</dt><dd class="num">${fmt(a.saldoInicial)}</dd></div>
        <div><dt>Al cierre del período</dt><dd class="num">${fmt(a.saldoFinal)}</dd></div>
      </dl>
      <${SaldoDiario} key=${cuenta.id + desde + hasta} datos=${a.serie} moneda=${moneda} />
    <//>`}

    <div class="tarjeta">
      <h3>Hacia adelante</h3>
      <${Proyeccion} proy=${proy} fmt=${fmt} moneda=${moneda} />
      <p class="ab-nota">
        ${proy.promedio > 0
          ? `Línea al ritmo de los últimos 6 meses: ${fmt(proy.promedio)} netos por mes. Es hábito, no promesa — un mes grande de gasto la baja.`
          : proy.porMes.length
            ? 'Últimamente la cuenta no crece: sin aportes no hay hacia dónde proyectar.'
            : 'Sin historial aún no hay proyección: registra el primer aporte.'}
      </p>
    </div>

    ${a.estado.length > 0 && html`<div class="tarjeta">
      <${EncabezadoEstado} desde=${desde} hasta=${hasta} onFiltro=${onFiltro} txs=${txs} cuenta=${cuenta} />
      <p class="ab-nota">Del más reciente al más antiguo, con lo que quedó guardado después de cada uno.</p>
      ${[...a.estado].reverse().map(({ tx, delta, balance }) => html`<${FilaEstado}
        key=${tx.id} tx=${tx} delta=${delta} balance=${balance} moneda=${moneda}
        nombreCuenta=${nombre} catPorId=${catPorId} />`)}
      <div class="ab-estado-cierre"><span>Guardado al inicio del período</span><b class="num">${fmt(a.saldoInicial)}</b></div>
    <//>`}
  </section>`;
}

/** Saldo de hoy explicado por partes: semilla + aportes + rendimientos −
 *  retiros. Barras al ancho de la parte más grande, colores por semántica:
 *  verde lo que entra, rojo lo que sale, acento lo que el dinero ganó solo.
 *  Las partes en cero no ocupan fila — menos ruido cuando la cuenta nació
 *  vacía o el banco aún no paga interés. */
function Descomposicion({ proy, fmt }) {
  const semilla = proy.saldoHoy - proy.aportes - proy.rendimientos + proy.retiros;
  const filas = [
    semilla !== 0 && ['Semilla inicial', semilla, 'var(--muted)'],
    proy.aportes !== 0 && ['Aportado por ti', proy.aportes, 'var(--ingreso)'],
    proy.rendimientos !== 0 && ['Rendimientos', proy.rendimientos, 'var(--accent)'],
    proy.retiros !== 0 && ['Retirado', -proy.retiros, 'var(--gasto)'],
  ].filter(Boolean);
  const maxAbs = Math.max(1, ...filas.map(f => Math.abs(f[1])));
  return html`<div>
    ${filas.map(([etq, monto, color]) => html`<div key=${etq} class="barra-fila">
      <div class="info"><span>${etq}</span><span class="num">${monto < 0 ? '−' : ''}${fmt(Math.abs(monto))}</span></div>
      <div class="pista"><div class="lleno" style=${{ width: Math.abs(monto) / maxAbs * 100 + '%', background: color }}></div></div>
    </div>`)}
    <div class="grupo-dia" style=${{ paddingTop: '10px' }}>
      <span class="fecha">Guardado hoy</span>
      <span class="num" style=${{ fontWeight: 800, color: 'var(--accent)' }}>${fmt(proy.saldoHoy)}</span>
    </div>
  </div>`;
}

/** Barras de aportado vs retirado por mes (reusa el lenguaje de la actividad
 *  bancaria: dos pistas por período). */
function Constancia({ meses, fmt }) {
  if (!meses.length) return html`<div class="vacio">Aún sin meses con movimientos.</div>`;
  const max = Math.max(1, ...meses.flatMap(m => [m.aportado, m.retirado]));
  return html`<div>
    ${meses.map(m => html`<div key=${m.clave} class="ab-periodo">
      <div class="ab-periodo-titulo">${mesCorto(m.clave)}</div>
      ${[['Aportó', m.aportado, 'var(--ingreso)'], ['Retiró', m.retirado, 'var(--gasto)']].map(([etq, val, color]) => html`
        <div class="ab-barra-etq"><span>${etq}</span><b class="num">${fmt(val)}</b></div>
        <div class="ab-pista" aria-hidden="true"><div style=${{ width: val / max * 100 + '%', background: color }}></div></div>`)}
    </div>`)}
  </div>`;
}

/** Línea de la cuenta hacia adelante: sólida hoy, punteada en el futuro. Si
 *  hay meta y el ritmo la alcanza, la línea se corta al cruzarla y marca el
 *  mes; si no la alcanza en 12 meses, se dibuja el año completo. */
function Proyeccion({ proy, fmt, moneda }) {
  // la línea se corta al cruzar la meta solo si el cruce cae dentro del año
  // dibujado; si la meta queda más lejos, se muestra el año completo
  const cortaEnMeta = proy.mesesParaMeta != null && proy.mesesParaMeta < proy.serie.length;
  const datos = cortaEnMeta ? proy.serie.slice(0, proy.mesesParaMeta + 1) : proy.serie;
  if (datos.length < 2) return html`<div class="vacio">Sin historial para proyectar.</div>`;
  const W = 300, H = 170, L = 55, R = 14, T = 14, B = 26;
  const valores = datos.map(d => d.balance).concat(proy.meta ? [proy.meta] : []);
  const min = Math.min(...valores), max = Math.max(...valores);
  const margen = Math.max((max - min) * .12, 100);
  const lo = min - margen, hi = max + margen;
  const x = i => L + i / (datos.length - 1) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const path = datos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.balance).toFixed(2)}`).join(' ');
  const cruce = datos.length > 1 ? datos[datos.length - 1] : null;
  return html`<div class="ab-saldo">
    <svg viewBox=${`0 0 ${W} ${H}`} role="img"
      aria-label=${`Saldo proyectado de ${fmt(datos[0].balance)} a ${fmt(cruce.balance)} en ${mesCorto(cruce.clave)}`}>
      <defs><linearGradient id="grad-meta" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--ingreso)"/></linearGradient></defs>
      ${[lo, (lo + hi) / 2, hi].map(v => html`<g>
        <line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} stroke="var(--line)" />
        <text x=${L - 6} y=${y(v) + 4} text-anchor="end">${fmtCompacto(v, moneda)}</text>
      </g>`)}
      ${proy.meta && html`<g>
        <line x1=${L} x2=${W - R} y1=${y(proy.meta)} y2=${y(proy.meta)} stroke="var(--ingreso)" stroke-dasharray="3 5" />
        <text x=${W - R} y=${y(proy.meta) - 5} text-anchor="end" fill="var(--ingreso)">meta</text>
      </g>`}
      <path d=${path} stroke="url(#grad-meta)" stroke-width="2" fill="none" stroke-linejoin="round" stroke-dasharray="5 4" />
      <circle cx=${x(0)} cy=${y(datos[0].balance)} r="4" fill="var(--accent)" />
      <text x=${x(0) + 6} y=${y(datos[0].balance) - 7}>hoy</text>
      ${cortaEnMeta && html`<g>
        <circle cx=${x(datos.length - 1)} cy=${y(cruce.balance)} r="4.5" fill="var(--ingreso)" />
        <text x=${x(datos.length - 1)} y=${y(cruce.balance) + 16} text-anchor="middle">${mesCorto(cruce.clave)}</text>
      </g>`}
      ${!cortaEnMeta && html`<text x=${W - R} y=${H - 5} text-anchor="end">${mesCorto(datos[datos.length - 1].clave)}</text>`}
    </svg>
  </div>`;
}
