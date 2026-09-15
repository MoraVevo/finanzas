// Pantalla Inicio: tu situación de un vistazo + próximos pagos fijos (poder
// adquisitivo teórico) + acceso inmediato a registrar.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { saldoConvertido, statsMes, TIPOS_CUENTA, convertir, poderAdquisitivo, planCuotas, cuentaEnPatrimonio, fechasFijo } from '../model.js';
import { FilaTx, Sheet, Segmentado } from '../ui.js';
import { IconoCuenta, ICONO_AJUSTES } from '../iconos.js';
import { fmtConMoneda, fmtFecha, claveMesActual, rangoMes, fmtMesLargo, uid, textoAEntero, enteroATexto, isoDia } from '../util.js';

export default function Hoy() {
  const S = useStore();
  const [txs, setTxs] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [programadas, setProgramadas] = useState(null); // null | { tab: 'fijos'|'cuotas', nueva? }

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
  const clave = claveMesActual();
  const [desde, hasta] = rangoMes(clave);
  // historial completo: el neto con terceros necesita su saldo previo al mes
  const stats = statsMes(clave, txs, S);
  const presupuestoTotal = S.presupuestos.reduce((s, pr) => s + pr.monto, 0);
  const pct = presupuestoTotal ? Math.min(100, stats.gasto / presupuestoTotal * 100) : 0;
  const excedido = presupuestoTotal && stats.gasto > presupuestoTotal;
  const pa = poderAdquisitivo({ fijos: S.fijos, cuotas: S.cuotas, cuentas: S.cuentas, txs, tasas: S.tasas, principal });
  const fijosActivos = S.fijos.filter(f => f.activa !== false);

  /* ---- Tarjeta principal: dinero real y si alcanza hasta el próximo ingreso ---- */
  const activas = S.cuentas.filter(c => !c.archivada);
  const debito = activas.filter(c => cuentaEnPatrimonio(c) && c.tipo !== 'tarjeta' && c.tipo !== 'deuda');
  const tarjetas = activas.filter(c => c.tipo === 'tarjeta');
  const prestamos = activas.filter(c => c.tipo === 'deuda');
  const suma = lista => lista.reduce((s, c) => s + saldoConvertido(c, txs, S.tasas, principal), 0);
  const liquido = suma(debito);
  const debeTarjetas = -suma(tarjetas);
  const debePrestamos = -suma(prestamos);
  // Horizonte y efectividad de los fijos. El fijo del día se considera efectivo
  // desde la mañana: un ingreso que ocurre hoy ya suma al disponible (salvo que
  // ya esté registrado como movimiento real, para no duplicarlo), y la ventana
  // corre hasta el SIGUIENTE pago. Un gasto fijo de hoy sigue pendiente salvo
  // que ya exista un movimiento equivalente registrado hoy.
  const hoyD = isoDia();
  const mananaD = isoDia(new Date(Date.parse(hoyD + 'T12:00') + 86400000));
  const en60 = isoDia(new Date(Date.parse(hoyD + 'T12:00') + 60 * 86400000));
  const ingresos = fijosActivos.filter(f => f.tipo === 'ingreso');
  const montoP = (monto, moneda) => convertir(monto, moneda, principal, S.tasas, hoyD);
  const cubiertoHoy = (tipo, mp) => {
    const tol = Math.max(100, Math.round(mp * 0.01));
    return txs.some(t => t.tipo === tipo && t.fecha.slice(0, 10) === hoyD
      && Math.abs(montoP(t.monto, t.moneda) - mp) <= tol);
  };
  // ingresos fijos que ocurren hoy y aún no están registrados
  const lleganHoy = ingresos.filter(r => fechasFijo(r, hoyD, hoyD).includes(hoyD))
    .map(r => ({ nombre: r.nombre || 'Ingreso fijo', montoP: montoP(r.monto, r.moneda) }))
    .filter(r => !cubiertoHoy('ingreso', r.montoP));
  const efectivoHoy = lleganHoy.reduce((s, r) => s + r.montoP, 0);
  const liquidoHoy = liquido + efectivoHoy;
  // próximo ingreso ESTRICTAMENTE después de hoy (el de hoy ya está en el número)
  const proximoPago = ingresos.map(r => fechasFijo(r, mananaD, en60)[0])
    .filter(Boolean).sort()[0] || null;
  const hastaD = proximoPago || isoDia(new Date(Date.parse(hoyD + 'T12:00') + 15 * 86400000));
  const porPagar = pa.rows
    .filter(r => r.tipo === 'gasto' && r.fecha >= hoyD && r.fecha <= hastaD)
    .filter(r => r.fecha !== hoyD || !cubiertoHoy('gasto', r.montoP))
    .reduce((s, r) => s + r.montoP, 0);
  const trasPagos = liquidoHoy - porPagar;

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
        <button class="btn-icono" aria-label="Ajustes" onClick=${() => nav('#/ajustes')}>${ICONO_AJUSTES}</button>
      </div>
    </div>

    <div class="tarjeta" style=${{ textAlign: 'center', padding: '20px 16px' }}>
      <div style=${{ fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Dinero disponible</div>
      <div class="num" style=${{ fontSize: '34px', fontWeight: 800, margin: '4px 0 2px' }}>${fmtConMoneda(liquidoHoy, principal)}</div>
      ${efectivoHoy > 0 && html`<div style=${{ fontSize: '12.5px', color: 'var(--ingreso)', fontWeight: 700 }}>
        + ${fmtConMoneda(efectivoHoy, principal)} de hoy (${lleganHoy.map(r => r.nombre).join(', ')})
      </div>`}
      ${debito.length > 1 && html`<div style=${{ fontSize: '12.5px', color: 'var(--muted)' }}>en ${debito.length} cuentas de débito</div>`}
      <div style=${{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.55 }}>
        ${porPagar > 0 ? html`
          <span style=${{ color: 'var(--muted)' }}>${proximoPago
            ? `Fijos hasta tu próximo ingreso (${fmtFecha(hastaD)})`
            : `Fijos de los próximos 15 días (hasta ${fmtFecha(hastaD)})`}:</span>
          <b class="num" style=${{ color: 'var(--gasto)' }}>−${fmtConMoneda(porPagar, principal)}</b><br/>
          ${trasPagos >= 0
            ? html`<span style=${{ color: 'var(--muted)' }}>te sobraría </span><b class="num" style=${{ color: 'var(--ingreso)' }}>${fmtConMoneda(trasPagos, principal)}</b>`
            : html`<span style=${{ color: 'var(--muted)' }}>te faltaría </span><b class="num" style=${{ color: 'var(--gasto)' }}>${fmtConMoneda(-trasPagos, principal)}</b>`}`
        : html`<span style=${{ color: 'var(--muted)' }}>${fijosActivos.some(f => f.tipo === 'gasto')
          ? 'Nada fijo por pagar en este período.'
          : 'Sin gastos fijos: prográmalos abajo (＋) para saber si te alcanza.'}</span>`}
      </div>
      <div class="chips-scroll" style=${{ marginTop: '12px', justifyContent: 'center' }}>
        ${debito.length > 0 && html`<button class="chip" onClick=${() => nav('#/cuentas')}>
          <${IconoCuenta} tipo="bancaria" /> Débito <span class="num">${fmtConMoneda(liquido, principal)}</span>
        </button>`}
        ${debeTarjetas > 0 && html`<button class="chip" onClick=${() => nav('#/cuentas')}>
          <${IconoCuenta} tipo="tarjeta" /> Tarjetas <span class="num" style=${{ color: 'var(--gasto)' }}>−${fmtConMoneda(debeTarjetas, principal)}</span>
        </button>`}
        ${debePrestamos > 0 && html`<button class="chip" onClick=${() => nav('#/cuentas')}>
          <${IconoCuenta} tipo="deuda" /> Préstamos <span class="num" style=${{ color: 'var(--gasto)' }}>−${fmtConMoneda(debePrestamos, principal)}</span>
        </button>`}
      </div>
    </div>

    <div class="tarjeta">
      <h3>${fmtMesLargo(clave)} · en ${principal}</h3>
      <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Ingresos</div>
          <div class="num m-ingreso" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.ingreso, principal)}</div>
        </div>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Egresos</div>
          <div class="num m-gasto" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.gasto + stats.aTerceros, principal)}</div>
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
        <h3 style=${{ marginBottom: 0 }}>Movimientos programados</h3>
        <button class="chip" aria-label="Programar movimiento" onClick=${() => setProgramadas({ tab: 'fijos' })}>＋</button>
      </div>
      <div class="dato-cuenta" style=${{ marginBottom: '6px' }}>
        Teórico · hoy: <b class="num">${fmtConMoneda(pa.base, principal)}</b> disponibles${fijosActivos.length ? '' : ' — configura tus ingresos y gastos fijos'}
      </div>
      ${pa.rows.slice(0, 10).map(r => {
        const esDeuda = r.tipo === 'deuda';
        const fuenteC = esDeuda ? S.cuentas.find(c => c.id === r.fuente) : null;
        return html`<div key=${r.fecha + r.fijoId + r.nombre} class=${'fila fila-pago ' + (esDeuda ? '' : r.ok ? 'fila-pago-ok' : 'fila-pago-falta')}>
          <div class="cuerpo">
            <div class="titulo">${r.nombre}</div>
            <div class="sub">${esDeuda
              ? `${fmtFecha(r.fecha)} · va a tu ${fuenteC ? (TIPOS_CUENTA[fuenteC.tipo].nombre.toLowerCase() + ' ' + fuenteC.nombre) : 'tarjeta'}`
              : r.esCuota
                ? `${fmtFecha(r.fecha)} · cuota ${r.cuotaK} de ${r.cuotaN}`
                : html`${fmtFecha(r.fecha)} · quedaría <span class="num" style=${{ color: r.balanceDespues < 0 ? 'var(--gasto)' : 'inherit', fontWeight: r.balanceDespues < 0 ? 700 : 400 }}>${fmtConMoneda(r.balanceDespues, principal)}</span>`}</div>
          </div>
          <div class="monto num ${r.tipo === 'ingreso' ? 'm-ingreso' : 'm-gasto'}">
            ${r.tipo === 'gasto' ? '−' : '+'}${fmtConMoneda(r.montoP, principal)}
          </div>
        </div>`;
      })}
      ${pa.rows.length === 0 && html`<div class="vacio">
        Ej.: <b>Salario</b> cada mes el día 10, <b>Celular</b> el día 11.<br/>
        Así la app te dice si te alcanzará para cada pago.
      <//>`}
      ${pa.rows.some(r => !r.ok) && html`<div class="dato-cuenta" style=${{ marginTop: '6px', color: 'var(--warn)' }}>
        En amarillo, los pagos que tu dinero no cubre a tiempo.
      <//>`}
      ${pa.rows.length > 10 && html`<div class="dato-cuenta" style=${{ marginTop: '6px' }}>Mostrando los próximos 10 — el resto vive en tus programas.</div>`}
      ${pa.rows.length > 0 && html`<div class="dato-cuenta" style=${{ marginTop: '6px' }}>Solo considera tus fijos y cuotas — no los gastos de cada día.</div>`}
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

    ${programadas && html`<${Sheet} titulo="Movimientos programados" onClose=${() => setProgramadas(null)}>
      <${PanelProgramadas} S=${S} tab=${programadas.tab} nueva=${programadas.nueva} cerrar=${() => setProgramadas(null)} />
    <//>`}
  </div>`;
}

/* ---------- Panel: programados (fijos y cuotas) ---------- */
function PanelProgramadas({ S, tab, nueva, cerrar }) {
  const [pestana, setPestana] = useState(tab || 'fijos');
  return html`<div>
    <${Segmentado} opciones=${[['fijos', 'Fijos'], ['cuotas', 'Cuotas']]} valor=${pestana} onChange=${setPestana} />
    <div style=${{ marginTop: '12px' }}>
      ${pestana === 'cuotas' ? html`<${PanelCuotas} S=${S} nueva=${nueva} cerrar=${cerrar} />` : html`<${PanelFijos} S=${S} cerrar=${cerrar} />`}
    </div>
  </div>`;
}

/* ---------- Panel: cuotas (planes de pago finitos) ---------- */
function PanelCuotas({ S, nueva, cerrar }) {
  const [edit, setEdit] = useState(nueva ? { cuentaId: null } : null);
  if (edit) return html`<${EditorCuota} p=${edit} S=${S} cerrar=${() => setEdit(null)} />`;
  const lista = [...S.cuotas].sort((a, b) => (a.activa === false ? 1 : 0) - (b.activa === false ? 1 : 0));
  return html`<div>
    <div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      Compras financiadas o préstamos: cada mes se cobra la cuota hasta agotar el
      plan y desaparece solo. Registra la compra como gasto con la tarjeta para
      que tu límite la refleje.
    </div>
    ${lista.map(p => {
      const info = planCuotas(p);
      const cta = S.cuentas.find(c => c.id === p.cuentaId);
      return html`<div key=${p.id} class="fila" onClick=${() => setEdit(p)}>
        <div class="cuerpo">
          <div class="titulo">${p.nombre || 'Cuotas'}${cta ? html` · <span class="sub" style=${{ display: 'inline' }}>${cta.nombre}</span>` : ''}</div>
          <div class="sub">${info.terminado ? '✓ completado'
            : info.vencidas === 0 ? `primera cuota: ${fmtFecha(info.proxima.fecha)}`
            : `próxima: ${fmtFecha(info.proxima.fecha)} · cuota ${Math.min(info.vencidas + 1, info.n)} de ${info.n}`}</div>
          <div class="barra-fila" style=${{ margin: '7px 0 0' }}>
            <div class="pista"><div class="lleno" style=${{ width: Math.min(100, Math.round(info.pagado / p.montoTotal * 100)) + '%' }}></div></div>
          </div>
          <div class="dato-cuenta num" style=${{ marginTop: '3px' }}>${fmtConMoneda(info.pagado, p.moneda)} de ${fmtConMoneda(p.montoTotal, p.moneda)}</div>
        </div>
        <div class="monto num ${info.terminado ? 'm-ingreso' : 'm-gasto'}">
          ${info.terminado ? '✓' : '−' + fmtConMoneda(info.montoK(info.proxima ? info.proxima.k : info.n), p.moneda)}
        </div>
      </div>`;
    })}
    ${lista.length === 0 && html`<div class="vacio">Aún no tienes cuotas.</div>`}
    <button class="btn btn-suave" style=${{ marginTop: '10px' }} onClick=${() => setEdit({ cuentaId: null })}>＋ Nueva cuota</button>
  </div>`;
}

/* ---------- Editor de plan de cuotas (también lo usa Cuentas al crear una
   tarjeta/deuda nueva: ofrecer programar el pago desde el inicio) ---------- */
export function EditorCuota({ p, S, cerrar }) {
  const [d, setD] = useState({
    nombre: p.nombre || '', cuentaId: p.cuentaId || null,
    montoTotal: p.montoTotal ? enteroATexto(p.montoTotal, 2) : '',
    numCuotas: p.numCuotas ? String(p.numCuotas) : '',
    moneda: p.moneda || S.ajustes.monedaPrincipal,
    primeraFecha: p.primeraFecha || isoDia(),
  });
  const set = x => setD({ ...d, ...x });
  const pasivas = S.cuentas.filter(c => !c.archivada && (c.tipo === 'tarjeta' || c.tipo === 'deuda'));
  const n = parseInt(d.numCuotas, 10);
  const montoTotal = textoAEntero(d.montoTotal || '0', 2);
  const preview = montoTotal && n >= 1
    ? `${fmtConMoneda(Math.floor(montoTotal / n), d.moneda)}${montoTotal % n ? ` (última: ${fmtConMoneda(montoTotal - Math.floor(montoTotal / n) * (n - 1), d.moneda)})` : ''}`
    : null;

  const guardar = async () => {
    if (!montoTotal) { toast('Escribe el monto total financiado'); return; }
    if (!(n >= 1 && n <= 120)) { toast('Número de cuotas inválido (1-120)'); return; }
    if (!d.cuentaId) { toast('Elige la tarjeta o crédito donde se paga'); return; }
    await fin.guardarCuota({
      id: p.id || uid(), nombre: d.nombre.trim() || null, cuentaId: d.cuentaId,
      montoTotal, numCuotas: n, moneda: d.moneda,
      primeraFecha: d.primeraFecha || isoDia(),
      activa: p.activa !== false, creadoEn: p.creadoEn || new Date().toISOString()
    });
    await recargar();
    toast('✓ Cuota guardada');
    cerrar();
  };

  const borrar = async () => {
    if (!p.id || !confirm('¿Eliminar este plan de cuotas? Los pagos ya pasados quedan en tus movimientos.')) return;
    await fin.borrarCuota(p.id);
    await recargar();
    toast('Eliminado');
    cerrar();
  };

  return html`<div>
    <div style=${{ display: 'grid', gap: '8px' }}>
      <input placeholder="Nombre (Laptop, Préstamo personal…)" value=${d.nombre} onInput=${e => set({ nombre: e.target.value })} />
      <div style=${{ display: 'flex', gap: '8px' }}>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">Monto total financiado</div>
          <input inputMode="decimal" placeholder="0.00" value=${d.montoTotal} style=${{ textAlign: 'right' }}
            onInput=${e => set({ montoTotal: e.target.value })} />
        <//>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">Cuotas (meses)</div>
          <input inputMode="numeric" placeholder="Ej. 10" value=${d.numCuotas} style=${{ textAlign: 'right' }}
            onInput=${e => set({ numCuotas: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />
        <//>
      <//>
      <div>
        <div class="dato-cuenta">Se paga con</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          ${pasivas.map(c => html`<button key=${c.id} class=${'chip' + (d.cuentaId === c.id ? ' sel' : '')}
            onClick=${() => set({ cuentaId: c.id })}><${IconoCuenta} tipo=${c.tipo} /> ${c.nombre}</button>`)}
        </div>
        ${pasivas.length === 0 && html`<div class="dato-cuenta">Crea una tarjeta o deuda en la pestaña Cuentas.</div>`}
      <//>
      <div>
        <div class="dato-cuenta">Primera cuota</div>
        <input type="date" value=${d.primeraFecha} onChange=${e => e.target.value && set({ primeraFecha: e.target.value })} />
      <//>
      ${preview && html`<div class="dato-cuenta">Cuota mensual: <b class="num">${preview}</b></div>`}
    </div>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar cuota</button>
    ${p.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar plan</button>`}
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
      poder adquisitivo teórico de Inicio. Si un gasto se paga con tarjeta, elige la
      fuente y se suma a esa deuda en vez de descontar tu disponible.
    </div>
    ${lista.map(f => {
      const fu = f.fuente ? S.cuentas.find(c => c.id === f.fuente) : null;
      return html`<div key=${f.id} class="fila" onClick=${() => setEdit(f)}>
        <div class="cuerpo">
          <div class="titulo">${f.nombre || (f.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo')}</div>
          <div class="sub">${FRECV[f.frecuencia] || f.frecuencia}${f.frecuencia !== 'quincenal' ? ' · día ' + f.dia : ''} · ${f.moneda}${fu ? html` · <${IconoCuenta} tipo=${fu.tipo} /> ${fu.nombre}` : ''}${f.tipo === 'ingreso' && f.cuenta && html` · entra en ${S.cuentas.find(c => c.id === f.cuenta)?.nombre || '?'}`}${f.activa === false ? ' · inactivo' : ''}</div>
        </div>
        <div class="monto num ${f.tipo === 'ingreso' ? 'm-ingreso' : 'm-gasto'}">${f.tipo === 'ingreso' ? '+' : '−'}${fmtConMoneda(f.monto, f.moneda)}</div>
      </div>`;
    })}
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
    frecuencia: f.frecuencia || 'mensual', dia: f.dia || 15, activa: f.activa !== false,
    fuente: f.fuente || null, cuenta: f.cuenta || null
  });
  const set = p => setD({ ...d, ...p });
  const DIAS_SEM = [['0', 'D'], ['1', 'L'], ['2', 'M'], ['3', 'X'], ['4', 'J'], ['5', 'V'], ['6', 'S']];
  const fuenteObj = S.cuentas.find(c => c.id === d.fuente);
  const fuentePasiva = fuenteObj && (fuenteObj.tipo === 'tarjeta' || fuenteObj.tipo === 'deuda');
  const debitos = S.cuentas.filter(c => cuentaEnPatrimonio(c) && c.tipo !== 'tarjeta' && c.tipo !== 'deuda');
  const cuentaDest = S.cuentas.find(c => c.id === d.cuenta);

  const guardar = async () => {
    const monto = textoAEntero(d.monto || '0', 2);
    if (!monto) { toast('Escribe el monto'); return; }
    if (d.tipo === 'ingreso' && !d.cuenta) { toast('Elige la cuenta donde entra tu ingreso'); return; }
    let dia = parseInt(d.dia, 10);
    if (d.frecuencia === 'semanal') { if (!(dia >= 0 && dia <= 6)) { toast('Elige el día de la semana'); return; } }
    else { if (!(dia >= 1 && dia <= 31)) { toast('Día inválido (1-31)'); return; } }
    await fin.guardarFijo({
      id: f.id || uid(), nombre: d.nombre.trim() || null, tipo: d.tipo, monto, moneda: d.moneda,
      frecuencia: d.frecuencia, dia, activa: d.activa,
      fuente: d.tipo === 'gasto' ? (d.fuente || null) : null,
      cuenta: d.tipo === 'ingreso' ? d.cuenta : null,
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
      ${d.tipo === 'ingreso' && html`<div>
        <div class="dato-cuenta">¿A qué cuenta entra?</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          ${debitos.map(c => html`<button key=${c.id}
            class=${'chip' + (d.cuenta === c.id ? ' sel' : '')}
            onClick=${() => set({ cuenta: c.id })}><${IconoCuenta} tipo=${c.tipo} /> ${c.nombre}</button>`)}
        <//>
        ${cuentaDest && html`<div class="dato-cuenta" style=${{ marginTop: '4px' }}>
          El día que llega, el ingreso se registra solo en ${cuentaDest.nombre} — ya no lo anotas tú.
        <//>`}
        ${debitos.length === 0 && html`<div class="dato-cuenta">Crea una cuenta de débito en la pestaña Cuentas.</div>`}
      <//>`}
      ${d.tipo === 'gasto' && html`<div>
        <div class="dato-cuenta">¿Con qué se paga? (opcional)</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          <button class=${'chip' + (!d.fuente ? ' sel' : '')} onClick=${() => set({ fuente: null })}>Líquido</button>
          ${S.cuentas.filter(cuentaEnPatrimonio).map(c => html`<button key=${c.id}
            class=${'chip' + (d.fuente === c.id ? ' sel' : '')}
            onClick=${() => set({ fuente: c.id })}><${IconoCuenta} tipo=${c.tipo} /> ${c.nombre}</button>`)}
        <//>
        ${fuentePasiva && html`<div class="dato-cuenta" style=${{ marginTop: '4px' }}>
          No descuenta tu disponible: suma a la deuda de ${fuenteObj.nombre} y se paga
          con su día de pago (según su fecha de corte).
        <//>`}
      <//>`}
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
