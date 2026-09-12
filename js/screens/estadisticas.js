// Estadísticas: dos vistas — "Mes" (cómo fue el mes) y "Flujo" (patrimonio en el
// tiempo con los movimientos futuros que el usuario registra manualmente).
import { html, useState, useEffect, useMemo } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, recargar, toast } from '../store.js';
import { statsMes, tendencia, patrimonio, saldoConvertido, flujoEfectivo, fechasRepetir, TIPOS_CUENTA } from '../model.js';
import { Sheet } from '../ui.js';
import { fmtConMoneda, fmtMonto, textoAEntero, enteroATexto, uid, isoDia, fmtMesLargo, deISO, claveMesActual, sumarMesClave, rangoMes } from '../util.js';

export default function Estadisticas() {
  const S = useStore();
  const [vista, setVista] = useState('mes');
  const [todo, setTodo] = useState(null); // todas las tx

  useEffect(() => {
    let vivo = true;
    fin.todasTx().then(t => vivo && setTodo(t));
    return () => { vivo = false; };
  }, [S.cuentas, S.ajustes, S.futuros]);

  if (!todo) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  return html`<div class="vista">
    <div class="cabecera"><h1>Estadísticas</h1></div>
    <div class="segmentado" style=${{ marginBottom: '12px' }}>
      <button class=${vista === 'mes' ? 'sel' : ''} onClick=${() => setVista('mes')}>Este mes</button>
      <button class=${vista === 'flujo' ? 'sel' : ''} onClick=${() => setVista('flujo')}>Flujo y futuro</button>
    </div>
    ${vista === 'mes'
      ? html`<${VistaMes} S=${S} todo=${todo} />`
      : html`<${VistaFlujo} S=${S} todo=${todo} />`}
  </div>`;
}

/* ================= Vista: Mes ================= */
function VistaMes({ S, todo }) {
  const [clave, setClave] = useState(claveMesActual());
  const principal = S.ajustes.monedaPrincipal;
  const [desde, hasta] = rangoMes(clave);
  const st = statsMes(clave, todo.filter(t => t.fecha >= desde && t.fecha < hasta), S);
  const tend = tendencia(todo, S, 12);
  const p = patrimonio(S.cuentas, todo, S.tasas, principal);
  const presup = new Map(S.presupuestos.map(x => [x.categoria, x.monto]));
  const maxCat = Math.max(1, ...st.porCategoria.map(c => c.monto));
  const maxDia = Math.max(1, ...st.porDia.map(d => d.monto));
  const maxTend = Math.max(1, ...tend.map(m => Math.max(m.gasto, m.ingreso)));
  const diasMes = new Date(+clave.slice(0, 4), +clave.slice(5, 7), 0).getDate();

  return html`<div>
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
      <${ChartDias} porDia=${st.porDia} diasMes=${diasMes} max=${maxDia} principal=${principal} />
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

    ${st.porEtiqueta.length > 0 && html`<div class="tarjeta">
      <h3>Por actividad / etiqueta</h3>
      ${st.porEtiqueta.map(e => html`<div key=${e.id} class="barra-fila">
        <div class="info"><span>🏷️ #${e.nombre}</span><span class="num">${fmtConMoneda(e.monto, principal)}</span></div>
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

/* ================= Vista: Flujo y futuro ================= */
function VistaFlujo({ S, todo }) {
  const principal = S.ajustes.monedaPrincipal;
  const [horizonte, setHorizonte] = useState(6);
  const [editor, setEditor] = useState(null); // {} nueva | futuro a editar

  const fl = useMemo(() => flujoEfectivo({
    cuentas: S.cuentas, txs: todo, tasas: S.tasas, principal,
    futuros: S.futuros, pasadoMeses: 6, futuroMeses: horizonte
  }), [S.cuentas, todo, S.tasas, S.futuros, horizonte]);

  const final = fl.serie.at(-1);

  return html`<div>
    <div class="tarjeta" style=${{ textAlign: 'center', padding: '18px 14px' }}>
      <div style=${{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Hoy tienes</div>
      <div class="num" style=${{ fontSize: '30px', fontWeight: 800 }}>${fmtConMoneda(fl.balanceHoy, principal)}</div>
      <div style=${{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
        ${[3, 6, 12].map(m => html`<button key=${m} class=${'chip' + (m === horizonte ? ' sel' : '')}
          onClick=${() => setHorizonte(m)}>${m} meses</button>`)}
      </div>
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
      <h3>Tu patrimonio en el tiempo</h3>
      <${ChartFlujo} fl=${fl} principal=${principal} />
      <div style=${{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
        <span>▬ Real</span><span>┄ Registrado por ti</span>
      </div>
    </div>

    <div class="tarjeta">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style=${{ marginBottom: 0 }}>Próximos movimientos</h3>
        <button class="chip" onClick=${() => setEditor({ tipo: 'ingreso', moneda: principal, fecha: isoDia() })}>＋ Agregar</button>
      </div>
      ${fl.lista.map(f => html`<div key=${f.id} class="fila" onClick=${() => setEditor(f)}>
        <span class="emoji">${f.tipo === 'ingreso' ? '💰' : '🔻'}</span>
        <div class="cuerpo">
          <div class="titulo">${f.nombre || (f.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')}</div>
          <div class="sub">${fmtFechaCorta(f.fecha)} · después: ${fmtConMoneda(f.balanceDespues, principal)}</div>
        </div>
        <div class="monto num ${f.tipo === 'ingreso' ? 'm-ingreso' : 'm-gasto'}">${f.tipo === 'ingreso' ? '+' : '−'}${fmtConMoneda(f.monto, f.moneda)}</div>
      </div>`)}
      ${fl.lista.length === 0 && html`<div class="vacio">
        Registra lo que sabes que viene: "15 — salario +Q8,000", "31 — salario", "12 — +Q400"…<br/>
        La línea punteada te mostrará cuánto tendrás en cada fecha.
      <//>`}
      ${fl.vencidos.length > 0 && html`<div class="dato-cuenta" style=${{ marginTop: '8px' }}>
        ${fl.vencidos.length} registro(s) con fecha pasada. Si ya ocurrieron, regístralos con ＋ y bórralos de aquí.
      <//>`}
      <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
        Esto no es una predicción: son <b>tus registros</b>. La línea sólida es tu historia real; la punteada, lo que tú anotaste que viene.
      </div>
    </div>

    ${editor && html`<${Sheet} titulo=${editor.id ? 'Editar movimiento futuro' : 'Nuevo movimiento futuro'} onClose=${() => setEditor(null)}>
      <${EditorFuturo} f=${editor} S=${S} cerrar=${() => setEditor(null)} />
    <//>`}
  </div>`;
}

/* ---------- Editor de movimiento futuro ---------- */
function EditorFuturo({ f, S, cerrar }) {
  const [d, setD] = useState({
    nombre: f.nombre || '', tipo: f.tipo || 'ingreso',
    monto: f.monto ? enteroATexto(f.monto, 2) : '', moneda: f.moneda || S.ajustes.monedaPrincipal,
    fecha: f.fecha || isoDia(), repetir: 'unica'
  });
  const set = p => setD({ ...d, ...p });

  const guardar = async () => {
    const monto = textoAEntero(d.monto || '0', 2);
    if (!monto) { toast('Escribe el monto'); return; }
    if (!d.fecha) { toast('Elige la fecha'); return; }
    if (d.fecha <= isoDia() && !f.id) { toast('La fecha debe ser futura'); return; }
    const fechas = f.id ? [d.fecha] : fechasRepetir(d.fecha, d.repetir, d.repetir === 'unica' ? 1 : 6);
    for (const fecha of fechas) {
      await fin.guardarFuturo({
        id: f.id && fechas.length === 1 ? f.id : uid(),
        nombre: d.nombre.trim() || null, tipo: d.tipo, monto, moneda: d.moneda, fecha,
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
    <div class="segmentado" style=${{ marginBottom: '10px' }}>
      <button class=${d.tipo === 'ingreso' ? 'sel' : ''} onClick=${() => set({ tipo: 'ingreso' })}>💰 Ingreso</button>
      <button class=${d.tipo === 'gasto' ? 'sel' : ''} onClick=${() => set({ tipo: 'gasto' })}>🔻 Gasto</button>
    </div>
    <div style=${{ display: 'grid', gap: '8px' }}>
      <input placeholder="Nombre (ej. Salario, Alquiler…)" value=${d.nombre} onInput=${e => set({ nombre: e.target.value })} />
      <div style=${{ display: 'flex', gap: '8px' }}>
        <input style=${{ flex: 1, textAlign: 'right', fontWeight: 700 }} inputMode="decimal" placeholder="0.00"
          value=${d.monto} onInput=${e => set({ monto: e.target.value })} />
        <div class="chips-scroll" style=${{ flexShrink: 0 }}>
          ${['GTQ', 'USD'].map(m => html`<button key=${m} class=${'chip' + (d.moneda === m ? ' sel' : '')}
            onClick=${() => set({ moneda: m })}>${m}</button>`)}
        <//>
      <//>
      <div>
        <div class="dato-cuenta">¿Cuándo?</div>
        <input type="date" value=${d.fecha} onChange=${e => set({ fecha: e.target.value || isoDia() })} />
      <//>
      ${!f.id && html`<div>
        <div class="dato-cuenta">Repetir (crea 6 fechas que puedes editar por separado)</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          ${[['unica', 'Solo esta vez'], ['mensual', 'Cada mes'], ['quincenal', 'Quincenal (15 y fin de mes)']].map(([v, t]) => html`
            <button key=${v} class=${'chip' + (d.repetir === v ? ' sel' : '')} onClick=${() => set({ repetir: v })}>${t}</button>`)}
        <//>
      <//>`}
    </div>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar</button>
    ${f.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar</button>`}
  </div>`;
}

/* ---------- Gráfica de flujo (pasado sólido + futuro punteado) ---------- */
function ChartFlujo({ fl, principal }) {
  const W = 320, H = 150, PL = 6, PR = 6, PT = 10, PB = 18;
  const puntos = [...fl.pasado, ...fl.serie.slice(1)];
  const vals = puntos.map(p => p.balance).concat([0]);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const margen = (maxV - minV) * 0.08 || 1000;
  const lo = minV - margen, hi = maxV + margen;
  const t0 = new Date(fl.desdeD + 'T12:00').getTime(), t1 = new Date(fl.hastaD + 'T12:00').getTime();
  const X = f => PL + (new Date(f + 'T12:00').getTime() - t0) / (t1 - t0) * (W - PL - PR);
  const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const linea = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.fecha).toFixed(1)},${Y(p.balance).toFixed(1)}`).join(' ');
  const xHoy = X(fl.hoyD);
  const compacto = v => Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + 'k' : fmtMonto(Math.round(v / 100) * 100, 0);

  // etiquetas de mes cada ~2 meses
  const meses = [];
  let cur = new Date(fl.desdeD + 'T12:00');
  for (; cur <= new Date(fl.hastaD + 'T12:00'); cur.setMonth(cur.getMonth() + 1)) {
    if (cur.getDate() === 1) meses.push({ x: X(isoDiaLocal(cur)), nom: ['e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'][cur.getMonth()] });
  }

  return html`<svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: '150px' }}>
    ${hi > 0 && html`<line x1=${PL} x2=${W - PR} y1=${Y(0)} y2=${Y(0)} stroke="var(--line)" stroke-width="1" />`}
    <line x1=${xHoy} x2=${xHoy} y1=${PT} y2=${H - PB} stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3" />
    <text x=${xHoy + 3} y=${PT + 8} fontSize="8.5" fill="var(--muted)">hoy</text>
    <path d=${linea(fl.pasado)} fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" />
    <path d=${linea(fl.serie)} fill="none" stroke="var(--transfer)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" />
    ${fl.serie.slice(1).map((p, i) => html`<circle key=${i} cx=${X(p.fecha)} cy=${Y(p.balance)} r="2.6" fill="var(--transfer)">
      <title>${p.fecha}: ${fmtConMoneda(p.balance, principal)}</title>
    <//>`)}
    ${fl.pasado.length > 0 && html`<circle cx=${X(fl.pasado.at(-1).fecha)} cy=${Y(fl.balanceHoy)} r="3.4" fill="var(--accent)">
      <title>Hoy: ${fmtConMoneda(fl.balanceHoy, principal)}</title>
    <//>`}
    ${meses.filter((_, i) => i % 2 === 0).map((m, i) => html`<text key=${i} x=${m.x} y=${H - 5} fontSize="8.5" textAnchor="middle" fill="var(--muted)">${m.nom}</text>`)}
    <text x=${PL} y=${PT + 2} fontSize="8.5" fill="var(--muted)">${compacto(hi)}</text>
    <text x=${PL} y=${H - PB - 2} fontSize="8.5" fill="var(--muted)">${compacto(lo)}</text>
  </svg>`;
}
const isoDiaLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtFechaCorta = f => {
  const d = deISO(f);
  return `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`;
};

/* ---------- Gráficas de la vista Mes ---------- */
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
