// Estadísticas: respuestas visuales a "¿cuánto?, ¿en qué?, ¿cuándo?, ¿qué tendencia?".
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore } from '../store.js';
import { statsMes, tendencia, patrimonio, saldoConvertido, TIPOS_CUENTA } from '../model.js';
import { fmtConMoneda, fmtMonto, claveMesActual, sumarMesClave, rangoMes, fmtMesLargo } from '../util.js';

export default function Estadisticas() {
  const S = useStore();
  const [clave, setClave] = useState(claveMesActual());
  const [todo, setTodo] = useState(null); // todas las tx

  useEffect(() => {
    let vivo = true;
    fin.todasTx().then(t => vivo && setTodo(t));
    return () => { vivo = false; };
  }, [S.cuentas, S.ajustes]);

  if (!todo) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  const principal = S.ajustes.monedaPrincipal;
  const [desde, hasta] = rangoMes(clave);
  const st = statsMes(clave, todo.filter(t => t.fecha >= desde && t.fecha < hasta), S);
  const tend = tendencia(todo, S, 12);
  const p = patrimonio(S.cuentas, todo, S.tasas, principal);
  const presup = new Map(S.presupuestos.map(x => [x.categoria, x.monto]));
  const catPorId = new Map(S.categorias.map(c => [c.id, c]));
  const maxCat = Math.max(1, ...st.porCategoria.map(c => c.monto));
  const maxDia = Math.max(1, ...st.porDia.map(d => d.monto));
  const maxTend = Math.max(1, ...tend.map(m => Math.max(m.gasto, m.ingreso)));
  const { mes } = { mes: +clave.slice(5, 7) };
  const diasMes = new Date(+clave.slice(0, 4), mes, 0).getDate();
  const porEtiquetaGasto = st.porEtiqueta.filter(() => true);

  return html`<div class="vista">
    <div class="cabecera"><h1>Estadísticas</h1></div>

    <div class="nav-mes">
      <button onClick=${() => setClave(sumarMesClave(clave, -1))}>‹</button>
      <span class="mes">${fmtMesLargo(clave)}</span>
      ${clave !== claveMesActual()
        ? html`<button onClick=${() => setClave(claveMesActual())}>Hoy</button>`
        : html`<button style=${{ opacity: .3 }}>›</button>`}
    </div>

    <div class="stats-grid-3">
      <div class="stat-box"><div class="etq">Gasto</div><div class="val m-gasto">${fmtConMoneda(st.gasto, principal)}</div></div>
      <div class="stat-box"><div class="etq">Ingreso</div><div class="val m-ingreso">${fmtConMoneda(st.ingreso, principal)}</div></div>
      <div class="stat-box"><div class="etq">Neto</div><div class="val" style=${{ color: st.neto >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }}>${fmtConMoneda(st.neto, principal, true)}</div></div>
    </div>
    <div class="dato-cuenta" style=${{ textAlign: 'center', marginTop: '-8px', marginBottom: '10px' }}>
      Montos en ${principal}. Transferencias entre tus cuentas no cuentan como gasto.
    </div>

    <div class="tarjeta">
      <h3>Gasto por día</h3>
      ${ChartDias({ porDia: st.porDia, diasMes, max: maxDia, principal })}
    </div>

    <div class="tarjeta">
      <h3>Por categoría</h3>
      ${st.porCategoria.slice(0, 12).map(c => html`<div key=${c.id} class="barra-fila">
        <div class="info">
          <span>${c.emoji} ${c.nombre}${presup.get(c.id) ? html` <span class="etiqueta-mini">presup.</span>` : ''}</span>
          <span class="num">${fmtConMoneda(c.monto, principal)} · ${Math.round(c.monto / st.gasto * 100)}%</span>
        </div>
        <div class="pista"><div class="lleno" style=${{ width: (c.monto / maxCat * 100) + '%' }}></div></div>
        ${presup.get(c.id) && html`<div class="dato-cuenta" style=${{ color: c.monto > presup.get(c.id) ? 'var(--gasto)' : 'var(--muted)' }}>
          ${c.monto > presup.get(c.id) ? '⚠ excede' : 'de'} ${fmtConMoneda(presup.get(c.id), principal)} presupuestados
        <//>`}
      </div>`)}
      ${st.porCategoria.length === 0 && html`<div class="vacio">Sin gastos este mes.</div>`}
    </div>

    ${st.porCategoriaIngreso.length > 0 && html`<div class="tarjeta">
      <h3>Ingresos por categoría</h3>
      ${st.porCategoriaIngreso.map(c => html`<div key=${c.id} class="barra-fila">
        <div class="info"><span>${c.emoji} ${c.nombre}</span><span class="num">${fmtConMoneda(c.monto, principal)}</span></div>
        <div class="pista"><div class="lleno" style=${{ width: (c.monto / st.porCategoriaIngreso[0].monto * 100) + '%', background: 'var(--ingreso)' }}></div></div>
      </div>`)}
    <//>`}

    ${porEtiquetaGasto.length > 0 && html`<div class="tarjeta">
      <h3>Por actividad / etiqueta</h3>
      ${porEtiquetaGasto.map(e => html`<div key=${e.id} class="barra-fila">
        <div class="info"><span>🏷️ #${e.nombre}</span><span class="num">${fmtConMoneda(e.monto, principal)}</span></div>
        <div class="pista"><div class="lleno" style=${{ width: (e.monto / porEtiquetaGasto[0].monto * 100) + '%', background: 'var(--transfer)' }}></div></div>
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
      ${S.cuentas.filter(c => !c.archivada).map(c => html`<div key=${c.id} class="fila">
        <span class="emoji">${TIPOS_CUENTA[c.tipo].emoji}</span>
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

/* Barras por día del mes (SVG simple) */
function ChartDias({ porDia, diasMes, max, principal }) {
  const porFecha = new Map(porDia.map(d => [d.dia.slice(8), d.monto]));
  const W = 320, H = 90, bw = W / diasMes;
  const alto = v => Math.max(2, v / max * (H - 16));
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: '90px' }}>
    ${Array.from({ length: diasMes }, (_, i) => {
      const v = porFecha.get(String(i + 1).padStart(2, '0')) || 0;
      const h = alto(v);
      return html`<rect key=${i} x=${i * bw + 1} y=${H - h - 12} width=${bw - 2} height=${h} rx="2.5"
        fill=${v ? 'var(--accent)' : 'var(--chip)'} opacity=${v ? 1 : .55}>
        <title>Día ${i + 1}: ${fmtConMoneda(v, principal)}</title>
      </rect>`;
    })}
    <text x="0" y=${H - 1} fontSize="9" fill="var(--muted)">1</text>
    <text x=${W - 14} y=${H - 1} fontSize="9" fill="var(--muted)">${diasMes}</text>
  </svg>`;
}

/* Mini barras dobles gasto/ingreso por mes */
function Tendencia({ datos, max }) {
  const W = 320, H = 110, n = datos.length, bw = W / n;
  const alto = v => v / max * (H - 22);
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: '110px' }}>
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
          ? html`<text x=${cx + bw / 2} y=${H - 2} fontSize="8" textAnchor="middle" fill="var(--muted)">${['', 'e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'][mes]}</text>`
          : null}
      </g>`;
    })}
  </svg>`;
}
