
import { html } from '../../../vendor/preact-standalone.module.js';
import { cuotasPorMes, serieSaldos } from '../../model.js';
import { fmtConMoneda, fmtMonto, fmtCompacto, monedaInfo, isoDia, sumarMesClave, claveMesActual, fmtMesLargo } from '../../util.js';
import { MESES3 } from './fechas.js';
/* ---------- Gráficas de la vista Resumen ---------- */
/* Barras de gasto del período: el SVG escala proporcional al ancho (sin espacio
   muerto lateral) y las etiquetas se formatean en la moneda real, no en
   centavos. Eje Y dentro del área para alinear las barras con la tarjeta. */
export function ChartGasto({ datos, principal }) {
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
export function ChartCuotasMes({ S, cuenta, principal }) {
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
export function ChartDeuda({ cuenta, S, todo, principal }) {
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

export function Tendencia({ datos, max }) {
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
