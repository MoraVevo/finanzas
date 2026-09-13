// Estadísticas: dos vistas — "Mes" (cómo fue el mes) y "Flujo" (patrimonio en el
// tiempo con los movimientos futuros que el usuario registra manualmente).
// La gráfica de flujo es interactiva: arrastra para mover, pellizca/botones para
// zoom, con granularidad hasta diaria, y lectura al tocar.
import { html, useState, useEffect, useMemo, useRef } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, recargar, toast } from '../store.js';
import { statsMes, tendencia, patrimonio, saldoConvertido, saldoCuenta, flujoEfectivo, fechasRepetir, convertir, estructuraMes, TIPOS_CUENTA } from '../model.js';
import { Sheet, PickerCuentas, GridCategorias, Segmentado } from '../ui.js';
import { fmtConMoneda, fmtMonto, textoAEntero, enteroATexto, uid, isoDia, isoLocal, fmtMesLargo, deISO, claveMesActual, sumarMesClave, rangoMes } from '../util.js';

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
    <${Segmentado} opciones=${[['mes', 'Este mes'], ['flujo', 'Flujo y futuro']]} valor=${vista} onChange=${setVista} />
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

    <${TarjetaDia} st=${st} est=${estructuraMes(clave, todo, S)} clave=${clave} principal=${principal} />

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
  const [horizonte, setHorizonte] = useState(1);
  const [cuentaScope, setCuentaScope] = useState(null); // null = patrimonio
  const [grafica, setGrafica] = useState('linea'); // 'linea' | 'pie' | 'barras'
  const [editor, setEditor] = useState(null);

  const fl = useMemo(() => flujoEfectivo({
    cuentas: S.cuentas, txs: todo, tasas: S.tasas, principal,
    futuros: S.futuros, pasadoMeses: 6, futuroMeses: horizonte, cuentaId: cuentaScope
  }), [S.cuentas, todo, S.tasas, S.futuros, horizonte, cuentaScope]);

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
          ${TIPOS_CUENTA[c.tipo].emoji} ${c.nombre}
        </button>`)}
    </div>

    <div class="tarjeta" style=${{ textAlign: 'center', padding: '18px 14px' }}>
      <div style=${{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        ${nombreScope ? `Hoy en ${nombreScope}` : 'Hoy tienes'}
      </div>
      <div class="num" style=${{ fontSize: '30px', fontWeight: 800 }}>${fmtConMoneda(fl.balanceHoy, principal)}</div>
      <${Segmentado} opciones=${HORIZONTES.map(([m, t]) => [m, 'Proyectar ' + t])} valor=${horizonte} onChange=${setHorizonte} />
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
        const destinoF = f.tipo === 'transferencia' ? S.cuentas.find(c => c.id === f.cuentaDestino) : null;
        const esDeuda = f.tipo === 'transferencia' && destinoF && (destinoF.tipo === 'tarjeta' || destinoF.tipo === 'deuda');
        return html`<div key=${f.id} class="fila" onClick=${() => setEditor(f)}>
          <div class="cuerpo">
            <div class="titulo">${f.tipo === 'transferencia'
              ? (esDeuda ? `Pago de deuda · ${destinoF?.nombre || '?'}` : `${S.cuentas.find(c => c.id === f.cuenta)?.nombre || '?'} → ${destinoF?.nombre || '?'}`)
              : (f.nombre || (f.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))}</div>
            <div class="sub">${fmtFechaCorta(f.fecha)} · después: ${fmtConMoneda(f.balanceDespues, principal)}</div>
          </div>
          <div class=${'monto num ' + (f.tipo === 'ingreso' ? 'm-ingreso' : f.tipo === 'gasto' ? 'm-gasto' : 'm-transf')}>
            ${f.tipo === 'ingreso' ? '+' : f.tipo === 'gasto' ? '−' : '→ '}${fmtConMoneda(f.monto, f.moneda)}
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
          <button class="chip" onClick=${() => setPicker('cuenta')}>${cuentaObj ? `${TIPOS_CUENTA[cuentaObj.tipo].emoji} ${cuentaObj.nombre}` : '¿Desde qué cuenta?'}</button>
          <span style=${{ alignSelf: 'center', color: 'var(--muted)' }}>→</span>
          <button class="chip" onClick=${() => setPicker('destino')}>${destinoObj ? `${TIPOS_CUENTA[destinoObj.tipo].emoji} ${destinoObj.nombre}` : '¿Hacia dónde?'}</button>
        <//>
      <//>` : html`<div>
        <div class="dato-cuenta">Cuenta (opcional)</div>
        <div class="chips-scroll" style=${{ marginTop: '6px' }}>
          <button class="chip" onClick=${() => setPicker('cuenta')}>
            ${cuentaObj ? `${TIPOS_CUENTA[cuentaObj.tipo].emoji} ${cuentaObj.nombre}` : 'Cualquiera'}
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
  const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...meses.flatMap(([, e]) => [e.in, e.out]));
  const W = 320, H = 170, PB = 26, PT = 8;
  const bw = W / Math.max(1, meses.length);

  return html`<div>
    <h3 style=${{ fontSize: '11px' }}>Ingreso vs gasto proyectado · por mes</h3>
    <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', height: '170px' }}>
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
          ${i % 2 === 0 && html`<text x=${i * bw + bw / 2} y=${H - 4} textAnchor="middle" style=${{ fontSize: '7px' }} fill="var(--muted)">${fmtMonto(Math.round(Math.max(e.in, e.out) / 1000) * 1000, 0)}</text>`}
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
  const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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
  const compacto = v => Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + 'k' : fmtMonto(Math.round(v / 100) * 100, 0);

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
  return `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`;
};

const diasMesDe = clave => new Date(+clave.slice(0, 4), +clave.slice(5, 7), 0).getDate();

/* ---------- Tarjeta carrusel: Día / Estructura / Fijos ----------
   Se puede deslizar horizontalmente o tocar las pestañas. La clasificación
   fijo/variable viene de estructuraMes (transacciones reales vs reglas fijas). */
function TarjetaDia({ st, est, clave, principal }) {
  const VISTAS = [['dia', 'Día'], ['estructura', 'Estructura'], ['cobertura', 'Fijos']];
  const orden = VISTAS.map(v => v[0]);
  const [vista, setVista] = useState('dia');
  const cardRef = useRef(null);
  // swipe nativo directo: gestos fiables en iOS
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let x = null, y = null;
    const ini = e => { x = e.touches[0].clientX; y = e.touches[0].clientY; };
    const fin = e => {
      if (x == null) return;
      const dx = e.changedTouches[0].clientX - x;
      const dy = e.changedTouches[0].clientY - y;
      x = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
      setVista(v => {
        const i = orden.indexOf(v);
        return orden[(i + (dx < 0 ? 1 : -1) + orden.length) % orden.length];
      });
    };
    card.addEventListener('touchstart', ini, { passive: true });
    card.addEventListener('touchend', fin);
    return () => {
      card.removeEventListener('touchstart', ini);
      card.removeEventListener('touchend', fin);
    };
  }, []);

  const TITULOS = { dia: 'Gasto por día', estructura: 'Fijo vs variable · este mes', cobertura: 'Cobertura de tus fijos' };
  const idx = Math.max(0, orden.indexOf(vista));
  const r = est ? Math.round(est.fijoOut ? est.fijoIn / est.fijoOut * 100 : 0) : 0;
  const barra = (nom, val, color, maxV) => html`<div key=${nom} class="barra-fila">
    <div class="info"><span style=${{ fontSize: '12.5px' }}>${nom}</span><span class="num">${fmtConMoneda(val, principal)}</span></div>
    <div class="pista"><div class="lleno" style=${{ width: (val / maxV * 100) + '%', background: color }}></div></div>
  </div>`;
  const maxV = Math.max(1, est.fijoIn, est.varIn, est.fijoOut, est.varOut);

  return html`<div class="tarjeta" ref=${cardRef} style=${{ touchAction: 'pan-y' }}>
    <h3>${TITULOS[vista]}</h3>
    <${Segmentado} opciones=${VISTAS} valor=${vista} onChange=${setVista} />
    <div class="carrusel" style=${{ marginTop: '10px' }}>
      <div class="carrusel-track" style=${{ transform: `translateX(-${idx * 100}%)` }}>
        <div class="carrusel-slide">
          <${ChartDias} porDia=${st.porDia} diasMes=${diasMesDe(clave)} max=${Math.max(1, ...st.porDia.map(d => d.monto))} principal=${principal} />
        <//>
        <div class="carrusel-slide">
          ${barra('Ingresos fijos', est.fijoIn, 'var(--ingreso)', maxV)}
          ${barra('Ingresos variables', est.varIn, 'var(--ingreso)', maxV)}
          ${barra('Gastos fijos', est.fijoOut, 'var(--gasto)', maxV)}
          ${barra('Gastos variables', est.varOut, 'var(--gasto)', maxV)}
          <div class="dato-cuenta" style=${{ marginTop: '6px' }}>
            ${est.varOut > est.fijoOut && est.fijoOut > 0 ? 'Tus gastos fijos son bajos: lo fuerte está en lo variable — ahí está tu espacio de ahorro.'
              : est.fijoOut > est.varOut && est.fijoOut > 0 ? 'Tus gastos fijos dominan el mes: son tu base a cubrir sí o sí.'
              : 'Sin gastos fijos registrados este mes.'}
          <//>
        <//>
        <div class="carrusel-slide" style=${{ textAlign: 'center', padding: '8px 0 4px' }}>
          ${!est.tieneReglas && html`<div class="vacio">Configura tus ingresos y gastos fijos en Inicio (＋ Fijos) para ver este análisis.</div>`}
          ${est.tieneReglas && est.fijoOut === 0 && html`<div class="vacio">Este mes no tuviste gastos fijos: tus ingresos fijos quedaron enteros.</div>`}
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
        <//>
      <//>
    <//>
    <div class="carrusel-puntos">
      ${orden.map(v => html`<button key=${v} type="button" aria-label=${TITULOS[v]}
        class=${'carrusel-punto' + (v === vista ? ' activo' : '')} onClick=${() => setVista(v)}><//>`)}
    <//>
  </div>`;
}


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
    <text x="0" y=${H - 1} style=${{ fontSize: '7px' }} fill="var(--muted)">1</text>
    <text x=${W - 14} y=${H - 1} style=${{ fontSize: '7px' }} fill="var(--muted)">${diasMes}</text>
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
          ? html`<text x=${cx + bw / 2} y=${H - 2} style=${{ fontSize: '7px' }} textAnchor="middle" fill="var(--muted)">${['', 'e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'][mes]}</text>`
          : null}
      </g>`;
    })}
  </svg>`;
}
