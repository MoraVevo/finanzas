// Cuentas: crear/editar tus cuentas (efectivo, banco, ahorro, tarjeta, deuda),
// con datos pre-registrados (banco, número, titular) para consultarlos al transferir.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { saldoCuenta, saldoConvertido, convertir, TIPOS_CUENTA } from '../model.js';
import { Sheet, SelectorMoneda, FilaTx, Segmentado } from '../ui.js';
import { uid, textoAEntero, enteroATexto, fmtConMoneda, isoLocal } from '../util.js';

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
        <span class="emoji">${TIPOS_CUENTA[c.tipo].emoji}</span>
        <div class="cuerpo">
          <div class="titulo">${c.nombre}</div>
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
        <span class="emoji">${TIPOS_CUENTA[c.tipo].emoji}</span>
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
        🏺 El <b>ahorro</b> es dinero tuyo: moverlo ahí no es un gasto.
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

    ${datos.some(d => d[1]) && html`<div class="tarjeta" style=${{ paddingTop: '4px' }}>
      ${datos.map(([etq, val]) => val && html`<div key=${etq} class="fila">
        <div class="cuerpo"><div class="sub">${etq}</div><div class="titulo copiable" onClick=${() => copiar(val)}>${val} 📋</div></div>
      </div>`)}
    <//>`}

    <div style=${{ display: 'flex', gap: '8px', margin: '10px 0' }}>
      <button class="btn btn-suave" onClick=${() => { setEditor(cuenta); }}>✏️ Editar</button>
      <button class="btn btn-suave" onClick=${() => reArchivar(cuenta, !cuenta.archivada)}>
        ${cuenta.archivada ? '♻️ Restaurar' : '📦 Archivar'}
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

/* ---------- Editor ---------- */
function EditorCuenta({ c, S, cerrar }) {
  const [f, setF] = useState({
    tipo: c.tipo || 'bancaria',
    nombre: c.nombre || '',
    moneda: c.moneda || S.ajustes.monedaPrincipal,
    saldo: c.saldoInicial != null ? enteroATexto(Math.abs(c.saldoInicial), 2) : '',
    limite: c.limite != null ? enteroATexto(c.limite, 2) : '',
    corte: c.corte || '', pagoDia: c.pagoDia || '', bolsa: c.bolsa || 'individual',
    banco: c.banco || '', numero: c.numero || '', titular: c.titular || '', notas: c.notas || ''
  });
  const pasivo = f.tipo === 'tarjeta' || f.tipo === 'deuda';
  const set = p => setF({ ...f, ...p });
  const bancosConocidos = [...new Set(S.cuentas.map(x => x.banco).filter(Boolean))];

  const diaValido = t => { const n = parseInt(t, 10); return n >= 1 && n <= 31 ? n : null; };

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Ponle un nombre a la cuenta'); return; }
    const saldo = textoAEntero(f.saldo || '0', 2) || 0;
    const limite = f.tipo === 'tarjeta' ? (textoAEntero(f.limite || '0', 2) || null) : null;
    const corte = f.tipo === 'tarjeta' ? diaValido(f.corte) : null;
    const pagoDia = f.tipo === 'tarjeta' ? diaValido(f.pagoDia) : null;
    await fin.guardarCuenta({
      id: c.id || uid(), tipo: f.tipo, nombre: f.nombre.trim(), moneda: f.moneda,
      saldoInicial: pasivo ? -saldo : saldo,
      limite, corte, pagoDia,
      bolsa: f.tipo === 'tarjeta' ? f.bolsa : null,
      banco: f.banco.trim() || null, numero: f.numero.trim() || null,
      titular: f.titular.trim() || null, notas: f.notas.trim() || null,
      archivada: c.archivada || false,
      createdAt: c.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    });
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
        <button key=${k} class=${'chip' + (f.tipo === k ? ' sel' : '')} onClick=${() => set({ tipo: k })}>${v.emoji} ${v.nombre}</button>`)}
    </div>
    <div style=${{ display: 'grid', gap: '8px' }}>
      <input placeholder="Nombre (ej. BAC, Efectivo, Visa…)" value=${f.nombre} onInput=${e => set({ nombre: e.target.value })} />
      <div style=${{ display: 'flex', gap: '8px' }}>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">Moneda</div>
          <${SelectorMoneda} valor=${f.moneda} onChange=${moneda => set({ moneda })} />
        <//>
        <div style=${{ flex: 1 }}>
          <div class="dato-cuenta">${pasivo ? 'Deuda actual' : 'Saldo inicial'}</div>
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
