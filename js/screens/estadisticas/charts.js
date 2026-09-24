
import { html, useState } from '../../../vendor/preact-standalone.module.js';
import { cuotasPorMes, serieSaldos } from '../../model.js';
import { fmtConMoneda, fmtMonto, fmtCompacto, monedaInfo, isoDia, sumarMesClave, claveMesActual, fmtMesLargo } from '../../util.js';
import { MESES3 } from './fechas.js';
/* ---------- Gráficas de la vista Resumen ---------- */

/* Etiqueta al tocar: los <title> nativos son casi invisibles en táctil, así
   que cada elemento tocado muestra su dato completo en una etiqueta
   minimalista anclada a él. La posición llega en unidades del viewBox y se
   convierte a % del contenedor — por eso cada gráfica envuelve su SVG en un
   div relativo. `filas`: [{ t, color }] con el valor en negrita. */
export function EtiquetaGrafica({ x, y, titulo, filas = [], W, H }) {
  const px = Math.max(0, Math.min(100, x / W * 100));
  const py = Math.max(0, Math.min(100, y / H * 100));
  // cerca de un borde la etiqueta se ancla a él; cerca del techo, se abre hacia abajo
  const ladoX = px < 26 ? '0%' : px > 74 ? '-100%' : '-50%';
  const arriba = py > 34;
  return html`<div class="etq-grafica" style=${{
    left: px + '%', top: py + '%',
    transform: `translate(${ladoX}, ${arriba ? 'calc(-100% - 7px)' : '7px'})`
  }}>
    ${titulo && html`<div class="tit">${titulo}<//>`}
    ${filas.map((f, i) => html`<div key=${i} class="fila-etq num" style=${{ color: f.color || 'var(--text)' }}>${f.t}<//>`)}
  <//>`;
}

/** Índice tocado a partir del click: traduce la X del dedo al viewBox y de
 *  ahí a la banda del elemento (barras o punto más cercano). */
const indiceTocado = (e, W, n, PL = 0, PR = 0) => {
  const r = e.currentTarget.getBoundingClientRect();
  const vx = (e.clientX - r.left) / r.width * W;
  return Math.max(0, Math.min(n - 1, Math.floor((vx - PL) / ((W - PL - PR) / n))));
};

/* Barras de gasto del período: el SVG escala proporcional al ancho (sin espacio
   muerto lateral) y las etiquetas se formatean en la moneda real, no en
   centavos. Eje Y dentro del área para alinear las barras con la tarjeta.
   Toca una barra: fecha completa, monto exacto y su peso en el período. */
export function ChartGasto({ datos, principal }) {
  const [toc, setToc] = useState(null);
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
  const totalP = datos.reduce((s, d) => s + d.monto, 0);

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

  const dToc = toc != null && toc < n ? datos[toc] : null;

  return html`<div style=${{ position: 'relative' }} onClick=${e => {
    const i = indiceTocado(e, W, n, PL, PR);
    setToc(t => (t === i ? null : i));
  }}>
    <svg viewBox=${`0 0 ${W} ${H}`}
      style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}`, display: 'block' }}>
    ${ticksY.map((v, i) => html`<line key=${'g' + i} x1=${PL} x2=${W - PR} y1=${H - PB - alto(v)} y2=${H - PB - alto(v)}
      stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" />`)}
    <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--line)" stroke-width="1" />
    ${datos.map((d, i) => {
      const h = alto(d.monto);
      return html`<rect key=${i} x=${X(i) - bw / 2} y=${H - PB - h} width=${bw} height=${h} rx="2.5"
        fill=${d.monto ? 'var(--gasto)' : 'var(--chip)'} opacity=${d.monto ? 1 : .55}
        stroke=${toc === i ? 'var(--text)' : 'none'} stroke-width="1">
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
  </svg>
  ${dToc && html`<${EtiquetaGrafica} x=${X(toc)} y=${H - PB - alto(dToc.monto) - 2} titulo=${dToc.largo} W=${W} H=${H}
    filas=${[
      { t: fmtConMoneda(dToc.monto, principal), color: dToc.monto ? 'var(--gasto)' : 'var(--muted)' },
      ...(dToc.monto && totalP ? [{ t: Math.round(dToc.monto / totalP * 100) + '% del período', color: 'var(--muted)' }] : [])
    ]} />`}
  <//>`;
}

/* Cuotas por mes (alcance tarjeta/deuda): compromiso mensual hacia adelante.
   Los planes se agotan solos, así que las barras bajan solas hasta cero —
   se ve cuándo quedas libre de compromisos. Ámbar: advertencia dulce.
   Toca un mes: el compromiso exacto de ese mes. */
export function ChartCuotasMes({ S, cuenta, principal }) {
  const [toc, setToc] = useState(null);
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
  const n = datos.length;
  const dToc = toc != null && toc < n ? datos[toc] : null;
  return html`<div style=${{ position: 'relative' }} onClick=${e => {
    const i = indiceTocado(e, W, n, PL, PR);
    setToc(t => (t === i ? null : i));
  }}>
    <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}`, display: 'block' }}>
    ${[tope / 2, tope].map((v, i) => html`<line key=${i} x1=${PL} x2=${W - PR} y1=${H - PB - alto(v)} y2=${H - PB - alto(v)}
      stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" />`)}
    <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--line)" stroke-width="1" />
    ${datos.map((d, i) => html`<rect key=${i} x=${X(i) - bw / 2} y=${H - PB - alto(d.total)} width=${bw}
      height=${Math.max(d.total > 0 ? 3 : 0, alto(d.total))} rx="3" fill="var(--warn)" opacity=${d.total ? .95 : 0}
      stroke=${toc === i ? 'var(--text)' : 'none'} stroke-width="1">
      <title>${etqMes(d.clave)}: ${fmtConMoneda(d.total, principal)}</title>
    <//>`)}
    ${[tope / 2, tope].map((v, i) => html`<text key=${'y' + i} x=${PL + 2} y=${H - PB - alto(v) - 2.5}
      style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtCompacto(v, principal)}</text>`)}
    ${datos.map((d, i) => d.total > 0 && html`<text key=${'v' + i} x=${X(i)} y=${H - PB - alto(d.total) - 3}
      textAnchor="middle" style=${{ fontSize: '6.5px', fontWeight: 700 }} fill="var(--warn)">${fmtCompacto(d.total, principal)}</text>`)}
    ${datos.map((d, i) => html`<text key=${'x' + i} x=${X(i)} y=${H - 5} textAnchor="middle"
      style=${{ fontSize: '7px' }} fill=${i === 0 ? 'var(--accent)' : 'var(--muted)'}>${etqMes(d.clave)}</text>`)}
  <//>
  ${dToc && html`<${EtiquetaGrafica} x=${X(toc)} y=${H - PB - alto(dToc.total) - 2}
    titulo=${fmtMesLargo(dToc.clave)} W=${W} H=${H}
    filas=${[{ t: fmtConMoneda(dToc.total, principal), color: 'var(--warn)' }]} />`}
  <//>`;
}

/* Deuda en el tiempo (alcance tarjeta/deuda): línea del saldo negativo de la
   cuenta, Y hacia arriba = más deuda. Rojo: la cuenta es deuda.
   Toca la línea: la deuda de ese día y cuánto cambió en los últimos 30. */
export function ChartDeuda({ cuenta, S, todo, principal }) {
  const [toc, setToc] = useState(null);
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
  const iToc = toc != null && toc < serie.length ? toc : null;
  const pToc = iToc != null ? serie[iToc] : null;
  const prevToc = iToc != null ? serie[Math.max(0, iToc - 30)] : null;
  const dif = pToc && prevToc && pToc.deuda !== prevToc.deuda ? pToc.deuda - prevToc.deuda : null;
  return html`<div style=${{ position: 'relative' }} onClick=${e => {
    // punto más cercano a la X tocada (la serie es diaria y densa)
    const r = e.currentTarget.getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(serie.length - 1, Math.round((vx - PL) / (W - PL - PR) * (serie.length - 1))));
    setToc(t => (t === i ? null : i));
  }}>
    <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}`, display: 'block' }}>
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
    ${pToc && html`<circle cx=${X(iToc)} cy=${Y(pToc.deuda)} r="4" fill="var(--gasto)" stroke="var(--card)" stroke-width="1.5" />`}
    ${marcas.filter((_, i) => i % 1 === 0).map((m, i) => html`<text key=${i} x=${m.x} y=${H - 5} textAnchor="middle"
      style=${{ fontSize: '7px' }} fill="var(--muted)">${m.nom}</text>`)}
  <//>
  ${pToc && html`<${EtiquetaGrafica} x=${X(iToc)} y=${Y(pToc.deuda)}
    titulo=${`${+pToc.fecha.slice(8, 10)} ${MESES3[+pToc.fecha.slice(5, 7) - 1]}`} W=${W} H=${H}
    filas=${[
      { t: fmtConMoneda(pToc.deuda, principal), color: 'var(--gasto)' },
      ...(dif != null ? [{ t: (dif > 0 ? '+' : '−') + fmtConMoneda(Math.abs(dif), principal) + ' en 30 días', color: dif > 0 ? 'var(--gasto)' : 'var(--ingreso)' }] : [])
    ]} />`}
  <//>`;
}

/* Tendencia mensual gasto/ingreso. Toca un mes: los tres números del mes. */
export function Tendencia({ datos, max }) {
  const [toc, setToc] = useState(null);
  const W = 320, H = 110, n = datos.length, bw = W / n;
  const alto = v => v / max * (H - 22);
  const m = toc != null && toc < n ? datos[toc] : null;
  const neto = m ? m.ingreso - m.gasto : 0;
  return html`<div style=${{ position: 'relative' }} onClick=${e => {
    const i = indiceTocado(e, W, n);
    setToc(t => (t === i ? null : i));
  }}>
    <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}`, display: 'block' }}>
    ${datos.map((mm, i) => {
      const cx = i * bw;
      const hg = alto(mm.gasto), hi = alto(mm.ingreso);
      const mes = +mm.clave.slice(5, 7);
      return html`<g key=${mm.clave}>
        <rect x=${cx + 2} y=${H - 14 - hg} width=${(bw - 4) / 2} height=${hg} rx="2" fill="var(--gasto)" opacity=".85"
          stroke=${toc === i ? 'var(--text)' : 'none'} stroke-width="0.8">
          <title>${fmtMesLargo(mm.clave)} · gasto ${fmtMonto(mm.gasto, 2)}</title>
        </rect>
        <rect x=${cx + 2 + (bw - 4) / 2} y=${H - 14 - hi} width=${(bw - 4) / 2} height=${hi} rx="2" fill="var(--ingreso)" opacity=".85"
          stroke=${toc === i ? 'var(--text)' : 'none'} stroke-width="0.8">
          <title>${fmtMesLargo(mm.clave)} · ingreso ${fmtMonto(mm.ingreso, 2)}</title>
        </rect>
        ${mes === 1 || mes === 6 || mes === 12 || i === 0 || i === n - 1
          ? html`<text x=${cx + bw / 2} y=${H - 2} style=${{ fontSize: '7px' }} textAnchor="middle" fill="var(--muted)">${['', 'e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'][mes]}</text>`
          : null}
      </g>`;
    })}
  <//>
  ${m && html`<${EtiquetaGrafica} x=${toc * bw + bw / 2} y=${H - 14 - Math.max(alto(m.gasto), alto(m.ingreso))}
    titulo=${fmtMesLargo(m.clave)} W=${W} H=${H}
    filas=${[
      { t: 'Gasto ' + fmtMonto(m.gasto, 2), color: 'var(--gasto)' },
      { t: 'Ingreso ' + fmtMonto(m.ingreso, 2), color: 'var(--ingreso)' },
      { t: 'Neto ' + (neto >= 0 ? '+' : '−') + fmtMonto(Math.abs(neto), 2), color: neto >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }
    ]} />`}
  <//>`;
}
