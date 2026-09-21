import { html, useState } from '../vendor/preact-standalone.module.js';
import { actividadCuenta } from './actividad-cuenta.js';
import { nav } from './store.js';
import { IconoCat } from './iconos.js';
import { fmtConMoneda, fmtCompacto, fmtMesLargo, monedaInfo, rangoMes, sumarMesClave, claveMesActual, isoDia } from './util.js';

const fechaCorta = fecha => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(2, 4)}`;
const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const p2 = n => String(n).padStart(2, '0');

/** Ciclos de facturación de una tarjeta: ventanas [inicio, fin) que arrancan en
 *  el día de corte y terminan el día antes del siguiente corte. Del ciclo que
 *  contiene el primer movimiento al ciclo abierto de hoy — lo mismo que el
 *  banco llama "estado del ciclo". */
export function ciclosTarjeta(cuenta, txs, hoyD = isoDia()) {
  const corteDia = Math.max(1, Math.min(28, parseInt(cuenta.corte, 10) || 1));
  const diasMes = (y, m) => new Date(y, m, 0).getDate();
  const corteISO = (y, m) => {
    const d = Math.min(corteDia, diasMes(y, m));
    return `${y}-${p2(m)}-${p2(d)}T00:00`;
  };
  const inicioDe = fecha => {
    const d = new Date(fecha.slice(0, 10) + 'T12:00');
    const corteEsteMes = Math.min(corteDia, diasMes(d.getFullYear(), d.getMonth() + 1));
    return d.getDate() >= corteEsteMes
      ? corteISO(d.getFullYear(), d.getMonth() + 1)
      : (() => { const m = d.getMonth() /* 0-based */; const [y2, m2] = m === 0 ? [d.getFullYear() - 1, 12] : [d.getFullYear(), m]; return corteISO(y2, m2); })();
  };
  const siguiente = iso => {
    const d = new Date(iso);
    return d.getMonth() === 11 ? corteISO(d.getFullYear() + 1, 1) : corteISO(d.getFullYear(), d.getMonth() + 2);
  };
  const primera = txs.reduce((m, t) => {
    if (t.eliminada || (t.cuenta !== cuenta.id && t.cuentaDestino !== cuenta.id)) return m;
    const f = t.fecha.slice(0, 10) + 'T00:00';
    return (!m || f < m) ? f : m;
  }, null);
  if (!primera) return [];
  const ultimo = inicioDe(hoyD);
  const ciclos = [];
  for (let c = inicioDe(primera); c <= ultimo; c = siguiente(c)) ciclos.push(c);
  return ciclos.map((inicio, i) => ({
    inicio,
    fin: ciclos[i + 1] || siguiente(inicio),
    abierto: i === ciclos.length - 1 && inicio === ultimo,
  }));
}

/** Estado de cuenta de TARJETA por ciclo de facturación: cargos, abonos y la
 *  deuda después de cada movimiento — para conciliar con el estado del banco. */
export function EstadoTarjeta({ cuenta, txs, tasas, cuentas = [], categorias = [] }) {
  const ciclos = ciclosTarjeta(cuenta, txs);
  const [sel, setSel] = useState(null); // inicio del ciclo elegido; null = el abierto
  if (!ciclos.length) return null;
  const ciclo = ciclos.find(c => c.inicio === sel) || ciclos[ciclos.length - 1];
  const a = actividadCuenta({ cuenta, txs, tasas, desde: ciclo.inicio, hasta: ciclo.fin });
  const fmt = n => fmtConMoneda(n, cuenta.moneda);
  const cargos = a.gastos + a.enviadas, abonos = a.ingresos + a.recibidas;
  const catPorId = new Map(categorias.map(c => [c.id, c]));
  const nombre = id => cuentas.find(c => c.id === id)?.nombre || 'Cuenta no disponible';
  const etiqueta = c => {
    const i = new Date(c.inicio), f = new Date(+new Date(c.fin) - 86400000);
    const trozo = `${i.getDate()} ${MESES3[i.getMonth()]} – ${f.getDate()} ${MESES3[f.getMonth()]}`;
    return c.abierto ? `${trozo} · en curso` : trozo;
  };
  return html`<div class="tarjeta">
    <div class="ab-estado-encabezado">
      <h3>Estado de cuenta</h3>
      <select class="ab-mes" value=${ciclo.inicio} aria-label="Ciclo del estado de cuenta"
        onChange=${e => setSel(e.target.value)}>
        ${[...ciclos].reverse().map(c => html`<option key=${c.inicio} value=${c.inicio}>Ciclo ${etiqueta(c)}</option>`)}
      </select>
    </div>
    <p class="ab-nota">Lo que cargaste y abonaste en el ciclo, con la deuda después de cada movimiento. Toca una fila para corregirla.</p>
    <dl class="ab-desglose">
      <div><dt>Cargos del ciclo</dt><dd class="num m-gasto">${fmt(cargos)}</dd></div>
      <div><dt>Abonos (pagos)</dt><dd class="num m-ingreso">${fmt(abonos)}</dd></div>
      <div><dt>Deuda al cierre</dt><dd class="num">${fmt(Math.max(0, -a.saldoFinal))}</dd></div>
    </dl>
    ${[...a.estado].reverse().map(({ tx, delta, balance }) => {
      const contraparte = cuentas.find(c => c.id === (delta >= 0 ? tx.cuenta : tx.cuentaDestino));
      return html`<${FilaEstado}
        key=${tx.id} tx=${tx} delta=${delta} balance=${balance} moneda=${cuenta.moneda}
        nombreCuenta=${nombre} catPorId=${catPorId} modoSaldo="deuda"
        esPagoDeuda=${delta < 0 && !!contraparte && (contraparte.tipo === 'tarjeta' || contraparte.tipo === 'deuda')} />`;
    })}
    ${a.estado.length === 0 && html`<p class="vacio">Sin movimientos en este ciclo.</p>`}
    <div class="ab-estado-cierre"><span>Deuda al inicio del ciclo</span><b class="num">${fmt(Math.max(0, -a.saldoInicial))}</b></div>
  </div>`;
}

export default function ActividadBancaria({ cuenta, txs, tasas, cuentas = [], categorias = [], desde, hasta, onFiltro = null }) {
  const a = actividadCuenta({ cuenta, txs, tasas, desde, hasta });
  const moneda = cuenta.moneda, fmt = n => fmtConMoneda(n, moneda);
  const max = Math.max(1, ...a.periodos.flatMap(p => [p.entra, p.sale]));
  const maxCat = Math.max(1, ...a.gastosPorCategoria.map(c => c.monto));
  const nombre = id => cuentas.find(c => c.id === id)?.nombre || 'Cuenta no disponible';
  const catPorId = new Map(categorias.map(c => [c.id, c]));
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
      <p class="ab-nota">Entradas = ingresos + transferencias recibidas; salidas = gastos + transferencias enviadas.</p>
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
    ${a.gastosPorCategoria.length > 0 && html`<div class="tarjeta">
      <h3>Gastos del período</h3>
      <p class="ab-nota">Solo lo gastado desde esta cuenta: las transferencias no cuentan aquí.</p>
      ${a.gastosPorCategoria.map(c => html`<div key=${c.categoria || '_sin'} class="barra-fila">
        <div class="info">
          <span>${c.categoria
            ? html`<${IconoCat} icono=${catPorId.get(c.categoria)?.icono} emoji=${catPorId.get(c.categoria)?.emoji} /> ${catPorId.get(c.categoria)?.nombre || 'Categoría'}`
            : 'Sin categoría'}</span>
          <span class="num">${fmt(c.monto)} · ${Math.round(c.monto / a.gastos * 100)}%</span>
        </div>
        <div class="pista"><div class="lleno" style=${{ width: (c.monto / maxCat * 100) + '%', background: 'var(--gasto)' }}></div></div>
      </div>`)}
    </div>`}
    ${a.serie.length > 0 && html`<div class="tarjeta">
      <h3>Evolución del saldo</h3>
      <dl class="ab-desglose">
        <div><dt>Antes del período</dt><dd class="num">${fmt(a.saldoInicial)}</dd></div>
        <div><dt>Al cierre del período</dt><dd class="num">${fmt(a.saldoFinal)}</dd></div>
      </dl>
      <${SaldoDiario} key=${cuenta.id + desde + hasta} datos=${a.serie} moneda=${moneda} />
      <p class="ab-nota">Saldo reconstruido con el saldo inicial y tus movimientos; cambiar el saldo inicial reescribe este historial.</p>
    </div>`}
    ${a.estado.length > 0 && html`<div class="tarjeta">
      <${EncabezadoEstado} desde=${desde} hasta=${hasta} onFiltro=${onFiltro} txs=${txs} cuenta=${cuenta} />
      <p class="ab-nota">Cada fila muestra el saldo que quedó después. Toca para corregir.</p>
      ${[...a.estado].reverse().map(({ tx, delta, balance }) => {
        const contraparte = cuentas.find(c => c.id === (delta >= 0 ? tx.cuenta : tx.cuentaDestino));
        return html`<${FilaEstado}
          key=${tx.id} tx=${tx} delta=${delta} balance=${balance} moneda=${moneda}
          nombreCuenta=${nombre} catPorId=${catPorId}
          esPagoDeuda=${delta < 0 && !!contraparte && (contraparte.tipo === 'tarjeta' || contraparte.tipo === 'deuda')} />`;
      })}
      <div class="ab-estado-cierre"><span>Saldo al inicio del período</span><b class="num">${fmt(a.saldoInicial)}</b></div>
    </div>`}
  </section>`;
}

/** Encabezado del estado de cuenta con el menú de meses: elegir uno cambia el
 *  período de TODA la vista (métricas, gráficas y filas) a ese mes, igual que
 *  pides el estado de un mes a tu banco. La lista arranca en el primer
 *  movimiento de la cuenta — antes de eso no hay nada que conciliar. */
export function EncabezadoEstado({ desde, hasta, onFiltro, txs, cuenta }) {
  if (!onFiltro) return html`<h3>Estado de cuenta</h3>`;
  const actual = claveMesActual();
  const primerMes = txs.reduce((m, t) => {
    if (t.cuenta !== cuenta.id && t.cuentaDestino !== cuenta.id) return m;
    const d = t.fecha.slice(0, 7);
    return (!m || d < m) ? d : m;
  }, null);
  const meses = [];
  for (let c = (primerMes && primerMes < actual) ? primerMes : actual; c <= actual; c = sumarMesClave(c, 1)) meses.push(c);
  // el período es un solo mes natural cuando arranca el 1 y termina el 1 siguiente
  const claveDesde = desde.slice(0, 7);
  const esMesUnico = desde.slice(8, 10) === '01' && rangoMes(claveDesde)[1] === hasta;
  const mesSel = esMesUnico ? claveDesde : '';
  const etiqueta = c => {
    const t = fmtMesLargo(c);
    return t.includes(c.slice(0, 4)) ? t : `${t} ${c.slice(0, 4)}`;
  };
  const elegir = clave => {
    if (clave) onFiltro(rangoMes(clave));
  };
  return html`<div class="ab-estado-encabezado">
    <h3>Estado de cuenta</h3>
    <select class="ab-mes" value=${mesSel} aria-label="Mes del estado de cuenta"
      onChange=${e => elegir(e.target.value)}>
      ${!mesSel && html`<option value="">Elige un mes</option>`}
      ${[...meses].reverse().map(c => html`<option key=${c} value=${c}>${etiqueta(c)}</option>`)}
    </select>
  </div>`;
}

/** Fila del estado de cuenta: concepto + monto con signo + saldo resultante.
 *  Rojo salió, verde entró: es lo que uno espera leer en un banco. En tarjetas
 *  (modoSaldo="deuda") la línea final lee la deuda acumulada, no el saldo. */
export function FilaEstado({ tx, delta, balance, moneda, nombreCuenta, catPorId, esPagoDeuda, modoSaldo = 'queda' }) {
  const entra = delta >= 0;
  const cat = catPorId.get(tx.categoria);
  let concepto, sub;
  if (tx.tipo === 'transferencia') {
    const contraparte = nombreCuenta(entra ? tx.cuenta : tx.cuentaDestino);
    concepto = esPagoDeuda ? `Pago de deuda · ${contraparte}` : (entra ? `De ${contraparte}` : `A ${contraparte}`);
    sub = esPagoDeuda ? 'Pago de deuda' : 'Transferencia';
  } else {
    concepto = tx.motivo || cat?.nombre || (tx.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
    sub = tx.motivo && cat ? cat.nombre : null;
  }
  return html`<button class="ab-estado-fila" onClick=${() => nav('#/agregar?id=' + tx.id)}>
    <span class="ab-estado-fecha num">${fechaCorta(tx.fecha)}</span>
    <span class="ab-estado-cuerpo">
      <span class="ab-estado-titulo">${concepto}</span>
      ${sub && html`<span class="ab-estado-sub">${sub}</span>`}
    </span>
    <span class="ab-estado-montos">
      <b class=${'num ' + (entra ? 'm-ingreso' : 'm-gasto')}>${entra ? '+' : '−'}${fmtConMoneda(Math.abs(delta), moneda)}</b>
      <span class="ab-estado-saldo num">${modoSaldo === 'deuda'
        ? (balance < 0 ? `deuda ${fmtConMoneda(-balance, moneda)}` : `a favor ${fmtConMoneda(balance, moneda)}`)
        : `queda ${fmtConMoneda(balance, moneda)}`}</span>
    </span>
  </button>`;
}

export function SaldoDiario({ datos, moneda }) {
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
