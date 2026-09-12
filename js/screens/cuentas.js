// Cuentas: crear/editar tus cuentas (efectivo, banco, ahorro, tarjeta, deuda),
// con datos pre-registrados (banco, número, titular) para consultarlos al transferir.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { saldoCuenta, saldoConvertido, TIPOS_CUENTA } from '../model.js';
import { Sheet, SelectorMoneda, FilaTx } from '../ui.js';
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
          <div class="sub">${[c.banco, c.numero && '№ ' + c.numero].filter(Boolean).join(' · ') || TIPOS_CUENTA[c.tipo].nombre}</div>
        </div>
        <div style=${{ textAlign: 'right' }}>
          <div class="monto num" style=${{ color: saldoCuenta(c, txs) < 0 ? 'var(--gasto)' : 'inherit' }}>${fmtConMoneda(saldoCuenta(c, txs), c.moneda)}</div>
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
      ${DetalleCuenta({ cuenta: detalle, S, txs, principal, copiar, setEditor, setDetalle, reArchivar })}
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
  const datos = [['Banco', cuenta.banco], ['Número', cuenta.numero], ['Titular', cuenta.titular], ['Notas', cuenta.notas]];
  return html`<div>
    <div class="tarjeta" style=${{ marginBottom: '10px' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>${TIPOS_CUENTA[cuenta.tipo].nombre} · ${cuenta.moneda}</div>
          <div class="num" style=${{ fontSize: '26px', fontWeight: 800, color: saldoCuenta(cuenta, txs) < 0 ? 'var(--gasto)' : 'inherit' }}>
            ${fmtConMoneda(saldoCuenta(cuenta, txs), cuenta.moneda)}
          </div>
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
    banco: c.banco || '', numero: c.numero || '', titular: c.titular || '', notas: c.notas || ''
  });
  const pasivo = f.tipo === 'tarjeta' || f.tipo === 'deuda';
  const set = p => setF({ ...f, ...p });

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Ponle un nombre a la cuenta'); return; }
    const saldo = textoAEntero(f.saldo || '0', 2) || 0;
    await fin.guardarCuenta({
      id: c.id || uid(), tipo: f.tipo, nombre: f.nombre.trim(), moneda: f.moneda,
      saldoInicial: pasivo ? -saldo : saldo,
      banco: f.banco.trim() || null, numero: f.numero.trim() || null,
      titular: f.titular.trim() || null, notas: f.notas.trim() || null,
      archivada: c.archivada || false,
      createdAt: c.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await recargar();
    toast('✓ Cuenta guardada');
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
      <input placeholder="Banco (opcional)" value=${f.banco} onInput=${e => set({ banco: e.target.value })} />
      <input placeholder="Número de cuenta/tarjeta (opcional)" value=${f.numero} inputMode="numeric" onInput=${e => set({ numero: e.target.value })} />
      <input placeholder="Titular o alias (opcional)" value=${f.titular} onInput=${e => set({ titular: e.target.value })} />
      <textarea placeholder="Notas (opcional)" rows="2" value=${f.notas} onInput=${e => set({ notas: e.target.value })}></textarea>
    </div>
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar cuenta</button>
    ${c.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar cuenta</button>`}
  </div>`;
}
