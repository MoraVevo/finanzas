import { isoDia, deISO, fmtMesLargo, claveMesActual, sumarMesClave, rangoMes } from '../../util.js';

export const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ---------- Filtro de período ---------- */
export const PRESETS_RANGO = [
  ['mes', 'Este mes'],
  ['mes-pasado', 'Mes pasado'],
  ['3m', '3 meses'],
  ['6m', '6 meses'],
  ['anio', 'Este año'],
];

/** Preset -> [desde, hasta) en ISO local (hasta exclusivo). */
export function rangoPreset(tipo) {
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

export const diaDe = iso => iso.slice(0, 10);
/** Último día INCLUSIVO de un rango cuyo 'hasta' es exclusivo. */
export const finInclusivo = hasta => isoDia(new Date(+deISO(hasta) - 86400000));
export const fmtDiaMes = iso => { const d = deISO(iso); return `${d.getDate()} ${MESES3[d.getMonth()]}`; };

export const isoD2 = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fmtFechaCorta = f => {
  const d = deISO(f);
  return `${d.getDate()} ${MESES3[d.getMonth()]}`;
};

/** Etiqueta corta del período: "septiembre" / "2026" / "1 jul – 30 sep". */
export function etiquetaRango(desde, hasta) {
  const d = diaDe(desde), h = finInclusivo(hasta);
  if (d.slice(0, 7) === h.slice(0, 7)) return fmtMesLargo(d.slice(0, 7));
  if (d.endsWith('-01-01') && h.endsWith('-12-31')) return d.slice(0, 4);
  return `${fmtDiaMes(d)} – ${fmtDiaMes(h)}`;
}

/** Serie de gasto del período, agregada por día (≤2 meses), semana (≤2 años)
 *  o mes. Cada punto trae etiqueta de eje, descripción larga y si contiene hoy. */
export function serieGasto(desde, hasta, porDia) {
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
