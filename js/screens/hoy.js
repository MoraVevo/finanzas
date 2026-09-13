// Pantalla Inicio: tu situación de un vistazo + próximos pagos fijos (poder
// adquisitivo teórico) + acceso inmediato a registrar.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { patrimonio, saldoConvertido, saldoCuenta, statsMes, TIPOS_CUENTA, convertir, poderAdquisitivo } from '../model.js';
import { FilaTx, Sheet, Segmentado } from '../ui.js';
import { fmtConMoneda, fmtFecha, claveMesActual, rangoMes, fmtMesLargo, uid, textoAEntero, enteroATexto, isoDia } from '../util.js';

export default function Hoy() {
  const S = useStore();
  const [txs, setTxs] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [panelFijos, setPanelFijos] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const todas = await fin.todasTx();
      const ult = await fin.recientes(15);
      if (vivo) { setTxs(todas); setRecientes(ult); }
    })();
    return () => { vivo = false; };
  }, [S.cuentas, S.categorias, S.ajustes, S.presupuestos, S.tasas, S.fijos]);

  if (!txs) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  const principal = S.ajustes.monedaPrincipal;
  const p = patrimonio(S.cuentas, txs, S.tasas, principal);
  const clave = claveMesActual();
  const [desde, hasta] = rangoMes(clave);
  const stats = statsMes(clave, txs.filter(t => t.fecha >= desde && t.fecha < hasta), S);
  const presupuestoTotal = S.presupuestos.reduce((s, pr) => s + pr.monto, 0);
  const pct = presupuestoTotal ? Math.min(100, stats.gasto / presupuestoTotal * 100) : 0;
  const excedido = presupuestoTotal && stats.gasto > presupuestoTotal;
  const pa = poderAdquisitivo({ fijos: S.fijos, cuentas: S.cuentas, txs, tasas: S.tasas, principal });
  const fijosActivos = S.fijos.filter(f => f.activa !== false);

  // agrupar recientes por día
  const grupos = [];
  for (const tx of recientes) {
    const dia = tx.fecha.slice(0, 10);
    const g = grupos.find(x => x.dia === dia);
    if (g) { g.txs.push(tx); if (tx.tipo === 'gasto') g.gasto += convertir(tx.monto, tx.moneda, principal, S.tasas, tx.fecha); }
    else grupos.push({ dia, txs: [tx], gasto: tx.tipo === 'gasto' ? convertir(tx.monto, tx.moneda, principal, S.tasas, tx.fecha) : 0 });
  }

  return html`<div class="vista">
    <div class="cabecera">
      <h1>Inicio</h1>
      <div class="acciones">
        <button class="btn-icono" onClick=${() => nav('#/ajustes')}>⚙️</button>
      </div>
    </div>

    <div class="tarjeta" style=${{ textAlign: 'center', padding: '20px 16px' }}>
      <div style=${{ fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Patrimonio</div>
      <div class="num" style=${{ fontSize: '34px', fontWeight: 800, margin: '4px 0 2px' }}>${fmtConMoneda(p.total, principal)}</div>
      <div style=${{ fontSize: '13px', color: 'var(--muted)' }}>
        Disponible <b class="num" style=${{ color: 'var(--ingreso)' }}>${fmtConMoneda(p.disponible, principal)}</b>
        ${p.deudas > 0 && html` · Deudas <b class="num" style=${{ color: 'var(--gasto)' }}>−${fmtConMoneda(p.deudas, principal)}</b>`}
      </div>
      <div class="chips-scroll" style=${{ marginTop: '12px', justifyContent: 'center' }}>
        ${S.cuentas.filter(c => !c.archivada).map(c => html`
          <button key=${c.id} class="chip" onClick=${() => nav('#/cuentas')}>
            ${TIPOS_CUENTA[c.tipo].emoji} ${c.nombre}
            <span class="num" style=${{ color: saldoConvertido(c, txs, S.tasas, principal) < 0 ? 'var(--gasto)' : 'inherit' }}>
              ${fmtConMoneda(saldoCuenta(c, txs, S.tasas), c.moneda)}
            </span>
          </button>`)}
      </div>
    </div>

    <div class="tarjeta">
      <h3>${fmtMesLargo(clave)} · en ${principal}</h3>
      <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Gastado</div>
          <div class="num m-gasto" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.gasto, principal)}</div>
        </div>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Ingresado</div>
          <div class="num m-ingreso" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.ingreso, principal)}</div>
        </div>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Neto</div>
          <div class="num" style=${{ fontSize: '19px', fontWeight: 800, color: stats.neto >= 0 ? 'var(--ingreso)' : 'var(--gasto)' }}>${fmtConMoneda(stats.neto, principal, true)}</div>
        </div>
      </div>
      ${presupuestoTotal > 0 && html`<div style=${{ marginTop: '12px' }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px', color: excedido ? 'var(--gasto)' : 'var(--muted)' }}>
          <span>Presupuesto</span><span class="num">${fmtConMoneda(stats.gasto, principal)} / ${fmtConMoneda(presupuestoTotal, principal)}</span>
        </div>
        <div class="barra-fila"><div class="pista"><div class="lleno" style=${{ width: pct + '%', background: excedido ? 'var(--gasto)' : 'var(--accent)' }}></div></div></div>
      <//>`}
    </div>

    <div class="tarjeta">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style=${{ marginBottom: 0 }}>Próximos pagos fijos</h3>
        <button class="chip" onClick=${() => setPanelFijos(true)}>＋ Fijos</button>
      </div>
      <div class="dato-cuenta" style=${{ marginBottom: '6px' }}>
        Teórico · hoy: <b class="num">${fmtConMoneda(pa.base, principal)}</b> disponibles${fijosActivos.length ? '' : ' — configura tus ingresos y gastos fijos'}
      </div>
      ${pa.rows.map(r => html`<div key=${r.fecha + r.fijoId + r.nombre} class=${'fila fila-pago ' + (r.ok ? 'fila-pago-ok' : 'fila-pago-falta')}>
        <div class="cuerpo">
          <div class="titulo">${r.nombre}</div>
          <div class="sub">${fmtFecha(r.fecha)} · quedaría <span class="num" style=${{ color: r.balanceDespues < 0 ? 'var(--gasto)' : 'inherit', fontWeight: r.balanceDespues < 0 ? 700 : 400 }}>${fmtConMoneda(r.balanceDespues, principal)}</span></div>
        </div>
        <div class="monto num ${r.tipo === 'ingreso' ? 'm-ingreso' : 'm-gasto'}">
          ${r.tipo === 'ingreso' ? '+' : '−'}${fmtConMoneda(r.montoP, principal)}
        </div>
      </div>`)}
      ${pa.rows.length === 0 && html`<div class="vacio">
        Ej.: <b>Salario</b> cada mes el día 10, <b>Celular</b> el día 11.<br/>
        Así la app te dice si te alcanzará para cada pago.
      <//>`}
      ${pa.rows.some(r => !r.ok) && html`<div class="dato-cuenta" style=${{ marginTop: '6px', color: 'var(--warn)' }}>
        En amarillo, los pagos que tu dinero no cubre a tiempo.
      <//>`}
      ${pa.rows.length > 0 && html`<div class="dato-cuenta" style=${{ marginTop: '6px' }}>Solo considera tus fijos — no los gastos de cada día.</div>`}
    </div>

    <div class="tarjeta">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style=${{ marginBottom: 0 }}>Recientes</h3>
        <button class="chip" onClick=${() => nav('#/movimientos')}>Ver todos</button>
      </div>
      ${grupos.map(g => html`<div key=${g.dia}>
        <div class="grupo-dia">
          <span class="fecha">${fmtFecha(g.dia)}</span>
          ${g.gasto > 0 && html`<span class="total num">−${fmtConMoneda(g.gasto, principal)}</span>`}
        </div>
        ${g.txs.map(tx => html`<${FilaTx} key=${tx.id} tx=${tx} cuentas=${S.cuentas} categorias=${S.categorias}
          onClick=${() => nav('#/agregar?id=' + tx.id)} />`)}
      </div>`)}
      ${grupos.length === 0 && html`<div class="vacio">Aún no hay movimientos.<br/>Toca el botón <b>+</b> para registrar el primero.</div>`}
    </div>

    ${panelFijos && html`<${Sheet} titulo="Ingresos y gastos fijos" onClose=${() => setPanelFijos(false)}>
      <${PanelFijos} S=${S} cerrar=${() => setPanelFijos(false)} />
    <//>`}
  </div>`;
}

/* ---------- Panel: lista de fijos + editor ---------- */
function PanelFijos({ S, cerrar }) {
  const [edit, setEdit] = useState(null); // {} nueva regla | regla a editar
  const lista = [...S.fijos].sort((a, b) => (a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === 'ingreso' ? -1 : 1));

  if (edit) return html`<${EditorFijo} f=${edit} S=${S} cerrar=${() => setEdit(null)} />`;

  return html`<div>
    <div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      Reglas que se repiten sin fecha de fin: salario, alquiler, celular… Alimentan el
      poder adquisitivo teórico de Inicio.
    </div>
    ${lista.map(f => html`<div key=${f.id} class="fila" onClick=${() => setEdit(f)}>
      <div class="cuerpo">
        <div class="titulo">${f.nombre || (f.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo')}</div>
        <div class="sub">${FRECV[f.frecuencia] || f.frecuencia}${f.frecuencia !== 'quincenal' ? ' · día ' + f.dia : ''} · ${f.moneda}${f.activa === false ? ' · inactivo' : ''}</div>
      </div>
      <div class="monto num ${f.tipo === 'ingreso' ? 'm-ingreso' : 'm-gasto'}">${f.tipo === 'ingreso' ? '+' : '−'}${fmtConMoneda(f.monto, f.moneda)}</div>
    </div>`)}
    ${lista.length === 0 && html`<div class="vacio">Aún no tienes fijos.</div>`}
    <button class="btn btn-suave" style=${{ marginTop: '10px' }} onClick=${() => setEdit({ tipo: 'gasto', moneda: S.ajustes.monedaPrincipal, frecuencia: 'mensual', dia: 15 })}>＋ Nuevo fijo</button>
  </div>`;
}
const FRECV = { mensual: 'cada mes', quincenal: 'quincenal', semanal: 'cada semana' };

/* ---------- Editor de regla fija ---------- */
function EditorFijo({ f, S, cerrar }) {
  const [d, setD] = useState({
    nombre: f.nombre || '', tipo: f.tipo || 'gasto',
    monto: f.monto ? enteroATexto(f.monto, 2) : '', moneda: f.moneda || S.ajustes.monedaPrincipal,
    frecuencia: f.frecuencia || 'mensual', dia: f.dia || 15, activa: f.activa !== false
  });
  const set = p => setD({ ...d, ...p });
  const DIAS_SEM = [['0', 'D'], ['1', 'L'], ['2', 'M'], ['3', 'X'], ['4', 'J'], ['5', 'V'], ['6', 'S']];

  const guardar = async () => {
    const monto = textoAEntero(d.monto || '0', 2);
    if (!monto) { toast('Escribe el monto'); return; }
    let dia = parseInt(d.dia, 10);
    if (d.frecuencia === 'semanal') { if (!(dia >= 0 && dia <= 6)) { toast('Elige el día de la semana'); return; } }
    else { if (!(dia >= 1 && dia <= 31)) { toast('Día inválido (1-31)'); return; } }
    await fin.guardarFijo({
      id: f.id || uid(), nombre: d.nombre.trim() || null, tipo: d.tipo, monto, moneda: d.moneda,
      frecuencia: d.frecuencia, dia, activa: d.activa,
      creadoEn: f.creadoEn || new Date().toISOString()
    });
    await recargar();
    toast('✓ Fijo guardado');
    cerrar();
  };

  const borrar = async () => {
    if (!f.id || !confirm('¿Eliminar este fijo?')) return;
    await fin.borrarFijo(f.id);
    await recargar();
    toast('Eliminado');
    cerrar();
  };

  return html`<div>
    <${Segmentado} opciones=${[['ingreso', 'Ingreso fijo'], ['gasto', 'Gasto fijo']]} valor=${d.tipo} onChange=${t => set({ tipo: t })} />
    <div style=${{ display: 'grid', gap: '8px' }}>
      <input placeholder="Nombre (Salario, Alquiler, Celular…)" value=${d.nombre} onInput=${e => set({ nombre: e.target.value })} />
      <div style=${{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input style=${{ flex: '1 1 120px', minWidth: 0, textAlign: 'right', fontWeight: 700 }} inputMode="decimal" placeholder="0.00"
          value=${d.monto} onInput=${e => set({ monto: e.target.value })} />
        <div class="chips-scroll" style=${{ flexShrink: 0 }}>
          ${['GTQ', 'USD'].map(m => html`<button key=${m} class=${'chip' + (d.moneda === m ? ' sel' : '')}
            onClick=${() => set({ moneda: m })}>${m}</button>`)}
        <//>
      <//>
      <div>
        <div class="dato-cuenta">Se repite</div>
        <${Segmentado} opciones=${[['mensual', 'Cada mes'], ['quincenal', 'Quincenal'], ['semanal', 'Semanal']]} valor=${d.frecuencia} onChange=${v => set({ frecuencia: v })} />
      <//>
      ${d.frecuencia === 'semanal' ? html`<div>
        <div class="dato-cuenta">Día de la semana</div>
        <div class="chips-scroll" style=${{ marginTop: '4px' }}>
          ${DIAS_SEM.map(([v, t]) => html`<button key=${v} class=${'chip' + (+d.dia === +v ? ' sel' : '')}
            onClick=${() => set({ dia: v })}>${t}</button>`)}
        <//>
      <//>` : html`<div>
        <div class="dato-cuenta">${d.frecuencia === 'quincenal' ? 'Días 15 y fin de mes' : 'Día del mes'}</div>
        <input inputMode="numeric" placeholder="Ej. 15" value=${d.dia} style=${{ textAlign: 'right', maxWidth: '110px' }}
          onInput=${e => set({ dia: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} />
      <//>`}
    <//>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar</button>
    ${f.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar</button>`}
  </div>`;
}
