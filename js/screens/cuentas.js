// Cuentas: crear/editar tus cuentas (efectivo, banco, ahorro, tarjeta, deuda),
// con datos pre-registrados (banco, número, titular) para consultarlos al transferir.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { saldoCuenta, saldoConvertido, convertir, efectoTx, serieSaldos, planCuotas, TIPOS_CUENTA } from '../model.js';
import { Sheet, SelectorMoneda, FilaTx, Segmentado } from '../ui.js';
import { IconoCuenta, ICONO_EDITAR, ICONO_CAJA, ICONO_RESTAURAR } from '../iconos.js';
import { uid, textoAEntero, enteroATexto, fmtConMoneda, fmtCompacto, fmtFecha, isoLocal, isoDia, claveMesActual, sumarMesClave } from '../util.js';

export default function Cuentas() {
  const S = useStore();
  const [txs, setTxs] = useState(null);
  const [editor, setEditor] = useState(null);   // cuenta en edición o {} para nueva
  const [detalle, setDetalle] = useState(null); // cuenta del panel detalle

  useEffect(() => {
    let vivo = true;
    fin.todasTx().then(t => vivo && setTxs(t));
    return () => { vivo = false; };
  }, [S.cuentas]);

  if (!txs) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;
  const principal = S.ajustes.monedaPrincipal;
  const activas = S.cuentas.filter(c => !c.archivada);
  const archivadas = S.cuentas.filter(c => c.archivada);

  const copiar = async texto => {
    try { await navigator.clipboard.writeText(texto); toast('Copiado: ' + texto); }
    catch { toast('No se pudo copiar'); }
  };

  return html`<div class="vista">
    <div class="cabecera">
      <h1>Cuentas</h1>
      <div class="acciones">
        <button class="btn-icono" onClick=${() => setEditor({ tipo: 'bancaria', moneda: principal })}>＋</button>
      </div>
    </div>

    <div class="tarjeta" style=${{ paddingTop: '4px' }}>
      ${activas.map(c => html`<div key=${c.id} class="fila" onClick=${() => setDetalle(c)}>
        <span class="emoji"><${IconoCuenta} tipo=${c.tipo} /></span>
        <div class="cuerpo">
          <div class="titulo">${c.nombre}${c.tipo === 'tercero' && html`<span class="badge-tercero">No es tuyo</span>`}</div>
          <div class="sub">${[
            c.banco, c.numero && '№ ' + c.numero,
            c.tipo === 'tarjeta' && c.limite > 0 && `Disponible ${fmtConMoneda(Math.max(0, c.limite + saldoCuenta(c, txs, S.tasas)), c.moneda)}`,
            c.tipo === 'tarjeta' && c.corte && `Corte ${c.corte}`,
            c.tipo === 'tarjeta' && c.pagoDia && `Pago ${c.pagoDia}`
          ].filter(Boolean).join(' · ') || TIPOS_CUENTA[c.tipo].nombre}</div>
        </div>
        <div style=${{ textAlign: 'right' }}>
          <div class="monto num" style=${{ color: saldoCuenta(c, txs, S.tasas) < 0 ? 'var(--gasto)' : 'inherit' }}>${fmtConMoneda(saldoCuenta(c, txs, S.tasas), c.moneda)}</div>
          ${c.moneda !== principal && html`<div class="sub num">≈ ${fmtConMoneda(saldoConvertido(c, txs, S.tasas, principal), principal)}</div>`}
        </div>
      </div>`)}
      ${activas.length === 0 && html`<div class="vacio">Sin cuentas aún. Crea una con ＋</div>`}
    </div>

    ${archivadas.length > 0 && html`<div class="tarjeta">
      <h3>Archivadas</h3>
      ${archivadas.map(c => html`<div key=${c.id} class="fila" onClick=${() => setDetalle(c)}>
        <span class="emoji"><${IconoCuenta} tipo=${c.tipo} /></span>
        <div class="cuerpo"><div class="titulo">${c.nombre}</div></div>
        <button class="chip" onClick=${e => { e.stopPropagation(); reArchivar(c, false); }}>Restaurar</button>
      </div>`)}
    <//>`}

    <div class="tarjeta">
      <h3>Cómo funcionan</h3>
      <div class="dato-cuenta" style=${{ lineHeight: 1.6 }}>
        💳 Las <b>tarjetas</b> y <b>deudas</b> van en negativo: registrar un gasto con ellas aumenta tu deuda,
        y pagarlas es una <b>transferencia</b> desde tu banco — nunca un gasto doble.<br/>
        🔁 Sacar efectivo del cajero también es una transferencia.<br/>
        🏺 El <b>ahorro</b> es dinero tuyo: moverlo ahí no es un gasto.<br/>
        🤝 Las cuentas <b>de terceros</b> guardan los datos de otra persona: depositarles es una
        transferencia que sale de tu patrimonio y acumula cuánto le has depositado.
      </div>
    </div>

    ${detalle && html`<${Sheet} titulo=${detalle.nombre} onClose=${() => setDetalle(null)}>
      ${DetalleCuenta({ cuenta: S.cuentas.find(c => c.id === detalle.id) || detalle, S, txs, principal, copiar, setEditor, setDetalle, reArchivar })}
    <//>`}

    ${editor && html`<${Sheet} titulo=${editor.id ? 'Editar cuenta' : 'Nueva cuenta'} onClose=${() => setEditor(null)}>
      ${EditorCuenta({ c: editor, S, cerrar: () => setEditor(null) })}
    <//>`}
  </div>`;

  async function reArchivar(c, valor) {
    await fin.guardarCuenta({ ...c, archivada: valor });
    await recargar();
    setDetalle(null);
    toast(valor ? 'Cuenta archivada' : 'Cuenta restaurada');
  }
}

/* ---------- Detalle ---------- */
function DetalleCuenta({ cuenta, S, txs, principal, copiar, setEditor, setDetalle, reArchivar }) {
  const movs = txs
    .filter(t => t.cuenta === cuenta.id || t.cuentaDestino === cuenta.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 10);
  // filter(Boolean): sin corte/pago/bolsa quedan nulls y destructurarlas crashea el render
  const datos = [
    ['Banco', cuenta.banco], ['Número', cuenta.numero], ['Titular', cuenta.titular],
    cuenta.corte ? ['Fecha de corte', 'día ' + cuenta.corte + ' de cada mes'] : null,
    cuenta.pagoDia ? ['Pago límite', 'día ' + cuenta.pagoDia + ' de cada mes'] : null,
    cuenta.bolsa ? ['Tipo de crédito', cuenta.bolsa === 'compartida' ? 'Bolsa compartida (crédito del banco)' : 'Individual'] : null,
    ['Notas', cuenta.notas]
  ].filter(Boolean);
  const saldo = saldoCuenta(cuenta, txs, S.tasas);
  const conLimite = cuenta.tipo === 'tarjeta' && cuenta.limite > 0;
  const tieneActividad = txs.some(t => t.cuenta === cuenta.id || t.cuentaDestino === cuenta.id);
  return html`<div>
    <div class="tarjeta" style=${{ marginBottom: '10px' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>${TIPOS_CUENTA[cuenta.tipo].nombre} · ${cuenta.moneda}</div>
          <div class="num" style=${{ fontSize: '26px', fontWeight: 800, color: saldo < 0 ? 'var(--gasto)' : 'inherit' }}>
            ${fmtConMoneda(saldo, cuenta.moneda)}
          </div>
          ${conLimite && html`<div class="dato-cuenta num" style=${{ marginTop: '2px' }}>
            Límite ${fmtConMoneda(cuenta.limite, cuenta.moneda)} · Disponible ${fmtConMoneda(Math.max(0, cuenta.limite + saldo), cuenta.moneda)}
          <//>`}
        </div>
        ${cuenta.moneda !== principal && html`<div class="sub num">≈ ${fmtConMoneda(saldoConvertido(cuenta, txs, S.tasas, principal), principal)}</div>`}
      </div>
    </div>

    ${cuenta.tipo === 'bancaria' && tieneActividad && html`
      <${GraficasCuentaBancaria} cuenta=${cuenta} txs=${txs} tasas=${S.tasas} />
    `}

    ${datos.some(d => d[1]) && html`<div class="tarjeta" style=${{ paddingTop: '4px' }}>
      ${datos.map(([etq, val]) => val && html`<div key=${etq} class="fila">
        <div class="cuerpo"><div class="sub">${etq}</div><div class="titulo copiable" onClick=${() => copiar(val)}>${val} 📋</div></div>
      </div>`)}
    <//>`}

    ${(S.cuotas || []).some(p => p.cuentaId === cuenta.id && p.activa !== false) && html`<div class="tarjeta" style=${{ paddingTop: '4px' }}>
      <h3>Cuotas</h3>
      ${(S.cuotas || []).filter(p => p.cuentaId === cuenta.id && p.activa !== false).map(p => {
        const info = planCuotas(p);
        return html`<div key=${p.id} class="fila">
          <div class="cuerpo">
            <div class="titulo">${p.nombre || 'Cuotas'}</div>
            <div class="sub">${info.terminado ? '✓ completado' : `cuota ${Math.min(info.vencidas + 1, info.n)} de ${info.n} · próxima ${fmtFecha(info.proxima.fecha)}`}</div>
            <div class="barra-fila" style=${{ margin: '6px 0 0' }}>
              <div class="pista"><div class="lleno" style=${{ width: Math.min(100, Math.round(info.pagado / p.montoTotal * 100)) + '%' }}></div></div>
            </div>
            <div class="dato-cuenta num" style=${{ marginTop: '3px' }}>${fmtConMoneda(info.pagado, p.moneda)} de ${fmtConMoneda(p.montoTotal, p.moneda)}</div>
          </div>
          <div class="monto num ${info.terminado ? 'm-ingreso' : 'm-gasto'}">${info.terminado ? '✓' : '−' + fmtConMoneda(info.montoK(info.proxima ? info.proxima.k : info.n), p.moneda)}</div>
        </div>`;
      })}
      <div class="dato-cuenta" style=${{ margin: '4px 4px 8px' }}>Cada cuota pagada libera ese monto de tu crédito disponible.</div>
    </div>`}

    <div style=${{ display: 'flex', gap: '8px', margin: '10px 0' }}>
      <button class="btn btn-suave" onClick=${() => { setEditor(cuenta); }}>${ICONO_EDITAR} Editar</button>
      <button class="btn btn-suave" onClick=${() => reArchivar(cuenta, !cuenta.archivada)}>
        ${cuenta.archivada ? html`${ICONO_RESTAURAR} Restaurar` : html`${ICONO_CAJA} Archivar`}
      </button>
    </div>

    <div class="tarjeta" style=${{ paddingTop: '4px' }}>
      <h3>Últimos movimientos</h3>
      ${movs.map(tx => html`<${FilaTx} key=${tx.id} tx=${tx} cuentas=${S.cuentas} categorias=${S.categorias}
        onClick=${() => nav('#/agregar?id=' + tx.id)} />`)}
      ${movs.length === 0 && html`<div class="vacio">Sin movimientos.</div>`}
    </div>
  </div>`;
}

/* ---------- Gráficas útiles de una cuenta bancaria ---------- */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function actividadMensualCuenta(cuenta, txs, tasas, meses = 6) {
  const actual = claveMesActual();
  const claves = Array.from({ length: meses }, (_, i) => sumarMesClave(actual, i - meses + 1));
  const porMes = new Map(claves.map(clave => [clave, { clave, entra: 0, sale: 0 }]));
  for (const tx of txs) {
    const fila = porMes.get(tx.fecha.slice(0, 7));
    if (!fila) continue;
    const delta = efectoTx(tx, cuenta.id, tasas, cuenta.moneda);
    if (delta > 0) fila.entra += delta;
    else if (delta < 0) fila.sale += -delta;
  }
  return claves.map(k => porMes.get(k));
}

function GraficasCuentaBancaria({ cuenta, txs, tasas }) {
  const desdeD = sumarMesClave(claveMesActual(), -5) + '-01';
  const hastaD = isoDia();
  const saldos = serieSaldos({ cuentas: [cuenta], txs, tasas, principal: cuenta.moneda, desdeD, hastaD, cuentaId: cuenta.id });
  const meses = actividadMensualCuenta(cuenta, txs, tasas);
  return html`<div class="tarjeta cuenta-graficas">
    <h3>Actividad · últimos 6 meses</h3>
    <${ChartSaldoCuenta} datos=${saldos} moneda=${cuenta.moneda} />
    <div class="cuenta-chart-separador"></div>
    <${ChartActividadCuenta} datos=${meses} moneda=${cuenta.moneda} />
    <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
      Incluye transferencias: no son gastos, pero sí explican la liquidez de esta cuenta.
    </div>
  </div>`;
}

function ChartSaldoCuenta({ datos, moneda }) {
  const W = 320, H = 132, PL = 43, PR = 8, PT = 12, PB = 22;
  const valores = datos.map(d => d.balance);
  const min = Math.min(0, ...valores), max = Math.max(0, ...valores);
  const margen = Math.max(1, (max - min) * .08);
  const lo = min - margen, hi = max + margen;
  const x = i => PL + i / Math.max(1, datos.length - 1) * (W - PL - PR);
  const y = v => PT + (hi - v) / Math.max(1, hi - lo) * (H - PT - PB);
  const paso = Math.max(1, Math.ceil(datos.length / 90));
  const visibles = datos.filter((_, i) => i % paso === 0 || i === datos.length - 1);
  const linea = visibles.map((d, i) => `${i ? 'L' : 'M'}${x(datos.indexOf(d)).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ');
  const area = visibles.length ? `${linea} L${x(datos.indexOf(visibles.at(-1))).toFixed(1)},${H - PB} L${x(datos.indexOf(visibles[0])).toFixed(1)},${H - PB} Z` : '';
  const marcas = [0, 2, 5].map(m => {
    const clave = sumarMesClave(claveMesActual(), m - 5);
    const idx = datos.findIndex(d => d.fecha.startsWith(clave));
    return idx >= 0 ? { idx, texto: MESES_CORTOS[+clave.slice(5, 7) - 1] } : null;
  }).filter(Boolean);
  const ticks = [lo + (hi - lo) * .25, lo + (hi - lo) * .75];
  return html`<div class="cuenta-chart">
    <div class="cuenta-chart-titulo"><span>Saldo diario</span><b class="num">${fmtConMoneda(datos.at(-1)?.balance || 0, moneda)}</b></div>
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Evolución diaria del saldo durante los últimos seis meses">
      <title>Evolución del saldo</title>
      ${ticks.map(v => html`<g>
        <line x1=${PL} x2=${W - PR} y1=${y(v)} y2=${y(v)} stroke="var(--line)" stroke-width="1" />
        <text x=${PL - 5} y=${y(v) + 3} text-anchor="end" fill="var(--muted)">${fmtCompacto(v, moneda)}</text>
      </g>`)}
      ${lo < 0 && hi > 0 && html`<line x1=${PL} x2=${W - PR} y1=${y(0)} y2=${y(0)} stroke="var(--muted)" stroke-width="1" />`}
      <path d=${area} fill="var(--accent-soft)" />
      <path d=${linea} fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      ${marcas.map(m => html`<text x=${x(m.idx)} y=${H - 5} text-anchor=${m.idx === 0 ? 'start' : m.idx === datos.length - 1 ? 'end' : 'middle'} fill="var(--muted)">${m.texto}</text>`)}
      ${datos.length && html`<circle cx=${x(datos.length - 1)} cy=${y(datos.at(-1).balance)} r="3.5" fill="var(--accent)" />`}
    </svg>
  </div>`;
}

function ChartActividadCuenta({ datos, moneda }) {
  const W = 320, H = 142, PL = 43, PR = 8, PT = 10, PB = 24;
  const max = Math.max(1, ...datos.flatMap(d => [d.entra, d.sale]));
  const base = H - PB, grupo = (W - PL - PR) / datos.length;
  const alto = v => v / max * (base - PT);
  const totalIn = datos.reduce((s, d) => s + d.entra, 0);
  const totalOut = datos.reduce((s, d) => s + d.sale, 0);
  return html`<div class="cuenta-chart">
    <div class="cuenta-chart-titulo"><span>Entradas y salidas</span><span class="cuenta-chart-leyenda"><i class="entra"></i>Entra <i class="sale"></i>Sale</span></div>
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Entradas y salidas mensuales de la cuenta durante los últimos seis meses">
      <title>Entradas y salidas mensuales</title>
      <line x1=${PL} x2=${W - PR} y1=${base} y2=${base} stroke="var(--line)" stroke-width="1" />
      <line x1=${PL} x2=${W - PR} y1=${PT} y2=${PT} stroke="var(--line)" stroke-width="1" />
      <text x=${PL - 5} y=${PT + 4} text-anchor="end" fill="var(--muted)">${fmtCompacto(max, moneda)}</text>
      <text x=${PL - 5} y=${base + 3} text-anchor="end" fill="var(--muted)">0</text>
      ${datos.map((d, i) => {
        const hIn = alto(d.entra), hOut = alto(d.sale), x0 = PL + i * grupo;
        return html`<g>
          <rect x=${x0 + grupo * .17} y=${base - hIn} width=${Math.max(5, grupo * .28)} height=${hIn} rx="2.5" fill="var(--ingreso)"><title>${d.clave}: entró ${fmtConMoneda(d.entra, moneda)}</title></rect>
          <rect x=${x0 + grupo * .53} y=${base - hOut} width=${Math.max(5, grupo * .28)} height=${hOut} rx="2.5" fill="var(--gasto)"><title>${d.clave}: salió ${fmtConMoneda(d.sale, moneda)}</title></rect>
          <text x=${x0 + grupo / 2} y=${H - 6} text-anchor="middle" fill="var(--muted)">${MESES_CORTOS[+d.clave.slice(5, 7) - 1]}</text>
        </g>`;
      })}
    </svg>
    <div class="cuenta-chart-totales num">
      <span>Entró <b class="m-ingreso">${fmtConMoneda(totalIn, moneda)}</b></span>
      <span>Salió <b class="m-gasto">${fmtConMoneda(totalOut, moneda)}</b></span>
    </div>
  </div>`;
}

/* ---------- Editor ---------- */
function EditorCuenta({ c, S, cerrar, alGuardar }) {
  const [f, setF] = useState({
    tipo: c.tipo || 'bancaria',
    nombre: c.nombre || '',
    moneda: c.moneda || S.ajustes.monedaPrincipal,
    saldo: c.saldoInicial != null ? enteroATexto(Math.abs(c.saldoInicial), 2) : '',
    limite: c.limite != null ? enteroATexto(c.limite, 2) : '',
    corte: c.corte || '', pagoDia: c.pagoDia || '', bolsa: c.bolsa || 'individual',
    banco: c.banco || '', numero: c.numero || '', titular: c.titular || '', notas: c.notas || '',
    enCuotas: false, numCuotas: '', primeraCuota: isoDia()
  });
  const pasivo = f.tipo === 'tarjeta' || f.tipo === 'deuda';
  const set = p => setF({ ...f, ...p });
  const bancosConocidos = [...new Set(S.cuentas.map(x => x.banco).filter(Boolean))];

  const diaValido = t => { const n = parseInt(t, 10); return n >= 1 && n <= 31 ? n : null; };

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Ponle un nombre a la cuenta'); return; }
    const saldo = textoAEntero(f.saldo || '0', 2) || 0;
    const nC = parseInt(f.numCuotas, 10);
    if (pasivo && f.enCuotas) {
      if (saldo <= 0) { toast('Con cuotas necesitas la deuda actual: es el monto total a financiar'); return; }
      if (!(nC >= 1 && nC <= 120)) { toast('Número de cuotas inválido (1-120)'); return; }
    }
    const limite = f.tipo === 'tarjeta' ? (textoAEntero(f.limite || '0', 2) || null) : null;
    const corte = f.tipo === 'tarjeta' ? diaValido(f.corte) : null;
    const pagoDia = pasivo ? diaValido(f.pagoDia) : null;
    if (pasivo && !f.enCuotas && !pagoDia) { toast('Una deuda necesita fecha: pon el día de pago — o márcala como cuotas'); return; }
    const idCuenta = c.id || uid();
    await fin.guardarCuenta({
      id: idCuenta, tipo: f.tipo, nombre: f.nombre.trim(), moneda: f.moneda,
      saldoInicial: pasivo ? -saldo : saldo,
      limite, corte, pagoDia,
      bolsa: f.tipo === 'tarjeta' ? f.bolsa : null,
      banco: f.banco.trim() || null, numero: f.numero.trim() || null,
      titular: f.titular.trim() || null, notas: f.notas.trim() || null,
      archivada: c.archivada || false,
      createdAt: c.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    // cuotas marcadas al crear: el plan nace junto con la cuenta
    if (pasivo && f.enCuotas && !c.id) {
      await fin.guardarCuota({
        id: uid(), nombre: f.nombre.trim(), cuentaId: idCuenta,
        montoTotal: saldo, numCuotas: nC, moneda: f.moneda,
        primeraFecha: f.primeraCuota || isoDia(),
        activa: true, creadoEn: new Date().toISOString()
      });
    }
    await recargar();

    // Con la nueva configuración (p. ej. límite), los movimientos futuros de esta
    // tarjeta que ya no quepan en el crédito se eliminan en cascada: quedan los
    // válidos más cercanos; desde el primero inválido, los siguientes dejan de existir.
    let eliminados = 0;
    if (f.tipo === 'tarjeta' && limite) {
      const cuentaFresca = (await fin.cuentas()).find(x => x.id === (c.id || uid())) || null;
      const idTarjeta = c.id;
      if (idTarjeta) {
        const todas = await fin.todasTx();
        const disponible0 = limite + saldoCuenta(cuentaFresca || { ...c, limite, saldoInicial: pasivo ? -saldo : saldo }, todas, S.tasas);
        const gastos = (await fin.futuros())
          .filter(x => x.tipo === 'gasto' && x.cuenta === idTarjeta)
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        let disp = disponible0, invalido = false;
        const aEliminar = [];
        for (const fu of gastos) {
          disp -= convertir(fu.monto, fu.moneda, f.moneda, S.tasas, fu.fecha);
          if (invalido || disp < 0) { invalido = true; aEliminar.push(fu.id); }
        }
        if (aEliminar.length) {
          for (const id of aEliminar) await fin.borrarFuturo(id);
          eliminados = aEliminar.length;
          await recargar();
        }
      }
    }

    toast(eliminados ? `✓ Cuenta guardada · ${eliminados} movimiento(s) futuro(s) inválidos eliminados` : '✓ Cuenta guardada');
    // tarjeta/deuda NUEVA con deuda: ofrecer programar sus cuotas de una vez
    alGuardar?.(!c.id && pasivo ? { id: idCuenta, nombre: f.nombre.trim(), moneda: f.moneda } : null, saldo);
    cerrar();
  };

  const borrar = async () => {
    if (!confirm('¿Borrar la cuenta ' + f.nombre + '?')) return;
    try {
      await fin.borrarCuenta(c.id);
      await recargar();
      toast('Cuenta borrada');
      cerrar();
    } catch (e) { toast(e.message); }
  };

  return html`<div>
    <div class="chips-scroll" style=${{ marginBottom: '10px' }}>
      ${Object.entries(TIPOS_CUENTA).map(([k, v]) => html`
        <button key=${k} class=${'chip' + (f.tipo === k ? ' sel' : '')} onClick=${() => set({ tipo: k })}><${IconoCuenta} tipo=${k} /> ${v.nombre}</button>`)}
    </div>
    ${f.tipo === 'tercero' && html`<div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      🤝 No es tu dinero: transferir a esta cuenta no cuenta como gasto, pero sí sale de tu
      patrimonio. Su saldo acumula todo lo depositado.
    <//>`}
    <div style=${{ display: 'grid', gap: '8px' }}>
      <input placeholder=${f.tipo === 'tercero' ? 'Nombre (ej. Juan, Mamá, Tienda Ana…)' : 'Nombre (ej. BAC, Efectivo, Visa…)'} value=${f.nombre} onInput=${e => set({ nombre: e.target.value })} />
      <div style=${{ display: 'flex', gap: '8px' }}>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">Moneda</div>
          <${SelectorMoneda} valor=${f.moneda} onChange=${moneda => set({ moneda })} />
        <//>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">${pasivo ? 'Deuda actual' : f.tipo === 'tercero' ? 'Depositado antes (opcional)' : 'Saldo inicial'}</div>
          <input inputMode="decimal" placeholder="0.00" value=${f.saldo} style=${{ textAlign: 'right' }}
            onInput=${e => set({ saldo: e.target.value })} />
        <//>
      <//>
      ${f.tipo === 'tarjeta' && html`<div style=${{ display: 'grid', gap: '8px', background: 'var(--chip)', borderRadius: '14px', padding: '10px' }}>
        <div class="dato-cuenta" style=${{ fontWeight: 700 }}>CRÉDITO DE LA TARJETA</div>
        <input placeholder="Límite de crédito (opcional)" inputMode="decimal"
          value=${f.limite} style=${{ textAlign: 'right' }} onInput=${e => set({ limite: e.target.value })} />
        <div style=${{ display: 'flex', gap: '8px' }}>
          <div style=${{ flex: 1 }}>
            <div class="dato-cuenta">Fecha de corte (día)</div>
            <input inputMode="numeric" placeholder="Ej. 12" value=${f.corte} inputMode="numeric" style=${{ textAlign: 'right' }}
              onInput=${e => set({ corte: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} />
          <//>
          <div style=${{ flex: 1 }}>
            <div class="dato-cuenta">Pago límite (día)</div>
            <input inputMode="numeric" placeholder="Ej. 28" value=${f.pagoDia} style=${{ textAlign: 'right' }}
              onInput=${e => set({ pagoDia: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} />
          <//>
        <//>
        <div class="dato-cuenta">Con día de pago y deuda pendiente, el pago aparece solo en Inicio · Próximos pagos fijos, ese mismo día por lo que debes.</div>
        <div>
          <div class="dato-cuenta">Tipo de crédito</div>
          <${Segmentado} opciones=${[['individual', 'Individual'], ['compartida', 'Bolsa compartida']]} valor=${f.bolsa} onChange=${b => set({ bolsa: b })} />
          <div class="dato-cuenta" style=${{ marginTop: '4px' }}>${f.bolsa === 'compartida'
            ? 'El límite es el crédito total del banco, compartido entre tus tarjetas.'
            : 'El límite pertenece solo a esta tarjeta.'}</div>
        <//>
      <//>`}
      ${pasivo && html`<div style=${{ display: 'grid', gap: '8px', background: 'var(--chip)', borderRadius: '14px', padding: '10px' }}>
        <div class="dato-cuenta" style=${{ fontWeight: 700 }}>PAGO DE LA DEUDA</div>
        <label style=${{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 700 }}>
          <input type="checkbox" checked=${f.enCuotas} style=${{ width: '20px', height: '20px' }}
            onChange=${e => set({ enCuotas: e.target.checked })} />
          Pagar en cuotas
        </label>
        ${f.enCuotas ? html`
          <div style=${{ display: 'flex', gap: '8px' }}>
            <div style=${{ flex: 1 }}>
              <div class="dato-cuenta">Cuotas (meses)</div>
              <input inputMode="numeric" placeholder="Ej. 10" value=${f.numCuotas} style=${{ textAlign: 'right' }}
                onInput=${e => set({ numCuotas: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />
            <//>
            <div style=${{ flex: 1 }}>
              <div class="dato-cuenta">Primera cuota</div>
              <input type="date" value=${f.primeraCuota}
                onChange=${e => e.target.value && set({ primeraCuota: e.target.value })} />
            <//>
          <//>
          ${textoAEntero(f.saldo || '0', 2) && parseInt(f.numCuotas, 10) >= 1 ? html`<div class="dato-cuenta">
            Cuota mensual: <b class="num">${(() => {
              const total = textoAEntero(f.saldo || '0', 2), n = parseInt(f.numCuotas, 10), base = Math.floor(total / n);
              return `${fmtConMoneda(base, f.moneda)}${total % n ? ` (última: ${fmtConMoneda(total - base * (n - 1), f.moneda)})` : ''}`;
            })()}</b> — al terminar, el plan desaparece solo.
          <//>` : null}
          ${c.id && html`<div class="dato-cuenta">Los planes ya creados se administran en Inicio (＋ → Cuotas).</div>`}
        ` : html`
          ${f.tipo === 'deuda' && html`<div>
            <div class="dato-cuenta">Día de pago (de cada mes)</div>
            <input inputMode="numeric" placeholder="Ej. 20" value=${f.pagoDia} style=${{ textAlign: 'right', maxWidth: '110px' }}
              onInput=${e => set({ pagoDia: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} />
          <//>`}
          <div class="dato-cuenta">Una deuda no vive sin fecha: pon el día del mes en que se paga${f.tipo === 'tarjeta' ? ' (en el bloque de crédito)' : ''}.</div>
        `}
      <//>`}
      <input placeholder="Banco (opcional)" list="bancos-conocidos" value=${f.banco} onInput=${e => set({ banco: e.target.value })} />
      <datalist id="bancos-conocidos">
        ${bancosConocidos.map(b => html`<option key=${b} value=${b} />`)}
      </datalist>
      <input placeholder="Número de cuenta/tarjeta (opcional)" value=${f.numero} inputMode="numeric" onInput=${e => set({ numero: e.target.value })} />
      <input placeholder="Titular o alias (opcional)" value=${f.titular} onInput=${e => set({ titular: e.target.value })} />
      <textarea placeholder="Notas (opcional)" rows="2" value=${f.notas} onInput=${e => set({ notas: e.target.value })}></textarea>
    </div>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar cuenta</button>
    ${c.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar cuenta</button>`}
  </div>`;
}
