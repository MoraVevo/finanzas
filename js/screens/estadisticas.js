// Estadísticas: dos vistas — "Resumen" (gasto/ingreso del período que elijas
// con el filtro de fecha: presets o rango personalizado) y "Flujo" (patrimonio
// en el tiempo con los movimientos futuros que el usuario registra manualmente).
// La gráfica de flujo es interactiva: arrastra para mover, pellizca/botones para
// zoom, con granularidad hasta diaria, y lectura al tocar.
import { html, useState, useEffect, useMemo, useRef } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, recargar, toast } from '../store.js';
import { statsRango, tendencia, patrimonio, saldoConvertido, saldoCuenta, flujoEfectivo, fechasRepetir, convertir, estructuraRango, TIPOS_CUENTA, pagosTarjeta, cuotasPorMes, serieSaldos, planCuotas } from '../model.js';
import { Sheet, PickerCuentas, GridCategorias, Segmentado } from '../ui.js';
import { IconoCuenta, IconoCategoria, IconoCat, IconoId, ICONO_ETIQUETA, ICONO_TRANSFER, ICONO_TARJETA } from '../iconos.js';
import ActividadBancaria from '../actividad-bancaria.js';
import { fmtConMoneda, fmtMonto, fmtCompacto, monedaInfo, textoAEntero, enteroATexto, uid, isoDia, isoLocal, fmtMesLargo, deISO, claveMesActual, sumarMesClave, rangoMes } from '../util.js';

const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ---------- Filtro de período ---------- */
const PRESETS_RANGO = [
  ['mes', 'Este mes'],
  ['mes-pasado', 'Mes pasado'],
  ['3m', '3 meses'],
  ['6m', '6 meses'],
  ['anio', 'Este año'],
];

/** Preset -> [desde, hasta) en ISO local (hasta exclusivo). */
function rangoPreset(tipo) {
  const clave = claveMesActual();
  const [dMes, hMes] = rangoMes(clave);
  switch (tipo) {
    case 'mes': return [dMes, hMes];
    case 'mes-pasado': return rangoMes(sumarMesClave(clave, -1));
    case '3m': return [sumarMesClave(clave, -2) + '-01T00:00', hMes];
    case '6m': return [sumarMesClave(clave, -5) + '-01T00:00', hMes];
    case 'anio': return [clave.slice(0, 4) + '-01-01T00:00', hMes];
    default: return [dMes, hMes];
  }
}

const diaDe = iso => iso.slice(0, 10);
/** Último día INCLUSIVO de un rango cuyo 'hasta' es exclusivo. */
const finInclusivo = hasta => isoDia(new Date(+deISO(hasta) - 86400000));
const fmtDiaMes = iso => { const d = deISO(iso); return `${d.getDate()} ${MESES3[d.getMonth()]}`; };

/** Etiqueta corta del período: "septiembre" / "2026" / "1 jul – 30 sep". */
function etiquetaRango(desde, hasta) {
  const d = diaDe(desde), h = finInclusivo(hasta);
  if (d.slice(0, 7) === h.slice(0, 7)) return fmtMesLargo(d.slice(0, 7));
  if (d.endsWith('-01-01') && h.endsWith('-12-31')) return d.slice(0, 4);
  return `${fmtDiaMes(d)} – ${fmtDiaMes(h)}`;
}

/** Serie de gasto del período, agregada por día (≤2 meses), semana (≤2 años)
 *  o mes. Cada punto trae etiqueta de eje, descripción larga y si contiene hoy. */
function serieGasto(desde, hasta, porDia) {
  const mapa = new Map(porDia.map(d => [d.dia, d.monto]));
  const d0 = diaDe(desde), d1 = finInclusivo(hasta);
  const t0 = +new Date(d0 + 'T12:00'), t1 = +new Date(d1 + 'T12:00');
  const dias = Math.round((t1 - t0) / 86400000) + 1;
  const gran = dias <= 60 ? 'dia' : dias <= 730 ? 'semana' : 'mes';
  const hoy = isoDia();
  const contieneHoy = iso => {
    if (gran === 'mes') return hoy.startsWith(iso.slice(0, 7));
    const t = +deISO(hoy), a = +deISO(iso);
    return t >= a && t <= a + (gran === 'semana' ? 6 : 0) * 86400000;
  };
  const datos = [];
  const empuja = (iso, monto) => {
    const d = deISO(iso);
    datos.push({
      iso, monto,
      esHoy: contieneHoy(iso),
      mesNuevo: gran === 'mes' || (gran === 'dia' && d.getDate() === 1),
      etq: gran === 'dia' ? (d.getDate() === 1 ? `1 ${MESES3[d.getMonth()]}` : String(d.getDate()))
        : gran === 'semana' ? `${d.getDate()} ${MESES3[d.getMonth()]}`
        : MESES3[d.getMonth()] + (d.getFullYear() !== +d0.slice(0, 4) ? ' ' + String(d.getFullYear()).slice(2) : ''),
      largo: gran === 'mes' ? `${MESES3[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MESES3[d.getMonth()]} ${d.getFullYear()}`,
    });
  };
  if (gran === 'dia') {
    const cur = new Date(d0 + 'T12:00');
    for (let i = 0; i < dias; i++, cur.setDate(cur.getDate() + 1)) {
      const iso = isoDia(cur);
      empuja(iso, mapa.get(iso) || 0);
    }
  } else if (gran === 'semana') {
    const cur = new Date(d0 + 'T12:00');
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // alinea a lunes
    for (; +cur <= t1; cur.setDate(cur.getDate() + 7)) {
      let monto = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(cur); d.setDate(d.getDate() + i);
        monto += mapa.get(isoDia(d)) || 0;
      }
      empuja(isoDia(cur), monto);
    }
  } else {
    let y = +d0.slice(0, 4), m = +d0.slice(5, 7);
    for (; y < +d1.slice(0, 4) || (y === +d1.slice(0, 4) && m <= +d1.slice(5, 7)); m++) {
      if (m > 12) { m = 1; y++; }
      const pre = `${y}-${String(m).padStart(2, '0')}`;
      let monto = 0;
      for (const [dia, v] of mapa) if (dia.startsWith(pre)) monto += v;
      empuja(pre + '-01', monto);
    }
  }
  return { gran, datos };
}

/** Caja de período: muestra el rango activo y al tocarla abre el selector
 *  (sheet) con los presets como chips y las fechas específicas — así la vista
 *  no queda cargada de chips. */
function CajaFechas({ filtro, onFiltro }) {
  const [abierto, setAbierto] = useState(false);
  const [tmp, setTmp] = useState(null);
  const [desde, hasta] = Array.isArray(filtro) ? filtro : rangoPreset(filtro);
  const abrir = () => {
    setTmp({ desde: diaDe(desde), hasta: diaDe(finInclusivo(hasta)) });
    setAbierto(true);
  };
  const aplicar = () => {
    if (!tmp.desde || !tmp.hasta) { toast('Elige ambas fechas'); return; }
    let a = tmp.desde + 'T00:00', b = tmp.hasta + 'T00:00';
    if (a.slice(0, 10) > b.slice(0, 10)) [a, b] = [b, a];
    b = isoDia(new Date(+deISO(b) + 86400000)) + 'T00:00'; // hasta exclusivo
    onFiltro([a, b]);
    setAbierto(false);
  };
  const elegirPreset = k => { onFiltro(k); setAbierto(false); };
  return html`<div style=${{ marginTop: '10px', marginBottom: '12px' }}>
    <button class="caja-fecha" onClick=${abrir}>
      🗓 ${etiquetaRango(desde, hasta)} <span class="chev">▾</span>
    </button>
    ${abierto && html`<${Sheet} titulo="Elegir período" onClose=${() => setAbierto(false)}>
      <div class="chips-scroll" style=${{ marginBottom: '14px' }}>
        ${PRESETS_RANGO.map(([k, t]) => html`<button key=${k} class=${'chip' + (filtro === k ? ' sel' : '')}
          onClick=${() => elegirPreset(k)}>${t}</button>`)}
      </div>
      <div style=${{ display: 'grid', gap: '10px' }}>
        <div>
          <div class="dato-cuenta" style=${{ marginBottom: '4px' }}>Desde</div>
          <input type="date" value=${tmp.desde} onChange=${e => e.target.value && setTmp({ ...tmp, desde: e.target.value })} />
        </div>
        <div>
          <div class="dato-cuenta" style=${{ marginBottom: '4px' }}>Hasta</div>
          <input type="date" value=${tmp.hasta} onChange=${e => e.target.value && setTmp({ ...tmp, hasta: e.target.value })} />
        </div>
        <button class="btn btn-primario" onClick=${aplicar}>Aplicar</button>
      </div>
    <//>`}
  </div>`;
}

export default function Estadisticas() {
  const S = useStore();
  const [vista, setVista] = useState('resumen');
  const [todo, setTodo] = useState(null); // todas las tx
  const [arrastre, setArrastre] = useState(null); // frac del drag de la vista
  const raizRef = useRef(null);
  const vistaRef = useRef('mes');
  vistaRef.current = vista;

  useEffect(() => {
    let vivo = true;
    fin.todasTx().then(t => vivo && setTodo(t));
    return () => { vivo = false; };
  }, [S.cuentas, S.ajustes, S.futuros]);

  // Deslizar desde cualquier zona sin gesto propio (resúmenes, tarjetas de
  // categorías, encabezado…) también mueve la vista entre "Resumen" y "Flujo
  // y futuro": el contenido sigue al dedo y al soltar, un arrastre decidido
  // cambia de vista. Las zonas con gesto horizontal propio (segmentados,
  // carrusel de la tarjeta, gráfica de flujo, hojas) se excluyen.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    let x0 = null, y0 = null, modo = null;
    const zonaConGesto = '.seg, .tarjeta-carrusel, .flujo-chart, .sheet-fondo, input, select, textarea';
    const ini = e => {
      if (e.touches.length !== 1) return;
      if (e.target.closest?.(zonaConGesto)) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; modo = null;
    };
    const mov = e => {
      if (x0 == null) return;
      if (e.touches.length > 1) { x0 = null; modo = null; setArrastre(null); return; }
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!modo) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) modo = 'h';
        else if (Math.abs(dy) > 12) { x0 = null; return; } // scroll vertical gana
        else return;
      }
      const vw = window.innerWidth || 1;
      let frac = -dx / vw;
      const muerto = vistaRef.current === 'resumen' ? dx > 0 : dx < 0;
      if (muerto) frac *= 0.22; // resistencia al empujar más allá del límite
      setArrastre({ frac: Math.max(-1, Math.min(1, frac)) });
    };
    const fin = e => {
      if (x0 == null) { modo = null; return; }
      const dx = e.changedTouches[0].clientX - x0;
      const fueH = modo === 'h';
      x0 = null; modo = null;
      setArrastre(null);
      if (!fueH) return;
      const umbral = Math.max(60, (window.innerWidth || 1) * 0.16);
      if (vistaRef.current === 'resumen' && dx < -umbral) setVista('flujo');
      else if (vistaRef.current === 'flujo' && dx > umbral) setVista('resumen');
    };
    raiz.addEventListener('touchstart', ini, { passive: true });
    raiz.addEventListener('touchmove', mov, { passive: true });
    raiz.addEventListener('touchend', fin);
    raiz.addEventListener('touchcancel', fin);
    return () => {
      raiz.removeEventListener('touchstart', ini);
      raiz.removeEventListener('touchmove', mov);
      raiz.removeEventListener('touchend', fin);
      raiz.removeEventListener('touchcancel', fin);
    };
  }, [todo]);

  if (!todo) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  const f = arrastre ? arrastre.frac : 0;
  // Sin transform en reposo: un ancestro transformado (aunque sea identidad)
  // vuelve relativo a él todo position:fixed interno y rompe los sheets
  // (overlay recortado y anclado al fondo de la página).
  return html`<div class="vista" ref=${raizRef}>
    <div class="cabecera"><h1>Estadísticas</h1></div>
    <${Segmentado} opciones=${[['resumen', 'Resumen'], ['flujo', 'Flujo y futuro']]} valor=${vista} onChange=${setVista}
      onArrastre=${frac => setArrastre({ frac })} onFin=${() => setArrastre(null)} />
    <div class=${arrastre ? '' : 'trans-vista'} style=${arrastre ? {
      transform: `translateX(${-f * 18}%)`,
      opacity: 1 - Math.abs(f) * 0.4
    } : null}>
      ${vista === 'resumen'
        ? html`<${VistaRango} S=${S} todo=${todo} />`
        : html`<${VistaFlujo} S=${S} todo=${todo} />`}
    <//>
  </div>`;
}

/** Selector de alcance de cuenta para la vista Resumen: una pastilla con
 *  flechas que recorre "Todo" y cada cuenta activa (también tocando el
 *  centro avanza). Debajo, puntos indican la posición — igual que el carrusel. */
function SelectorCuentas({ S, todo, cuentaScope, setCuentaScope }) {
  // orden por movimiento: la cuenta más usada queda primero (después de Todo)
  const conteo = id => todo.filter(t => t.cuenta === id || t.cuentaDestino === id).length;
  const activas = S.cuentas.filter(c => !c.archivada)
    .sort((a, b) => conteo(b.id) - conteo(a.id) || a.nombre.localeCompare(b.nombre));
  const orden = [null, ...activas.map(c => c.id)];
  const pos = Math.max(0, orden.indexOf(cuentaScope));
  const ir = delta => setCuentaScope(orden[(pos + delta + orden.length) % orden.length]);
  const actual = cuentaScope ? S.cuentas.find(c => c.id === cuentaScope) : null;
  return html`<div style=${{ marginBottom: '12px' }}>
    <div style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button class="flecha-cuenta" aria-label="Cuenta anterior" onClick=${() => ir(-1)}>‹</button>
      <button class="caja-cuenta" onClick=${() => ir(1)} aria-label=${actual ? 'Siguiente cuenta' : 'Ver por cuenta'}>
        ${actual
          ? html`<${IconoCuenta} tipo=${actual.tipo} /> <span>${actual.nombre}</span>
              <span class="num" style=${{ color: 'var(--muted)', fontWeight: 600 }}>${fmtConMoneda(saldoCuenta(actual, todo, S.tasas), actual.moneda)}</span>`
          : html`<span>Todo</span><span class="num" style=${{ color: 'var(--muted)', fontWeight: 600 }}>· ${fmtConMoneda(patrimonio(S.cuentas, todo, S.tasas, S.ajustes.monedaPrincipal).total, S.ajustes.monedaPrincipal)}</span>`}
      </button>
      <button class="flecha-cuenta" aria-label="Cuenta siguiente" onClick=${() => ir(1)}>›</button>
    </div>
    ${orden.length > 1 && html`<div class="carrusel-puntos" style=${{ margin: '8px 0 0' }}>
      ${orden.map(id => html`<button key=${id || 'todo'} type="button" aria-label="Alcance"
        class=${'carrusel-punto' + ((id === cuentaScope) ? ' activo' : '')}
        onClick=${() => setCuentaScope(id)}><//>`)}
    <//>`}
  </div>`;
}

/* ================= Vista: Resumen (período elegible) ================= */
function VistaRango({ S, todo }) {
  const [filtro, setFiltro] = useState('mes'); // preset o [desde, hasta] personalizado
  const [cuentaScope, setCuentaScope] = useState(null); // null = Todo
  const [slide, setSlide] = useState('dia'); // diapositiva del carrusel (indicadores por slide)
  useEffect(() => { setSlide('dia'); }, [cuentaScope]);
  const principal = S.ajustes.monedaPrincipal;
  const [desde, hasta] = Array.isArray(filtro) ? filtro : rangoPreset(filtro);
  const etiqueta = etiquetaRango(desde, hasta);
  // alcance de cuenta: las estadísticas se filtran a los movimientos de esa
  // cuenta (gastos e ingresos con ella; las transferencias ya no cuentan)
  const txs = cuentaScope
    ? todo.filter(t => t.cuenta === cuentaScope || t.cuentaDestino === cuentaScope)
    : todo;
  const st = statsRango(desde, hasta, txs, S, todo);
  const est = estructuraRango(desde, hasta, txs, S);
  const tend = tendencia(txs, S, 12);
  const p = patrimonio(S.cuentas, todo, S.tasas, principal);
  const presup = new Map(S.presupuestos.map(x => [x.categoria, x.monto]));
  const maxCat = Math.max(1, ...st.porCategoria.map(c => c.monto));
  const maxTend = Math.max(1, ...tend.map(m => Math.max(m.gasto, m.ingreso)));
  const serie = serieGasto(desde, hasta, st.porDia);
  // Indicadores informativos de ventana móvil: siempre los últimos 3 meses
  // (90 días), sin que el usuario pueda cambiar el rango.
  const hoyMS = +deISO(isoDia());
  const diaHoy = isoDia();
  const desde3 = isoDia(new Date(hoyMS - 89 * 86400000)) + 'T00:00';
  const hasta3 = isoDia(new Date(hoyMS + 86400000)) + 'T00:00';
  const st3 = statsRango(desde3, hasta3, txs, S, todo);
  const ahorro3 = st3.neto; // ingreso − gasto − salidas a terceros (90 días)
  // alcance pasivo (tarjeta/deuda): la ficha cambia — deudas y pagos, no ingresos
  const cuentaObj = cuentaScope ? S.cuentas.find(c => c.id === cuentaScope) : null;
  const esPasiva = !!cuentaObj && (cuentaObj.tipo === 'tarjeta' || cuentaObj.tipo === 'deuda');
  const pagosT = esPasiva
    ? pagosTarjeta(cuentaObj, { txs: todo, tasas: S.tasas, principal, fijos: S.fijos, cuotas: S.cuotas, n: 2 })
    : [];
  const saldoT = esPasiva ? saldoCuenta(cuentaObj, todo, S.tasas) : 0;
  // métricas por diapositiva (tarjeta): cuotas y deuda
  const planes = esPasiva ? S.cuotas.filter(p => p.activa !== false && p.cuentaId === cuentaScope) : [];
  const pendCuotas = planes.reduce((s, p) => s + convertir(planCuotas(p).pendiente, p.moneda, principal, S.tasas, isoDia()), 0);
  const serieCuotasMes = esPasiva ? cuotasPorMes(cuentaScope, S.cuotas, S.tasas, principal, 6) : [];
  const proxCuota = serieCuotasMes.find(m => m.total > 0) || null;
  const libreEnTxt = planes.length
    ? (() => {
      const ultima = planes.reduce((mx, p) => { const u = planCuotas(p).ultima; return u > mx ? u : mx; }, '');
      const d = deISO(ultima);
      return `${MESES3[d.getMonth()]} ${d.getFullYear()}`;
    })() : null;
  const deudaSerie3 = esPasiva ? serieSaldos({ cuentas: S.cuentas, txs: todo, tasas: S.tasas, principal, desdeD: sumarMesClave(claveMesActual(), -3) + '-01', hastaD: isoDia(), cuentaId: cuentaScope }) : [];
  const deudaHoy = deudaSerie3.length ? -deudaSerie3.at(-1).balance : 0;
  const deuda3m = deudaSerie3.length ? -deudaSerie3[0].balance : 0;
  const delta3m = deudaHoy - deuda3m;
  // El promedio divide entre los días REALMENTE usados: si la app empezó hace
  // una semana, no se reparte el gasto entre 90 días.
  const primeraTx = txs.length
    ? txs.reduce((a, t) => (t.fecha.slice(0, 10) < a ? t.fecha.slice(0, 10) : a), diaHoy)
    : diaHoy;
  const desde3Dia = desde3.slice(0, 10);
  const desdeEfectivo = desde3Dia > primeraTx ? primeraTx : desde3Dia;
  const diasEfectivos = Math.max(1, Math.min(90, Math.round((hoyMS - +deISO(desdeEfectivo)) / 86400000) + 1));
  const promDia = st3.gasto / diasEfectivos;
  const catTop = st3.porCategoria[0];
  // Ficha compacta: si el monto completo no cabe en la ficha, se abrevia (1.2M).
  const fmtFicha = (v, cod = principal) => {
    const t = fmtConMoneda(v, cod);
    return t.length <= 10 ? t : `${monedaInfo(cod).simbolo}${fmtCompacto(v, cod)}`;
  };

  // Cuentas de débito (efectivo, bancaria, ahorro): importa la liquidez — las
  // transferencias forman parte de las entradas y salidas. Mantener las mismas
  // fechas del selector visible.
  const esDebito = !!cuentaObj && ['efectivo', 'bancaria', 'ahorro'].includes(cuentaObj.tipo);
  if (esDebito) return html`<div>
    <${CajaFechas} filtro=${filtro} onFiltro=${setFiltro} />
    <${SelectorCuentas} S=${S} todo=${todo} cuentaScope=${cuentaScope} setCuentaScope=${setCuentaScope} />
    <${ActividadBancaria} cuenta=${cuentaObj} txs=${todo} tasas=${S.tasas}
      cuentas=${S.cuentas} categorias=${S.categorias} desde=${desde} hasta=${hasta} />
  </div>`;

  return html`<div>
    <${CajaFechas} filtro=${filtro} onFiltro=${setFiltro} />
    <${SelectorCuentas} S=${S} todo=${todo} cuentaScope=${cuentaScope} setCuentaScope=${setCuentaScope} />

    ${!cuentaScope && html`<p class="ab-contexto">Para ver entradas, salidas y transferencias de una cuenta, elígela arriba.</p>`}

    ${esPasiva ? html`
    <div class="stats-grid-3">
      ${slide === 'cuotas' ? html`
      <div class="stat-box"><div class="etq">Próxima cuota</div>
        <div class="val">${proxCuota ? fmtFicha(proxCuota.total) : '—'}</div>
        ${proxCuota && html`<div class="val" style=${{ color: 'var(--muted)', fontWeight: 600, marginTop: '1px' }}>${MESES3[+proxCuota.clave.slice(5, 7) - 1]}</div>`}</div>
      <div class="stat-box"><div class="etq">En cuotas</div><div class="val">${fmtFicha(pendCuotas)}</div></div>
      <div class="stat-box"><div class="etq">Libre en</div>
        <div class="val" style=${{ fontSize: '15px' }}>${libreEnTxt || '—'}</div></div>`
      : slide === 'deuda' ? html`
      <div class="stat-box"><div class="etq">Deuda hoy</div>
        <div class="val m-gasto">${deudaHoy > 0 ? '−' + fmtFicha(deudaHoy) : fmtFicha(Math.max(0, deudaHoy))}</div></div>
      <div class="stat-box"><div class="etq">Hace 3 meses</div>
        <div class="val" style=${{ color: 'var(--muted)' }}>${deuda3m > 0 ? '−' + fmtFicha(deuda3m) : fmtFicha(Math.max(0, deuda3m))}</div></div>
      <div class="stat-box"><div class="etq">Cambio 3 m</div>
        <div class="val" style=${{ color: delta3m > 0 ? 'var(--gasto)' : 'var(--ingreso)' }}>${delta3m > 0 ? '▲' : '▼'} ${fmtFicha(Math.abs(delta3m))}</div></div>`
      : html`
      <div class="stat-box"><div class="etq">Gasto</div><div class="val m-gasto">${fmtFicha(st.gasto)}</div></div>
      <div class="stat-box"><div class="etq">Gasto / día</div><div class="val">${fmtFicha(Math.round(promDia))}</div></div>
      <div class="stat-box"><div class="etq">Mayor gasto</div>
        <div class="val" style=${{ fontSize: '13px', lineHeight: 1.35 }}>
          ${catTop ? html`<span style=${{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
            ${catTop.icono ? html`<${IconoId} id=${catTop.icono} />` : html`<${IconoCategoria} emoji=${catTop.emoji} nombre=${catTop.nombre} />`}${catTop.nombre}</span>` : '—'}</div></div>`}
    </div>
    <div class="stats-grid-3">
      <div class="stat-box"><div class="etq">Próximo pago</div>
        <div class="val">${fmtFicha(Math.round(pagosT[0]?.montoP || 0))}</div>
        <div class="val" style=${{ color: 'var(--muted)', fontWeight: 600, marginTop: '1px' }}>${pagosT[0] ? fmtDiaMes(pagosT[0].fecha) : '—'}</div></div>
      <div class="stat-box"><div class="etq">Pago posterior</div>
        <div class="val" style=${{ color: (pagosT[1]?.montoP || 0) === 0 ? 'var(--muted)' : 'inherit' }}>${fmtFicha(Math.round(pagosT[1]?.montoP || 0))}</div>
        <div class="val" style=${{ color: 'var(--muted)', fontWeight: 600, marginTop: '1px' }}>${pagosT[1] ? fmtDiaMes(pagosT[1].fecha) : '—'}</div></div>
      <div class="stat-box"><div class="etq">Crédito disponible</div>
        ${cuentaObj.limite > 0
          ? html`<div class="val" style=${{ color: cuentaObj.limite + saldoT < 0 ? 'var(--gasto)' : 'inherit' }}>${fmtFicha(Math.max(0, cuentaObj.limite + saldoT))}</div>
              <div class="etq" style=${{ marginTop: '2px' }}>de ${fmtConMoneda(cuentaObj.limite, cuentaObj.moneda)}</div>`
          : html`<div class="val">—</div>
              <div class="etq" style=${{ marginTop: '2px' }}>ponle límite en Cuentas</div>`}
      </div>
      <div style=${{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: '26px', padding: '2px 0 0' }}>
        <span class="dato-cuenta">Fecha corte: <b class="num" style=${{ color: 'var(--text)' }}>${cuentaObj.corte || '—'}</b></span>
        <span class="dato-cuenta">Fecha pago: <b class="num" style=${{ color: 'var(--accent)' }}>${cuentaObj.pagoDia || '—'}</b></span>
      </div>
    </div>` : html`
    <div class="stats-grid-3">
      <div class="stat-box"><div class="etq">Gasto</div><div class="val m-gasto">${fmtFicha(st.gasto)}</div></div>
      <div class="stat-box"><div class="etq">Ingreso</div><div class="val m-ingreso">${fmtFicha(st.ingreso)}</div>
        ${st.deTerceros > 0 && html`<div class="etq" style=${{ marginTop: '2px' }}>incluye ${fmtFicha(st.deTerceros)} de terceros</div>`}</div>
      <div class="stat-box"><div class="etq">Neto</div><div class="val" style=${{ color: st.neto >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }}>${st.neto >= 0 ? '+' : '−'}${fmtFicha(Math.abs(st.neto))}</div></div>
    </div>
    <div class="stats-grid-3">
      <div class="stat-box"><div class="etq">${ahorro3 >= 0 ? 'Ahorro' : 'Desahorro'}</div>
        <div class="val" style=${{ color: ahorro3 >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }}>${ahorro3 >= 0 ? '+' : '−'}${fmtFicha(Math.abs(ahorro3))}</div>
        ${st3.aTerceros > 0 && html`<div class="etq" style=${{ marginTop: '2px' }}>sin ${fmtFicha(st3.aTerceros)} a terceros</div>`}
        ${st3.aTerceros < 0 && html`<div class="etq" style=${{ marginTop: '2px' }}>con ${fmtFicha(-st3.aTerceros)} devueltos</div>`}</div>
      <div class="stat-box"><div class="etq">Gasto / día</div>
        <div class="val">${fmtFicha(Math.round(promDia))}</div></div>
      <div class="stat-box"><div class="etq">Mayor gasto</div>
        <div class="val" style=${{ fontSize: '13px', lineHeight: 1.35 }}>
          ${catTop ? html`<span style=${{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
            <${IconoCategoria} emoji=${catTop.emoji} nombre=${catTop.nombre} />${catTop.nombre}</span>` : '—'}</div></div>
    </div>`}

    <${TarjetaDia} serie=${serie} est=${est} etiqueta=${etiqueta} principal=${principal}
      cuenta=${cuentaObj} S=${S} todo=${todo} vista=${slide} setVista=${setSlide} />

    <div class="tarjeta">
      <h3>Por categoría</h3>
      ${st.porCategoria.slice(0, 12).map(c => html`<div key=${c.id} class="barra-fila">
        <div class="info">
          <span><${IconoCat} icono=${c.icono} emoji=${c.emoji} /> ${c.nombre}${presup.get(c.id) ? html` <span class="etiqueta-mini">presup.</span>` : ''}</span>
          <span class="num">${fmtConMoneda(c.monto, principal)} · ${Math.round(c.monto / st.gasto * 100)}%</span>
        </div>
        <div class="pista"><div class="lleno" style=${{ width: (c.monto / maxCat * 100) + '%' }}></div></div>
        ${presup.get(c.id) && html`<div class="dato-cuenta" style=${{ color: c.monto > presup.get(c.id) ? 'var(--gasto)' : 'var(--muted)' }}>
          ${c.monto > presup.get(c.id) ? '⚠ excede' : 'de'} ${fmtConMoneda(presup.get(c.id), principal)} presupuestados
        <//>`}
      </div>`)}
      ${st.porCategoria.length === 0 && html`<div class="vacio">Sin gastos en este período.</div>`}
    </div>

    ${st.porCategoriaIngreso.length > 0 && html`<div class="tarjeta">
      <h3>Ingresos por categoría</h3>
      ${st.porCategoriaIngreso.map(c => html`<div key=${c.id} class="barra-fila">
        <div class="info"><span><${IconoCat} icono=${c.icono} emoji=${c.emoji} /> ${c.nombre}</span><span class="num">${fmtConMoneda(c.monto, principal)}</span></div>
        <div class="pista"><div class="lleno" style=${{ width: (c.monto / st.porCategoriaIngreso[0].monto * 100) + '%', background: 'var(--ingreso)' }}></div></div>
      </div>`)}
    <//>`}

    ${st.porEtiqueta.length > 0 && html`<div class="tarjeta">
      <h3>Por actividad / etiqueta</h3>
      ${st.porEtiqueta.map(e => html`<div key=${e.id} class="barra-fila">
        <div class="info"><span>${ICONO_ETIQUETA} #${e.nombre}</span><span class="num">${fmtConMoneda(e.monto, principal)}</span></div>
        <div class="pista"><div class="lleno" style=${{ width: (e.monto / st.porEtiqueta[0].monto * 100) + '%', background: 'var(--transfer)' }}></div></div>
      </div>`)}
    <//>`}

    <div class="tarjeta">
      <h3>Tendencia · últimos 12 meses</h3>
      <${Tendencia} datos=${tend} max=${maxTend} />
      <div style=${{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
        <span>🟧 Gasto</span><span>🟩 Ingreso</span>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Cuentas · ahora</h3>
      ${S.cuentas.filter(c => !c.archivada && (!cuentaScope || c.id === cuentaScope)).map(c => html`<div key=${c.id} class="fila">
        <span class="emoji"><${IconoCuenta} tipo=${c.tipo} /></span>
        <div class="cuerpo"><div class="titulo">${c.nombre}</div><div class="sub">${c.moneda}</div></div>
        <div class="monto num" style=${{ color: saldoConvertido(c, todo, S.tasas, principal) < 0 ? 'var(--gasto)' : 'inherit' }}>
          ${fmtConMoneda(saldoConvertido(c, todo, S.tasas, principal), principal)}
        </div>
      </div>`)}
      <div class="grupo-dia" style=${{ paddingTop: '10px' }}>
        <span class="fecha">Patrimonio</span>
        <span class="num" style=${{ fontWeight: 800 }}>${fmtConMoneda(p.total, principal)}</span>
      </div>
      ${p.deudas > 0 && html`<div class="grupo-dia" style=${{ paddingTop: '2px' }}>
        <span class="fecha">Deuda total</span>
        <span class="num m-gasto" style=${{ fontWeight: 800 }}>−${fmtConMoneda(p.deudas, principal)}</span>
      <//>`}
    </div>
  </div>`;
}

/* ================= Vista: Flujo y futuro ================= */
function VistaFlujo({ S, todo }) {
  const principal = S.ajustes.monedaPrincipal;
  const [horizonte, setHorizonte] = useState(1);
  const [cuentaScope, setCuentaScope] = useState(null); // null = patrimonio
  const [grafica, setGrafica] = useState('linea'); // 'linea' | 'pie' | 'barras'
  const [editor, setEditor] = useState(null);

  const fl = useMemo(() => flujoEfectivo({
    cuentas: S.cuentas, txs: todo, tasas: S.tasas, principal,
    futuros: S.futuros, fijos: S.fijos, cuotas: S.cuotas, pasadoMeses: 6, futuroMeses: horizonte, cuentaId: cuentaScope
  }), [S.cuentas, todo, S.tasas, S.futuros, S.fijos, S.cuotas, horizonte, cuentaScope]);

  const final = fl.serie.at(-1);
  const nombreScope = cuentaScope ? (S.cuentas.find(c => c.id === cuentaScope)?.nombre || '') : null;
  const HORIZONTES = [[1, '1 mes'], [3, '3 meses'], [6, '6 meses']];

  /** Convierte un registro vencido en transacción real (con su fecha original)
   *  y lo elimina de la lista de futuros: el pasado solo vive en Movimientos. */
  const registrarOcurrido = async f => {
    if (!confirm('¿Registrar "' + (f.nombre || (f.tipo === 'transferencia' ? 'la transferencia' : f.tipo)) +
      '" como movimiento real del ' + fmtFechaCorta(f.fecha) + '?')) return;
    await fin.guardarTx({
      id: uid(), tipo: f.tipo, monto: f.monto, moneda: f.moneda,
      cuenta: f.cuenta || S.cuentas.filter(c => !c.archivada)[0]?.id || null,
      cuentaDestino: f.cuentaDestino || null,
      montoDestino: f.montoDestino ?? null,
      categoria: f.categoria || null, etiquetas: [], motivo: f.nombre || null,
      fecha: f.fecha + 'T' + isoLocal().slice(11, 16),
      adjuntos: [], eliminada: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await fin.borrarFuturo(f.id);
    await recargar();
    toast('✓ Registrado en tus movimientos');
  };

  return html`<div>
    <div class="chips-scroll" style=${{ marginBottom: '10px' }}>
      <button class=${'chip' + (!cuentaScope ? ' sel' : '')} onClick=${() => setCuentaScope(null)}>🌏 Patrimonio</button>
      ${S.cuentas.filter(c => !c.archivada).map(c => html`
        <button key=${c.id} class=${'chip' + (cuentaScope === c.id ? ' sel' : '')} onClick=${() => setCuentaScope(c.id)}>
          <${IconoCuenta} tipo=${c.tipo} /> ${c.nombre}
        </button>`)}
    </div>

    <div class="tarjeta" style=${{ textAlign: 'center', padding: '18px 14px' }}>
      <div style=${{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        ${nombreScope ? `Hoy en ${nombreScope}` : 'Hoy tienes'}
      </div>
      <div class="num" style=${{ fontSize: '30px', fontWeight: 800 }}>${fmtConMoneda(fl.balanceHoy, principal)}</div>
      <${Segmentado} opciones=${HORIZONTES} valor=${horizonte} onChange=${setHorizonte} />
    </div>

    <div class="stats-grid-3">
      <div class="stat-box"><div class="etq">En ${horizonte} m</div>
        <div class="val" style=${{ color: final.balance < 0 ? 'var(--gasto)' : 'var(--ingreso)' }}>${fmtConMoneda(final.balance, principal)}</div></div>
      <div class="stat-box"><div class="etq">Punto más bajo</div>
        <div class="val" style=${{ color: fl.minimo.balance < 0 ? 'var(--gasto)' : 'inherit' }}>${fmtConMoneda(fl.minimo.balance, principal)}</div>
        <div class="etq" style=${{ marginTop: '2px' }}>${fmtFechaCorta(fl.minimo.fecha)}</div></div>
      <div class="stat-box"><div class="etq">Neto futuro</div>
        <div class="val" style=${{ color: fl.totalIn - fl.totalOut >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }}>${fmtConMoneda(fl.totalIn - fl.totalOut, principal, true)}</div>
        <div class="etq" style=${{ marginTop: '2px' }}>+${fmtMonto(fl.totalIn, 2)} / −${fmtMonto(fl.totalOut, 2)}</div></div>
    </div>

    <div class="tarjeta">
      <${Segmentado} opciones=${[['linea', 'Línea'], ['pie', 'Pie'], ['barras', 'Barras']]} valor=${grafica} onChange=${setGrafica} />
      ${grafica === 'linea' && html`<div>
        <h3 style=${{ fontSize: '11px' }}>${nombreScope ? `${nombreScope} en el tiempo` : 'Tu patrimonio en el tiempo'}</h3>
        <${ChartFlujo} fl=${fl} principal=${principal} />
        <div style=${{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
          <span>▬ Real</span><span>┄ Registrado por ti</span>
        </div>
      <//>`}
      ${grafica === 'pie' && html`<${ChartPie} S=${S} fl=${fl} principal=${principal} />`}
      ${grafica === 'barras' && html`<${ChartBarrasFuturo} S=${S} fl=${fl} principal=${principal} horizonte=${horizonte} />`}
    </div>

    <div class="tarjeta">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style=${{ marginBottom: 0 }}>Próximos movimientos</h3>
        <button class="chip" onClick=${() => setEditor({ tipo: 'ingreso', moneda: principal, fecha: isoDia() })}>＋ Agregar</button>
      </div>
      ${fl.lista.map(f => {
        const esCargoFijo = !!f.esCargoTarjeta;   // fijo cargado a tarjeta (patrimonio: no mueve la línea)
        const destinoF = !f.esFijo && f.tipo === 'transferencia' ? S.cuentas.find(c => c.id === f.cuentaDestino) : null;
        const esDeuda = f.tipo === 'transferencia' && destinoF && (destinoF.tipo === 'tarjeta' || destinoF.tipo === 'deuda');
        const positivo = f.esPagoTarjeta || f.tipo === 'ingreso' || esCargoFijo;
        return html`<div key=${f.id} class="fila" onClick=${f.esFijo ? undefined : () => setEditor(f)}>
          <div class="cuerpo">
            <div class="titulo">${f.esPagoTarjeta ? html`${ICONO_TARJETA} ` : f.esFijo ? html`${ICONO_TRANSFER} ` : ''}${f.tipo === 'transferencia' && !f.esFijo
              ? (esDeuda ? `Pago de deuda · ${destinoF?.nombre || '?'}` : `${S.cuentas.find(c => c.id === f.cuenta)?.nombre || '?'} → ${destinoF?.nombre || '?'}`)
              : (f.nombre || (f.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))}</div>
            <div class="sub">${esCargoFijo
              ? `${fmtFechaCorta(f.fecha)} · va a tu tarjeta ${f.fuenteNombre}`
              : f.esCuota
                ? `${fmtFechaCorta(f.fecha)} · cuota ${f.cuotaK} de ${f.cuotaN} a tu tarjeta ${f.fuenteNombre}`
                : `${fmtFechaCorta(f.fecha)} · después: ${fmtConMoneda(f.balanceDespues, principal)}`}</div>
          </div>
          <div class=${'monto num ' + (positivo ? 'm-ingreso' : f.tipo === 'transferencia' ? 'm-transf' : 'm-gasto')}>
            ${positivo ? '+' : f.tipo === 'transferencia' ? '→ ' : '−'}${fmtConMoneda(f.monto, f.moneda)}
          </div>
        </div>`;
      })}
      ${fl.lista.length === 0 && html`<div class="vacio">
        Registra lo que sabes que viene: "15 — salario +Q8,000", "20 — pago tarjeta", "12 — +Q400"…<br/>
        La línea punteada te mostrará cuánto tendrás en cada fecha.
      <//>`}

      ${fl.vencidos.length > 0 && html`<div style=${{ marginTop: '10px' }}>
        <h3>Ya pasó su fecha</h3>
        ${fl.vencidos.map(f => {
          const destinoV = f.tipo === 'transferencia' ? S.cuentas.find(c => c.id === f.cuentaDestino) : null;
          const esDeudaV = f.tipo === 'transferencia' && destinoV && (destinoV.tipo === 'tarjeta' || destinoV.tipo === 'deuda');
          return html`<div key=${f.id} class="fila fila-vencida" onClick=${() => setEditor(f)}>
          <div class="cuerpo">
            <div class="titulo">${f.tipo === 'transferencia'
              ? (esDeudaV ? `Pago de deuda · ${destinoV?.nombre || '?'}` : `${S.cuentas.find(c => c.id === f.cuenta)?.nombre || '?'} → ${destinoV?.nombre || '?'}`)
              : (f.nombre || (f.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))}</div>
            <div class="sub">${fmtFechaCorta(f.fecha)} · toca para reprogramarlo</div>
          </div>
          <button class="chip" style=${{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            onClick=${e => { e.stopPropagation(); registrarOcurrido(f); }}>✓ Ya ocurrió</button>
        <//>`;
        })}
        <div class="dato-cuenta" style=${{ marginTop: '6px' }}>
          "Ya ocurrió" lo convierte en movimiento real con su fecha original (y lo quita de aquí). Tu pasado vive solo en Movimientos.
        <//>
      <//>`}

      <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
        Esto no es una predicción: son <b>tus registros</b>. La línea sólida es tu historia real; la punteada, lo que anotaste que viene.
      </div>
    </div>

    ${editor && html`<${Sheet} titulo=${editor.id ? 'Reprogramar movimiento futuro' : 'Nuevo movimiento futuro'} onClose=${() => setEditor(null)}>
      <${EditorFuturo} f=${editor} S=${S} cerrar=${() => setEditor(null)} />
    <//>`}
  </div>`;
}

/* ---------- Editor de movimiento futuro ---------- */
function EditorFuturo({ f, S, cerrar }) {
  const [d, setD] = useState({
    nombre: f.nombre || '', tipo: f.tipo || 'ingreso',
    monto: f.monto ? enteroATexto(f.monto, 2) : '', moneda: f.moneda || S.ajustes.monedaPrincipal,
    fecha: f.fecha || isoDia(), repetir: 'unica',
    cuenta: f.cuenta || null, cuentaDestino: f.cuentaDestino || null,
    categoria: f.categoria || null
  });
  const [picker, setPicker] = useState(null); // 'cuenta' | 'destino'
  const set = p => setD({ ...d, ...p });
  const cuentaObj = S.cuentas.find(c => c.id === d.cuenta);
  const destinoObj = S.cuentas.find(c => c.id === d.cuentaDestino);

  /** Disponible proyectado en una cuenta (o patrimonio) en la fecha dada,
   *  contando los demás movimientos futuros ya registrados. */
  const disponibleProyectado = async (cuentaId, fecha, excluirId) => {
    const todas = await fin.todasTx();
    const hoyD = isoDia();
    const principalMoneda = S.ajustes.monedaPrincipal;
    if (!cuentaId) {
      let proy = patrimonio(S.cuentas, todas, S.tasas, principalMoneda).total;
      for (const fu of S.futuros) {
        if (fu.id === excluirId || fu.fecha > fecha) continue;
        if (fu.tipo === 'ingreso') proy += convertir(fu.monto, fu.moneda, principalMoneda, S.tasas, hoyD);
        else if (fu.tipo === 'gasto') proy -= convertir(fu.monto, fu.moneda, principalMoneda, S.tasas, hoyD);
      }
      return { proy, moneda: principalMoneda };
    }
    const cuenta = S.cuentas.find(c => c.id === cuentaId);
    let proy = saldoCuenta(cuenta, todas, S.tasas);
    for (const fu of S.futuros) {
      if (fu.id === excluirId || fu.fecha > fecha) continue;
      if (fu.tipo === 'gasto' && fu.cuenta === cuentaId) proy -= convertir(fu.monto, fu.moneda, cuenta.moneda, S.tasas, hoyD);
      else if (fu.tipo === 'ingreso' && fu.cuenta === cuentaId) proy += convertir(fu.monto, fu.moneda, cuenta.moneda, S.tasas, hoyD);
      else if (fu.tipo === 'transferencia') {
        if (fu.cuenta === cuentaId) proy -= convertir(fu.monto, fu.moneda, cuenta.moneda, S.tasas, hoyD);
        else if (fu.cuentaDestino === cuentaId) proy += convertir(fu.montoDestino ?? fu.monto, fu.monedaDestino || fu.moneda, cuenta.moneda, S.tasas, hoyD);
      }
    }
    return { proy, moneda: cuenta.moneda };
  };

  const guardar = async () => {
    const monto = textoAEntero(d.monto || '0', 2);
    if (!monto) { toast('Escribe el monto'); return; }
    if (!d.fecha) { toast('Elige la fecha'); return; }
    if (d.fecha <= isoDia()) { toast('La fecha debe ser futura: lo que ya pasó se registra con ＋ o con "Ya ocurrió"'); return; }
    if (d.tipo === 'transferencia') {
      if (!cuentaObj || !destinoObj || cuentaObj.id === destinoObj.id) { toast('Elige las dos cuentas (distintas)'); return; }
    }
    // validez: solo la FUENTE (cuenta de origen) limita el pago. El patrimonio
    // puede estar negativo por deudas — eso se abona a futuro y no impide nada.
    // Las tarjetas de crédito tampoco bloquean: gastar con deuda es su naturaleza.
    if (d.tipo !== 'ingreso') {
      const alcance = d.tipo === 'transferencia' ? cuentaObj?.id : d.cuenta || null;
      const cuentaAlcance = S.cuentas.find(c => c.id === alcance);
      const esCredito = cuentaAlcance && (cuentaAlcance.tipo === 'tarjeta' || cuentaAlcance.tipo === 'deuda');
      if (alcance && !esCredito) {
        const { proy, moneda } = await disponibleProyectado(alcance, d.fecha, f.id);
        const montoAlcance = convertir(monto, d.moneda, moneda, S.tasas, isoDia());
        if (montoAlcance > proy) {
          alert(`No se puede guardar: la cuenta proyecta solo ${fmtConMoneda(proy, moneda)} disponibles el ${fmtFechaCorta(d.fecha)}, contando tus otros movimientos futuros.\n\nAjusta el monto o la fecha, o registra primero los ingresos que la cubren.`);
          return;
        }
      }
    }
    const fechas = f.id ? [d.fecha] : fechasRepetir(d.fecha, d.repetir, d.repetir === 'unica' ? 1 : 6);
    const distinta = d.tipo === 'transferencia' && destinoObj && cuentaObj && destinoObj.moneda !== cuentaObj.moneda;
    for (const fecha of fechas) {
      await fin.guardarFuturo({
        id: f.id && fechas.length === 1 ? f.id : uid(),
        nombre: d.nombre.trim() || null, tipo: d.tipo, monto, moneda: d.moneda, fecha,
        cuenta: d.tipo === 'transferencia' ? cuentaObj?.id : (d.tipo === 'gasto' || d.tipo === 'ingreso' ? d.cuenta : null),
        categoria: d.tipo === 'transferencia' ? null : d.categoria,
        cuentaDestino: d.tipo === 'transferencia' ? destinoObj?.id : null,
        montoDestino: distinta ? convertir(monto, cuentaObj.moneda, destinoObj.moneda, S.tasas, isoDia()) : null,
        monedaDestino: distinta ? destinoObj.moneda : null,
        creadoEn: f.creadoEn || new Date().toISOString()
      });
    }
    await recargar();
    toast(f.id ? '✓ Guardado' : (fechas.length > 1 ? `✓ ${fechas.length} movimientos registrados` : '✓ Registrado'));
    cerrar();
  };

  const borrar = async () => {
    if (!f.id || !confirm('¿Borrar este movimiento futuro?')) return;
    await fin.borrarFuturo(f.id);
    await recargar();
    toast('Eliminado');
    cerrar();
  };

  return html`<div>
    <${Segmentado} opciones=${[['ingreso', 'Ingreso'], ['gasto', 'Gasto'], ['transferencia', 'Transferencia']]}
      valor=${d.tipo} onChange=${t => set({ tipo: t, categoria: null })} />
    <div style=${{ display: 'grid', gap: '8px' }}>
      ${d.tipo !== 'transferencia' && html`<input placeholder="Nombre (ej. Salario, Alquiler…)" value=${d.nombre}
        onInput=${e => set({ nombre: e.target.value })} />`}
      <div style=${{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input style=${{ flex: '1 1 120px', minWidth: 0, textAlign: 'right', fontWeight: 700 }} inputMode="decimal" placeholder="0.00"
          value=${d.monto} onInput=${e => set({ monto: e.target.value })} />
        <div class="chips-scroll" style=${{ flexShrink: 0 }}>
          ${['GTQ', 'USD'].map(m => html`<button key=${m} class=${'chip' + (d.moneda === m ? ' sel' : '')}
            onClick=${() => set({ moneda: m })}>${m}</button>`)}
        <//>
      <//>

      ${d.tipo === 'transferencia' ? html`<div>
        <div class="dato-cuenta">Desde → hacia</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          <button class="chip" onClick=${() => setPicker('cuenta')}>${cuentaObj && html`<${IconoCuenta} tipo=${cuentaObj.tipo} /> `}${cuentaObj ? cuentaObj.nombre : '¿Desde qué cuenta?'}</button>
          <span style=${{ alignSelf: 'center', color: 'var(--muted)' }}>→</span>
          <button class="chip" onClick=${() => setPicker('destino')}>${destinoObj && html`<${IconoCuenta} tipo=${destinoObj.tipo} /> `}${destinoObj ? destinoObj.nombre : '¿Hacia dónde?'}</button>
        <//>
      <//>` : html`<div>
        <div class="dato-cuenta">Cuenta (opcional)</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          <button class="chip" onClick=${() => setPicker('cuenta')}>
            ${cuentaObj && html`<${IconoCuenta} tipo=${cuentaObj.tipo} /> `}${cuentaObj ? cuentaObj.nombre : 'Cualquiera'}
          </button>
          ${d.cuenta && html`<button class="chip" onClick=${() => set({ cuenta: null })}>✕</button>`}
        <//>
      <//>`}

      ${d.tipo !== 'transferencia' && html`<div>
        <div class="dato-cuenta">Categoría (opcional)</div>
        <${GridCategorias} categorias=${S.categorias.filter(c => c.tipo === d.tipo)}
          valor=${d.categoria} onPick=${id => set({ categoria: d.categoria === id ? null : id })} />
      <//>`}

      <div>
        <div class="dato-cuenta">¿Cuándo?</div>
        <input type="date" value=${d.fecha} onChange=${e => set({ fecha: e.target.value || isoDia() })} />
      <//>
      ${!f.id && html`<div>
        <div class="dato-cuenta">Repetir (crea 6 fechas que puedes editar por separado)</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          ${[['unica', 'Solo esta vez'], ['semanal', 'Semanal'], ['mensual', 'Cada mes'], ['quincenal', 'Quincenal (15 y fin de mes)']].map(([v, t]) => html`
            <button key=${v} class=${'chip' + (d.repetir === v ? ' sel' : '')} onClick=${() => set({ repetir: v })}>${t}</button>`)}
        <//>
      <//>`}
    </div>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar</button>
    ${f.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar</button>`}

    ${picker && html`<${PickerCuentas}
      titulo=${d.tipo === 'transferencia' ? (picker === 'cuenta' ? '¿Desde qué cuenta?' : '¿Hacia qué cuenta?') : '¿Con qué cuenta?'}
      cuentas=${S.cuentas} txs=${[]} tasas=${S.tasas} sinSaldo
      excluir=${d.tipo === 'transferencia' && picker === 'destino' ? d.cuenta : null}
      onPick=${c => { setPicker(null); set(picker === 'destino' ? { cuentaDestino: c.id } : { cuenta: c.id }); }}
      onClose=${() => setPicker(null)} />`}
  </div>`;
}

/* ---------- Pie: distribución de lo proyectado, con taladro ----------
   Nivel 1: Gastos / Ingresos / Pagos de deuda / Transferencias.
   Tocar un grupo baja a su granularidad: gastos por categoría, ingresos por
   fuente, transferencias hacia dónde, deudas cuáles. Tocar una porción o fila
   muestra una etiqueta con más información. */
function ChartPie({ S, fl, principal }) {
  const [grupo, setGrupo] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const nombreC = id => S.cuentas.find(c => c.id === id)?.nombre || null;
  const ruta = f => `${nombreC(f.cuenta) || '?'} → ${nombreC(f.cuentaDestino) || '?'}`;
  const esPagoDeuda = f => {
    const d = S.cuentas.find(c => c.id === f.cuentaDestino);
    return f.tipo === 'transferencia' && d && (d.tipo === 'tarjeta' || d.tipo === 'deuda');
  };
  const grupoDe = f => f.tipo === 'ingreso' ? 'ingresos' : f.tipo === 'gasto' ? 'gastos' : (esPagoDeuda(f) ? 'deuda' : 'transferencias');
  const GRUPOS = { gastos: 'Gastos', ingresos: 'Ingresos', deuda: 'Pagos de deuda', transferencias: 'Transferencias' };

  const subEtiqueta = f => {
    if (grupo === 'gastos') {
      const cat = S.categorias.find(c => c.id === f.categoria);
      return cat ? `${cat.emoji} ${cat.nombre}` : 'Sin categoría';
    }
    if (grupo === 'ingresos') return f.nombre?.trim() || 'Sin nombre';
    if (grupo === 'deuda') return nombreC(f.cuentaDestino) || 'Deuda';
    return 'Hacia ' + (nombreC(f.cuentaDestino) || '?');
  };

  const lista = grupo ? fl.lista.filter(f => grupoDe(f) === grupo) : fl.lista;
  const llave = f => (grupo ? subEtiqueta(f) : GRUPOS[grupoDe(f)]);

  const mapa = new Map(), conteo = new Map();
  let entra = 0, sale = 0, mueve = 0;
  for (const f of lista) {
    const montoP = convertir(f.monto, f.moneda, principal, S.tasas, f.fecha);
    if (f.tipo === 'ingreso') entra += montoP;
    else if (f.tipo === 'gasto') sale += montoP;
    else mueve += montoP;
    const k = llave(f);
    mapa.set(k, (mapa.get(k) || 0) + montoP);
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  let items = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  if (!grupo && items.length > 8) {
    const resto = items.slice(7).reduce((s, [, v]) => s + v, 0);
    items = items.slice(0, 7).concat([['Otros', resto]]);
  }
  const total = items.reduce((s, [, v]) => s + v, 0);
  const COLORES = ['#0e8c6c', '#d64550', '#5b6b8c', '#d69e2e', '#805ad5', '#3182ce', '#dd6b20', '#38a169'];

  const arco = (cx, cy, r, a0, a1) => {
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    return `M${cx},${cy} L${p0[0].toFixed(2)},${p0[1].toFixed(2)} A${r},${r} 0 ${grande} 1 ${p1[0].toFixed(2)},${p1[1].toFixed(2)} Z`;
  };
  const tocar = nom => {
    if (!grupo) {
      const k = Object.keys(GRUPOS).find(k => GRUPOS[k] === nom);
      if (k) { setDetalle(null); setGrupo(k); }
      else setDetalle({ nom, val: mapa.get(nom) || 0, n: conteo.get(nom) || 0 });
    } else {
      setDetalle({ nom, val: mapa.get(nom) || 0, n: conteo.get(nom) || 0 });
    }
  };

  return html`<div>
    ${total === 0 && html`<div class="vacio">Registra movimientos futuros para ver su distribución.</div>`}
    ${total > 0 && html`<div>
      <div class="chips-scroll" style=${{ marginBottom: '8px' }}>
        ${grupo && html`<button class="chip sel" onClick=${() => { setGrupo(null); setDetalle(null); }}>‹ Volver a todo</button>`}
        ${!grupo && Object.entries(GRUPOS).filter(([k]) => fl.lista.some(f => grupoDe(f) === k)).map(([k, t]) => html`
          <button key=${k} class="chip" onClick=${() => setGrupo(k)}>${t}</button>`)}
      </div>
      ${!grupo && html`<div class="dato-cuenta" style=${{ marginBottom: '8px', textAlign: 'center' }}>
        Entra <b class="num" style=${{ color: 'var(--ingreso)' }}>+${fmtMonto(entra, 2)}</b> · Sale
        <b class="num" style=${{ color: 'var(--gasto)' }}>−${fmtMonto(sale, 2)}</b> · Se mueve
        <b class="num">${fmtMonto(mueve, 2)}</b> (${principal})
      <//>`}
      ${grupo && html`<h3 style=${{ fontSize: '11px' }}>${GRUPOS[grupo]} · desglose</h3>`}
      <div style=${{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg viewBox="0 0 42 42" style=${{ width: '110px', height: '110px', flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--chip)" stroke-width="6" />
          ${(() => {
            let a = 0;
            return items.map(([nom, val], i) => {
              const frac = total ? val / total : 0;
              const a0 = a, a1 = a + frac * Math.PI * 2 - 0.02;
              a += frac * Math.PI * 2;
              return html`<path key=${i} d=${arco(21, 21, 15.9, a0, Math.max(a0 + 0.01, a1))}
                fill=${COLORES[i % COLORES.length]} style=${{ cursor: 'pointer' }}
                onClick=${() => tocar(nom)}>
                <title>${nom}: ${fmtConMoneda(val, principal)} (${Math.round(frac * 100)}%)${grupo ? '' : ' · toca para desglosar'}</title>
              <//>`;
            });
          })()}
        <//>
        <div style=${{ flex: 1, minWidth: 0 }}>
          ${items.map(([nom, val], i) => html`<div key=${i} style=${{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', marginBottom: '3px', cursor: 'pointer' }}
            onClick=${() => tocar(nom)}>
            <span style=${{ width: '9px', height: '9px', borderRadius: '3px', background: COLORES[i % COLORES.length], flexShrink: 0 }}></span>
            <span style=${{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${nom}</span>
            <b class="num">${Math.round(total ? val / total * 100 : 0)}%</b>
          <//>`)}
        <//>
      <//>
      ${detalle && html`<div class="dato-cuenta" style=${{ marginTop: '8px', textAlign: 'center', background: 'var(--chip)', borderRadius: '10px', padding: '8px' }}>
        <b>${detalle.nom}</b> · <span class="num">${fmtConMoneda(detalle.val, principal)}</span>
        · ${Math.round(total ? detalle.val / total * 100 : 0)}% · ${detalle.n} movimiento${detalle.n === 1 ? '' : 's'}
      <//>`}
    <//>`}
  </div>`;
}

/* ---------- Barras: ingreso vs gasto proyectado, mes a mes ---------- */
function ChartBarrasFuturo({ S, fl, principal, horizonte }) {
  const porMes = new Map();
  for (const f of fl.lista) {
    const clave = f.fecha.slice(0, 7);
    const e = porMes.get(clave) || { in: 0, out: 0 };
    const montoP = convertir(f.monto, f.moneda, principal, S.tasas, f.fecha);
    if (f.tipo === 'ingreso') e.in += montoP;
    else if (f.tipo === 'gasto') e.out += montoP;
    else { e.in += montoP; e.out += (f.montoDestino ? convertir(f.montoDestino, f.monedaDestino || f.moneda, principal, S.tasas, f.fecha) : montoP); }
    porMes.set(clave, e);
  }
  const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...meses.flatMap(([, e]) => [e.in, e.out]));
  const W = 320, H = 170, PB = 26, PT = 8;
  const bw = W / Math.max(1, meses.length);

  return html`<div>
    <h3 style=${{ fontSize: '11px' }}>Ingreso vs gasto proyectado · por mes</h3>
    <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}>
      ${meses.map(([clave, e], i) => {
        const hi = (H - PB - PT) * e.in / max;
        const ho = (H - PB - PT) * e.out / max;
        const nomMes = MESES3[+clave.slice(5, 7) - 1] + (clave.slice(2, 4));
        return html`<g key=${clave}>
          <rect x=${i * bw + 3} y=${H - PB - hi} width=${bw / 2 - 4} height=${Math.max(2, hi)} rx="3" fill="var(--ingreso)" opacity=".9">
            <title>Ingresos ${nomMes}: ${fmtConMoneda(e.in, principal)}</title>
          </rect>
          <rect x=${i * bw + bw / 2 + 1} y=${H - PB - ho} width=${bw / 2 - 4} height=${Math.max(2, ho)} rx="3" fill="var(--gasto)" opacity=".9">
            <title>Gastos ${nomMes}: ${fmtConMoneda(e.out, principal)}</title>
          </rect>
          <text x=${i * bw + bw / 2} y=${H - 14} textAnchor="middle" style=${{ fontSize: '7px' }} fill="var(--muted)">${nomMes}</text>
          ${i % 2 === 0 && html`<text x=${i * bw + bw / 2} y=${H - 4} textAnchor="middle" style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtCompacto(Math.max(e.in, e.out), principal)}</text>`}
        </g>`;
      })}
    </svg>
    <div style=${{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
      <span>🟩 Ingresos</span><span>🟥 Gastos</span>
    </div>
    ${meses.length === 0 && html`<div class="vacio">Sin movimientos futuros aún en el horizonte de ${horizonte} mes(es).</div>`}
  </div>`;
}

/* ---------- Gráfica de flujo interactiva ----------
   Un dedo = desplazarse SIEMPRE; pellizco (dos dedos) o botones = zoom.
   Ventana por defecto: 1 mes alrededor de hoy. Eje X legible: días ("10 sep")
   con zoom, meses ("sep", "sep 26" en ventanas largas). */
function ChartFlujo({ fl, principal }) {
  const W = 320, H = 250, PL = 8, PR = 8, PT = 14, PB = 16;
  const wrap = useRef(null);
  const punteros = useRef(new Map());
  const modo = useRef(null); // 'pan' | 'pinch' — fijo hasta soltar todos los dedos
  const [ventana, setVentana] = useState(null); // null = mes actual
  const [lectura, setLectura] = useState(null);

  const tMs = iso => +new Date(iso + 'T12:00');
  const tDesde = tMs(fl.desdeD), tHasta = tMs(fl.hastaD), tHoy = tMs(fl.hoyD);
  const DIA = 86400000;
  const clampVentana = (nIniMs, nFinMs) => {
    const MIN_DIAS = 14;
    let a = Math.max(tDesde, nIniMs), b = Math.min(tHasta, nFinMs);
    if ((b - a) / DIA < MIN_DIAS) {
      const c = (a + b) / 2;
      a = Math.max(tDesde, c - MIN_DIAS * DIA / 2); b = Math.min(tHasta, c + MIN_DIAS * DIA / 2);
    }
    const iso = t => { const dd = new Date(t); return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`; };
    return { ini: iso(a), fin: iso(b) };
  };
  const porDefecto = clampVentana(tHoy - 15 * DIA, tHoy + 15 * DIA);

  useEffect(() => { setVentana(null); setLectura(null); }, [fl.desdeD, fl.hastaD, fl.hoyD]);

  const ini = ventana ? ventana.ini : porDefecto.ini;
  const fin = ventana ? ventana.fin : porDefecto.fin;
  const tIni = tMs(ini), tFin = tMs(fin);
  const diasVentana = Math.max(1, Math.round((tFin - tIni) / DIA));
  const paso = Math.max(1, Math.round(diasVentana / 130));

  // series visibles: pasado real (≤ hoy) con muestreo adaptativo + futuro exacto
  const visPas = [];
  for (let i = 0; i < fl.seriePasado.length; i++) {
    const p = fl.seriePasado[i];
    if (p.fecha < ini) continue;
    if (p.fecha > fl.hoyD) break;
    if (i % paso === 0 || p.fecha === fl.hoyD || i === fl.seriePasado.length - 1) visPas.push(p);
  }
  const visFut = fl.serie.filter(p => p.fecha >= (ini > fl.hoyD ? ini : fl.hoyD) && p.fecha <= fin);

  const vals = [...visPas, ...visFut].map(p => p.balance).concat([0]);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const margen = (maxV - minV) * 0.08 || 1000;
  const lo = minV - margen, hi = maxV + margen;
  const X = iso => PL + (tMs(iso) - tIni) / (tFin - tIni || 1) * (W - PL - PR);
  const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const linea = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.fecha).toFixed(1)},${Y(p.balance).toFixed(1)}`).join(' ');
  const xHoy = X(fl.hoyD);
  const compacto = v => fmtCompacto(v, principal);

  const zoom = factor => {
    const c = (tIni + tFin) / 2, span = (tFin - tIni) * factor;
    setVentana(clampVentana(c - span / 2, c + span / 2));
  };

  const balanceEn = fechaISO => {
    if (fechaISO <= fl.hoyD) {
      let mejor = fl.seriePasado[0];
      for (const p of fl.seriePasado) { if (p.fecha <= fechaISO) mejor = p; else break; }
      return mejor?.balance ?? fl.balanceHoy;
    }
    let b = fl.balanceHoy;
    for (const p of fl.serie) { if (p.fecha <= fechaISO) b = p.balance; else break; }
    return b;
  };
  const actualizarLectura = e => {
    const r = wrap.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const t = tIni + frac * (tFin - tIni);
    const dd = new Date(t);
    const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
    setLectura({ fecha: iso, balance: balanceEn(iso) });
  };

  const bajar = e => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* sin captura: el gesto igual funciona */ }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    modo.current = punteros.current.size >= 2 ? 'pinch' : 'pan';
    actualizarLectura(e);
  };
  const moverGesto = e => {
    const prev = punteros.current.get(e.pointerId);
    if (!prev) { actualizarLectura(e); return; }
    const ps = punteros.current;
    const ancho = wrap.current.getBoundingClientRect().width || 1;
    if (modo.current === 'pinch' && ps.size >= 2) {
      const ids = [...ps.keys()];
      const otro = ps.get(ids.find(k => k !== e.pointerId));
      const distPrev = Math.hypot(prev.x - otro.x, prev.y - otro.y) || 1;
      const distNow = Math.hypot(e.clientX - otro.x, e.clientY - otro.y) || 1;
      const rect = wrap.current.getBoundingClientRect();
      const midFrac = Math.min(1, Math.max(0, ((e.clientX + otro.x) / 2 - rect.left) / rect.width));
      const spanNuevo = (tFin - tIni) / Math.max(0.1, distNow / distPrev);
      const anchor = tIni + midFrac * (tFin - tIni);
      setVentana(clampVentana(anchor - midFrac * spanNuevo, anchor - midFrac * spanNuevo + spanNuevo));
    } else {
      // un dedo: desplazar SIEMPRE (nunca zoom)
      const dDias = (prev.x - e.clientX) / ancho * diasVentana;
      setVentana(clampVentana(tIni - dDias * DIA, tFin - dDias * DIA));
    }
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    actualizarLectura(e);
  };
  const subir = e => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size === 0) modo.current = null;
    else if (punteros.current.size === 1) modo.current = 'pan';
  };

  // marcas del eje X legibles: días al acercar, meses completos (con año si toca)
  const marcas = [];
  const anyoCruzado = new Date(ini + 'T12:00').getFullYear() !== new Date(fin + 'T12:00').getFullYear();
  if (diasVentana > 75) {
    const cur = new Date(ini + 'T12:00'); cur.setDate(1);
    let n = 0;
    for (; tMs(isoD2(cur)) <= tFin; cur.setMonth(cur.getMonth() + 1)) {
      const iso = isoD2(cur);
      if (tMs(iso) < tIni) continue;
      const conAnyo = anyoCruzado || diasVentana > 400;
      if (conAnyo && n++ % 2 === 1) continue;
      marcas.push({ x: X(iso), nom: MESES3[cur.getMonth()] + (conAnyo ? ' ' + String(cur.getFullYear()).slice(2) : '') });
    }
  } else {
    const pasoMarca = Math.max(1, Math.round(diasVentana / 7));
    const cur = new Date(ini + 'T12:00');
    for (; tMs(isoD2(cur)) <= tFin; cur.setDate(cur.getDate() + pasoMarca)) {
      marcas.push({ x: X(isoD2(cur)), nom: `${cur.getDate()} ${MESES3[cur.getMonth()]}` });
    }
  }

  // eje Y: líneas de referencia con valores legibles
  const ticksY = [1, 2, 3].map(i => lo + (hi - lo) * (i / 4));

  return html`<div class="flujo-chart" ref=${wrap}
    onPointerDown=${bajar} onPointerMove=${moverGesto} onPointerUp=${subir} onPointerCancel=${subir} onPointerLeave=${subir}>
    <svg viewBox=${`0 0 ${W} ${H}`}>
      ${ticksY.map((v, i) => html`<g key=${'y' + i}>
        <line x1=${PL} x2=${W - PR} y1=${Y(v)} y2=${Y(v)} stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" opacity=".7" />
        <text x=${PL + 2} y=${Y(v) - 2} style=${{ fontSize: '6px' }} fill="var(--muted)">${compacto(v)}</text>
      </g>`)}
      ${hi > 0 && html`<line x1=${PL} x2=${W - PR} y1=${Y(0)} y2=${Y(0)} stroke="var(--line)" stroke-width="1" />`}
      ${ini <= fl.hoyD && fin >= fl.hoyD && html`<line x1=${xHoy} x2=${xHoy} y1=${PT} y2=${H - PB} stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3" />`}
      ${ini <= fl.hoyD && fin >= fl.hoyD && html`<text x=${xHoy + 3} y=${PT - 4} style=${{ fontSize: '6px' }} fill="var(--muted)">hoy</text>`}
      ${marcas.map((m, i) => html`<text key=${i} x=${m.x} y=${H - 5} style=${{ fontSize: '6px' }} textAnchor="middle" fill="var(--muted)">${m.nom}</text>`)}
      ${visPas.length > 1 && html`<path d=${linea(visPas)} fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" />`}
      ${visFut.length > 0 && html`<path d=${linea(visFut)} fill="none" stroke="var(--transfer)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" />`}
      ${visFut.slice(1).map((p, i) => html`<circle key=${i} cx=${X(p.fecha)} cy=${Y(p.balance)} r="2.8" fill="var(--transfer)">
        <title>${p.fecha}: ${fmtConMoneda(p.balance, principal)}</title>
      <//>`)}
      ${visPas.length > 0 && html`<circle cx=${X(visPas.at(-1).fecha)} cy=${Y(visPas.at(-1).balance)} r="3.6" fill="var(--accent)">
        <title>${visPas.at(-1).fecha}: ${fmtConMoneda(visPas.at(-1).balance, principal)}</title>
      <//>`}
      ${lectura && html`<line x1=${X(lectura.fecha)} x2=${X(lectura.fecha)} y1=${PT} y2=${H - PB}
        stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="4 3" opacity=".8" />`}
      ${lectura && html`<circle cx=${X(lectura.fecha)} cy=${Y(lectura.balance)} r="4.2" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5" />`}
    </svg>
    <div class="flujo-zoom">
      <button onClick=${e => { e.stopPropagation(); zoom(0.6); }} aria-label="Acercar">＋</button>
      <button onClick=${e => { e.stopPropagation(); zoom(1 / 0.6); }} aria-label="Alejar">−</button>
      <button onClick=${e => { e.stopPropagation(); setVentana(null); }} aria-label="Mes actual">↺</button>
    </div>
    ${lectura && html`<div class="flujo-lectura num">
      <span style=${{ opacity: .7 }}>Neto ${fmtFechaCorta(lectura.fecha)}</span> · ${fmtConMoneda(lectura.balance, principal)}
    <//>`}
  </div>`;
}

const isoD2 = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtFechaCorta = f => {
  const d = deISO(f);
  return `${d.getDate()} ${MESES3[d.getMonth()]}`;
};

/* ---------- Tarjeta carrusel: Día / Estructura / Fijos ----------
   Se puede deslizar horizontalmente o tocar las pestañas. La clasificación
   fijo/variable viene de estructuraRango (transacciones reales vs reglas fijas). */
function TarjetaDia({ serie, est, etiqueta, principal, cuenta = null, S, todo, vista, setVista }) {
  // En alcance pasivo (tarjeta/deuda) el carrusel cuenta la historia de la
  // deuda: gasto del período, compromiso de cuotas y deuda en el tiempo.
  // `vista`/`setVista` vienen de la vista: los indicadores siguen al slide.
  const pasiva = !!cuenta && (cuenta.tipo === 'tarjeta' || cuenta.tipo === 'deuda');
  const VISTAS = pasiva
    ? [['dia', 'Día'], ['cuotas', 'Cuotas'], ['deuda', 'Deuda']]
    : [['dia', 'Día'], ['estructura', 'Estructura'], ['cobertura', 'Fijos']];
  const orden = VISTAS.map(v => v[0]);
  const cardRef = useRef(null);
  const trackRef = useRef(null);
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  // Swipe que SIGUE AL DEDO con pointer events (patrón probado en iOS por el
  // Segmentado y el Sheet): el carrusel va con el dedo y al soltar, un
  // arrastre decidido pasa a la vista contigua. Se navega deslizando o
  // tocando los puntos inferiores.
  useEffect(() => {
    const card = cardRef.current;
    const track = trackRef.current;
    if (!card || !track) return;
    // candado de dirección: la primera decisión (vertical vs horizontal) es
    // definitiva — un scroll vertical con deriva horizontal NUNCA cambia slide
    let activo = false, vertical = null, x0 = 0, y0 = 0, idx0 = 0, w = 1;
    const abajo = e => {
      if (!e.isPrimary) return;
      activo = true; vertical = null; x0 = e.clientX; y0 = e.clientY;
      w = card.getBoundingClientRect().width || 1;
      idx0 = orden.indexOf(vistaRef.current);
      try { card.setPointerCapture(e.pointerId); } catch { /* sin captura: el gesto igual funciona */ }
    };
    const mover = e => {
      if (!activo || !e.isPrimary) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (vertical === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // zona muerta inicial
        vertical = Math.abs(dy) > Math.abs(dx);             // decide el dominante
        if (vertical) return;                               // scroll: el slide no se toca
      } else if (vertical) return;
      const d = Math.min(idx0 * w, Math.max(-(orden.length - 1 - idx0) * w, dx));
      track.style.transition = 'none';
      track.style.transform = `translateX(calc(${-idx0 * 100}% + ${d}px))`;
    };
    const soltar = e => {
      if (!activo) return;
      activo = false;
      if (vertical) return; // gesto vertical: jamás cambia de slide
      const dx = e.clientX - x0;
      track.style.transition = '';
      const umbral = Math.max(50, w * 0.18);
      const target = Math.abs(dx) > umbral
        ? Math.min(orden.length - 1, Math.max(0, idx0 + (dx < 0 ? 1 : -1)))
        : idx0;
      track.style.transform = `translateX(-${target * 100}%)`;
      if (target !== idx0) setVista(orden[target]);
    };
    card.addEventListener('pointerdown', abajo);
    card.addEventListener('pointermove', mover);
    card.addEventListener('pointerup', soltar);
    card.addEventListener('pointercancel', soltar);
    return () => {
      card.removeEventListener('pointerdown', abajo);
      card.removeEventListener('pointermove', mover);
      card.removeEventListener('pointerup', soltar);
      card.removeEventListener('pointercancel', soltar);
    };
    // re-vincular cuando cambia el tipo de alcance: `orden` vive en esta
    // clausura y debe coincidir siempre con las vistas actuales
  }, [pasiva]);

  const TITULOS = pasiva ? {
    dia: { dia: 'Gasto por día', semana: 'Gasto por semana', mes: 'Gasto por mes' }[serie.gran],
    cuotas: 'Cuotas por mes',
    deuda: 'Deuda en el tiempo',
  } : {
    dia: { dia: 'Gasto por día', semana: 'Gasto por semana', mes: 'Gasto por mes' }[serie.gran],
    estructura: 'Fijo vs variable · ' + etiqueta,
    cobertura: 'Cobertura de tus fijos',
  };
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = '';
    track.style.transform = `translateX(-${orden.indexOf(vista) * 100}%)`;
  }, [vista]);
  const idx = Math.max(0, orden.indexOf(vista));
  const r = est ? Math.round(est.fijoOut ? est.fijoIn / est.fijoOut * 100 : 0) : 0;
  const barra = (nom, val, color, maxV) => html`<div key=${nom} class="barra-fila">
    <div class="info"><span style=${{ fontSize: '12.5px' }}>${nom}</span><span class="num">${fmtConMoneda(val, principal)}</span></div>
    <div class="pista"><div class="lleno" style=${{ width: (val / maxV * 100) + '%', background: color }}></div></div>
  </div>`;
  const maxV = Math.max(1, est.fijoIn, est.varIn, est.fijoOut, est.varOut);

  return html`<div class="tarjeta tarjeta-carrusel" ref=${cardRef} style=${{ touchAction: 'pan-y' }}>
    <h3>${TITULOS[vista]}</h3>
    <div class="carrusel">
      <div class="carrusel-track" ref=${trackRef}>
        <div class="carrusel-slide">
          ${serie.datos.some(d => d.monto > 0)
            ? html`<${ChartGasto} datos=${serie.datos} principal=${principal} />`
            : html`<div class="vacio">Sin gastos en este período.</div>`}
        <//>
        ${pasiva ? html`
        <div class="carrusel-slide">
          <${ChartCuotasMes} S=${S} cuenta=${cuenta} principal=${principal} />
        <//>
        <div class="carrusel-slide">
          <${ChartDeuda} cuenta=${cuenta} S=${S} todo=${todo} principal=${principal} />
        <//>` : html`
        <div class="carrusel-slide">
          ${barra('Ingresos fijos', est.fijoIn, 'var(--ingreso)', maxV)}
          ${barra('Ingresos variables', est.varIn, 'var(--ingreso)', maxV)}
          ${barra('Gastos fijos', est.fijoOut, 'var(--gasto)', maxV)}
          ${barra('Gastos variables', est.varOut, 'var(--gasto)', maxV)}
          <div class="dato-cuenta" style=${{ marginTop: '6px' }}>
            ${est.varOut > est.fijoOut && est.fijoOut > 0 ? 'Tus gastos fijos son bajos: lo fuerte está en lo variable — ahí está tu espacio de ahorro.'
              : est.fijoOut > est.varOut && est.fijoOut > 0 ? 'Tus gastos fijos dominan el mes: son tu base a cubrir sí o sí.'
              : 'Sin gastos fijos registrados en este período.'}
          <//>
        <//>
        <div class="carrusel-slide" style=${{ textAlign: 'center', padding: '8px 0 4px' }}>
          ${!est.tieneReglas && html`<div class="vacio">Configura tus ingresos y gastos fijos en Inicio (＋ Fijos) para ver este análisis.</div>`}
          ${est.tieneReglas && est.fijoOut === 0 && html`<div class="vacio">En este período no tuviste gastos fijos: tus ingresos fijos quedaron enteros.</div>`}
          ${est.tieneReglas && est.fijoOut > 0 && html`<div>
            <div style=${{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Tus ingresos fijos cubren</div>
            <div class="num" style=${{ fontSize: '34px', fontWeight: 800, color: r >= 100 ? 'var(--ingreso)' : r >= 80 ? 'var(--warn)' : 'var(--gasto)' }}>${r}%</div>
            <div style=${{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '8px' }}>de tus gastos fijos (${fmtConMoneda(est.fijoIn, principal)} / ${fmtConMoneda(est.fijoOut, principal)})</div>
            <div class="barra-fila"><div class="pista"><div class="lleno" style=${{ width: Math.min(100, r) + '%', background: r >= 100 ? 'var(--ingreso)' : r >= 80 ? 'var(--warn)' : 'var(--gasto)' }}></div></div></div>
            <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
              ${r >= 100 ? 'Tus fijos se pagan solos: estabilidad sólida.'
                : r >= 80 ? 'Casi: depende un poco de tus ingresos variables.'
                : 'Riesgo: vives mayormente de ingresos variables; si fallan, tus fijos no se cubren.'}
            <//>
          <//>`}
        <//>`}
      <//>
    <//>
    <div class="carrusel-puntos">
      ${orden.map(v => html`<button key=${v} type="button" aria-label=${TITULOS[v]}
        class=${'carrusel-punto' + (v === vista ? ' activo' : '')} onClick=${() => setVista(v)}><//>`)}
    <//>
  </div>`;
}


/* ---------- Gráficas de la vista Resumen ---------- */
/* Barras de gasto del período: el SVG escala proporcional al ancho (sin espacio
   muerto lateral) y las etiquetas se formatean en la moneda real, no en
   centavos. Eje Y dentro del área para alinear las barras con la tarjeta. */
function ChartGasto({ datos, principal }) {
  const W = 320, H = 215, PL = 8, PR = 8, PT = 14, PB = 16;
  const altoPlot = H - PT - PB;
  const sim = monedaInfo(principal).simbolo;
  // tope "redondo" para que las etiquetas del eje Y sean legibles (ej. 2.5k)
  const niceCeil = v => {
    const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };
  const n = datos.length;
  const max = Math.max(1, ...datos.map(d => d.monto));
  const tope = niceCeil(max);
  const alto = v => Math.max(2, v / tope * altoPlot);
  const X = i => PL + (i + 0.5) * (W - PL - PR) / n;
  const bw = Math.max(2, (W - PL - PR) / n - 2);
  const etqVal = v => (sim.length <= 2 ? sim : '') + fmtCompacto(v, principal);

  // valores sobre las barras: todos si hay pocos, si no solo los altos (el
  // máximo siempre) para que no se amontonen
  const conMonto = datos.map((d, i) => [i, d.monto]).filter(([, m]) => m > 0);
  const mostrar = new Set(conMonto.length <= 8 ? conMonto.map(([i]) => i)
    : conMonto.filter(([, m]) => alto(m) >= altoPlot * 0.55).map(([i]) => i));
  if (conMonto.length) {
    mostrar.add(conMonto.reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
  }

  // marcas del eje X: equiespaciadas + inicios de mes + hoy, sin choques
  const pasoX = Math.max(1, Math.ceil(n / 7));
  const want = new Set();
  datos.forEach((d, i) => { if (i % pasoX === 0 || d.mesNuevo || d.esHoy) want.add(i); });
  const marcasX = [];
  for (const i of [...want].sort((a, b) => a - b)) {
    if (!marcasX.length || X(i) - X(marcasX[marcasX.length - 1]) >= 26) marcasX.push(i);
  }
  const ticksY = [tope / 2, tope];

  return html`<svg viewBox=${`0 0 ${W} ${H}`}
    style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}>
    ${ticksY.map((v, i) => html`<line key=${'g' + i} x1=${PL} x2=${W - PR} y1=${H - PB - alto(v)} y2=${H - PB - alto(v)}
      stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" />`)}
    <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--line)" stroke-width="1" />
    ${datos.map((d, i) => {
      const h = alto(d.monto);
      return html`<rect key=${i} x=${X(i) - bw / 2} y=${H - PB - h} width=${bw} height=${h} rx="2.5"
        fill=${d.monto ? 'var(--gasto)' : 'var(--chip)'} opacity=${d.monto ? 1 : .55}>
        <title>${d.largo}: ${fmtConMoneda(d.monto, principal)}</title>
      <//>`;
    })}
    ${ticksY.map((v, i) => html`<text key=${'y' + i} x=${PL + 2} y=${H - PB - alto(v) - 2.5}
      style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtCompacto(v, principal)}</text>`)}
    ${[...mostrar].map(i => html`<text key=${'v' + i} x=${Math.max(14, Math.min(W - 14, X(i)))} y=${H - PB - alto(datos[i].monto) - 3}
      textAnchor="middle" style=${{ fontSize: '6.5px', fontWeight: 700 }} fill="var(--gasto)">${etqVal(datos[i].monto)}</text>`)}
    ${marcasX.map(i => { const d = datos[i]; return html`<text key=${'x' + i}
      x=${Math.max(12, Math.min(W - 12, X(i)))} y=${H - 5} textAnchor="middle"
      style=${{ fontSize: '7px', fontWeight: d.esHoy ? 800 : 400 }} fill=${d.esHoy ? 'var(--accent)' : 'var(--muted)'}>${d.etq}</text>`; })}
  </svg>`;
}

/* Cuotas por mes (alcance tarjeta/deuda): compromiso mensual hacia adelante.
   Los planes se agotan solos, así que las barras bajan solas hasta cero —
   se ve cuándo quedas libre de compromisos. Ámbar: advertencia dulce. */
function ChartCuotasMes({ S, cuenta, principal }) {
  const datos = cuotasPorMes(cuenta.id, S.cuotas, S.tasas, principal, 6);
  const hay = datos.some(d => d.total > 0);
  if (!hay) return html`<div class="vacio">Sin cuotas activas: los planes que registres en Inicio (＋ Cuota) aparecerán aquí.</div>`;
  const W = 320, H = 215, PL = 8, PR = 8, PT = 14, PB = 16;
  const altoPlot = H - PT - PB;
  const max = Math.max(1, ...datos.map(d => d.total));
  const tope = max; // meses discretos: no hace falta redondear el tope
  const X = i => PL + (i + 0.5) * (W - PL - PR) / datos.length;
  const bw = Math.max(6, (W - PL - PR) / datos.length - 6);
  const alto = v => v / tope * altoPlot;
  const etqMes = clave => MESES3[+clave.slice(5, 7) - 1];
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}>
    ${[tope / 2, tope].map((v, i) => html`<line key=${i} x1=${PL} x2=${W - PR} y1=${H - PB - alto(v)} y2=${H - PB - alto(v)}
      stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" />`)}
    <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--line)" stroke-width="1" />
    ${datos.map((d, i) => html`<rect key=${i} x=${X(i) - bw / 2} y=${H - PB - alto(d.total)} width=${bw}
      height=${Math.max(d.total > 0 ? 3 : 0, alto(d.total))} rx="3" fill="var(--warn)" opacity=${d.total ? .95 : 0}>
      <title>${etqMes(d.clave)}: ${fmtConMoneda(d.total, principal)}</title>
    <//>`)}
    ${[tope / 2, tope].map((v, i) => html`<text key=${'y' + i} x=${PL + 2} y=${H - PB - alto(v) - 2.5}
      style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtCompacto(v, principal)}</text>`)}
    ${datos.map((d, i) => d.total > 0 && html`<text key=${'v' + i} x=${X(i)} y=${H - PB - alto(d.total) - 3}
      textAnchor="middle" style=${{ fontSize: '6.5px', fontWeight: 700 }} fill="var(--warn)">${fmtCompacto(d.total, principal)}</text>`)}
    ${datos.map((d, i) => html`<text key=${'x' + i} x=${X(i)} y=${H - 5} textAnchor="middle"
      style=${{ fontSize: '7px' }} fill=${i === 0 ? 'var(--accent)' : 'var(--muted)'}>${etqMes(d.clave)}</text>`)}
  <//>`;
}

/* Deuda en el tiempo (alcance tarjeta/deuda): línea del saldo negativo de la
   cuenta, Y hacia arriba = más deuda. Rojo: la cuenta es deuda. */
function ChartDeuda({ cuenta, S, todo, principal }) {
  const desdeD = sumarMesClave(claveMesActual(), -5) + '-01';
  const serie = serieSaldos({ cuentas: S.cuentas, txs: todo, tasas: S.tasas, principal, desdeD, hastaD: isoDia(), cuentaId: cuenta.id })
    .map(p => ({ fecha: p.fecha, deuda: -p.balance }));
  const hay = serie.some(p => p.deuda !== 0);
  if (!hay) return html`<div class="vacio">Sin deuda en estos meses.</div>`;
  const W = 320, H = 215, PL = 8, PR = 8, PT = 16, PB = 16;
  const vals = serie.map(p => p.deuda);
  const maxV = Math.max(...vals), minV = Math.min(...vals, 0);
  const margen = (maxV - minV) * 0.08 || 1000;
  const lo = minV - margen, hi = Math.max(maxV + margen, 1000);
  const X = i => PL + i / (serie.length - 1 || 1) * (W - PL - PR);
  const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const paso = Math.max(1, Math.round(serie.length / 120));
  const vis = serie.filter((_, i) => i % paso === 0 || i === serie.length - 1);
  const linea = vis.map((p, i) => `${i ? 'L' : 'M'}${X(serie.indexOf(p)).toFixed(1)},${Y(p.deuda).toFixed(1)}`).join(' ');
  const area = `M${X(serie.indexOf(vis[0]))},${Y(0).toFixed(1)} ` +
    vis.map(p => `L${X(serie.indexOf(p)).toFixed(1)},${Y(p.deuda).toFixed(1)}`).join(' ') +
    ` L${X(serie.length - 1)},${Y(0).toFixed(1)} Z`;
  const marcas = [];
  for (let i = 1; i < serie.length; i++) {
    if (serie[i].fecha.slice(8, 10) === '01' && serie[i].fecha.slice(5, 7) !== serie[0].fecha.slice(5, 7)) {
      marcas.push({ x: X(i), nom: MESES3[+serie[i].fecha.slice(5, 7) - 1] });
    }
  }
  const ultimo = serie[serie.length - 1];
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}>
    <line x1=${PL} x2=${W - PR} y1=${Y(0)} y2=${Y(0)} stroke="var(--line)" stroke-width="1" />
    ${hi * 0.75 > 0 && html`<line x1=${PL} x2=${W - PR} y1=${Y(hi / 2)} y2=${Y(hi / 2)} stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" />`}
    ${html`<text x=${PL + 2} y=${Y(hi / 2) - 2.5} style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtCompacto(hi / 2, principal)}</text>`}
    <path d=${area} fill="var(--gasto)" opacity=".07" />
    <path d=${linea} fill="none" stroke="var(--gasto)" stroke-width="2.2" stroke-linejoin="round" />
    <circle cx=${X(serie.length - 1)} cy=${Y(ultimo.deuda)} r="3.6" fill="var(--gasto)">
      <title>hoy: ${fmtConMoneda(ultimo.deuda, principal)}</title>
    <//>
    ${html`<text x=${Math.min(W - PR - 2, X(serie.length - 1) + 5)} y=${Math.max(10, Y(ultimo.deuda) - 5)}
      textAnchor="end" style=${{ fontSize: '7px', fontWeight: 700 }} fill="var(--gasto)">hoy ${fmtCompacto(ultimo.deuda, principal)}</text>`}
    ${marcas.filter((_, i) => i % 1 === 0).map((m, i) => html`<text key=${i} x=${m.x} y=${H - 5} textAnchor="middle"
      style=${{ fontSize: '7px' }} fill="var(--muted)">${m.nom}</text>`)}
  <//>`;
}

function Tendencia({ datos, max }) {
  const W = 320, H = 110, n = datos.length, bw = W / n;
  const alto = v => v / max * (H - 22);
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}>
    ${datos.map((m, i) => {
      const cx = i * bw;
      const hg = alto(m.gasto), hi = alto(m.ingreso);
      const mes = +m.clave.slice(5, 7);
      return html`<g key=${m.clave}>
        <rect x=${cx + 2} y=${H - 14 - hg} width=${(bw - 4) / 2} height=${hg} rx="2" fill="var(--gasto)" opacity=".85">
          <title>${fmtMesLargo(m.clave)} · gasto ${fmtMonto(m.gasto, 2)}</title>
        </rect>
        <rect x=${cx + 2 + (bw - 4) / 2} y=${H - 14 - hi} width=${(bw - 4) / 2} height=${hi} rx="2" fill="var(--ingreso)" opacity=".85">
          <title>${fmtMesLargo(m.clave)} · ingreso ${fmtMonto(m.ingreso, 2)}</title>
        </rect>
        ${mes === 1 || mes === 6 || mes === 12 || i === 0 || i === n - 1
          ? html`<text x=${cx + bw / 2} y=${H - 2} style=${{ fontSize: '7px' }} textAnchor="middle" fill="var(--muted)">${['', 'e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'][mes]}</text>`
          : null}
      </g>`;
    })}
  </svg>`;
}
