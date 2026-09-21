// Pantalla Agregar: captura rápida (gasto/ingreso/transferencia) y edición.
// Monto y teclado viven en el panel inferior fijo: siempre visibles al digitar.
// Al capturar se elige la moneda (chips GTQ/USD); si difiere de la de la cuenta,
// el saldo se ajusta con la tasa de cambio registrada.
import { html, useState, useEffect, useMemo, useRef } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast, getState } from '../store.js';
import { convertir, categoriasFrecuentes, motivosRecientes, saldoCuenta, efectoTx } from '../model.js';
import { Teclado, PickerCuentas, GridCategorias, InputEtiquetas, SelectorFecha, Comprobantes, Segmentado } from '../ui.js';
import { IconoCuenta, ICONO_BASURA } from '../iconos.js';
import { uid, isoLocal, textoAEntero, fmtConMoneda, monedaInfo, comprimirImagen } from '../util.js';

const ETIQUETA_TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };

export default function Agregar({ txId }) {
  const S = useStore();
  const [datos, setDatos] = useState(null);
  const [picker, setPicker] = useState(null); // 'cuenta' | 'destino'
  const [txs, setTxs] = useState([]);
  const [teclado, setTeclado] = useState(false);
  const [arrastre, setArrastre] = useState(null); // frac del drag del slider de tipo
  const datosRef = useRef(null);
  datosRef.current = datos;

  useEffect(() => {
    (async () => {
      const todas = await fin.todasTx();
      setTxs(todas);
      if (txId) {
        const tx = await fin._db().transacciones.get(txId);
        if (!tx) { nav('#/'); return; }
        const adj = await fin.adjuntosDe(txId);
        const existentes = adj.map(a => ({ id: a.id, url: URL.createObjectURL(a.blob) }));
        const dec = monedaInfo(tx.moneda).dec;
        setDatos({
          tipo: tx.tipo, moneda: tx.moneda,
          montoStr: (tx.monto / 10 ** dec).toFixed(dec).replace(/\.?0+$/, m => (m === '.' + '0'.repeat(dec) ? '' : m)),
          cuenta: tx.cuenta, destino: tx.cuentaDestino || null, montoDestinoStr: '',
          categoria: tx.categoria || null, etiquetas: tx.etiquetas || [], motivo: tx.motivo || '',
          fecha: tx.fecha, nuevas: [], existentes, editando: tx
        });
      } else {
        const ult = S.ajustes.ultimaCuenta || {};
        const activas = S.cuentas.filter(c => !c.archivada);
        const propias = activas.filter(c => c.tipo !== 'tercero');
        setDatos({
          tipo: 'gasto', moneda: null, montoStr: '',
          cuenta: propias.find(c => c.id === ult.gasto)?.id || propias[0]?.id || null,
          destino: activas.find(c => c.id === ult.transferDestino)?.id || null,
          montoDestinoStr: '', categoria: null, etiquetas: [], motivo: '',
          fecha: isoLocal(), nuevas: [], existentes: [], editando: null
        });
      }
    })();
    return () => {
      const d = datosRef.current;
      if (d) [...d.existentes, ...d.nuevas].forEach(a => URL.revokeObjectURL(a.url));
    };
  }, [txId]);

  if (!datos || !S.listo) return html`<div class="pantalla-agregar"><div class="vacio" style=${{ paddingTop: '80px' }}>Cargando…</div></div>`;

  const set = p => setDatos({ ...datos, ...p });
  const cuentaObj = S.cuentas.find(c => c.id === datos.cuenta);
  const destinoObj = S.cuentas.find(c => c.id === datos.destino);
  const principal = S.ajustes.monedaPrincipal;
  // La transferencia siempre se registra en la moneda de la cuenta de origen.
  const moneda = datos.tipo === 'transferencia'
    ? (cuentaObj?.moneda || principal)
    : (datos.moneda || cuentaObj?.moneda || principal);
  const decMonto = monedaInfo(moneda).dec;
  const entero = textoAEntero(datos.montoStr, decMonto);
  const distintaMoneda = datos.tipo === 'transferencia' && destinoObj && cuentaObj && destinoObj.moneda !== cuentaObj.moneda;
  const enteroDestino = distintaMoneda ? textoAEntero(datos.montoDestinoStr, monedaInfo(destinoObj.moneda).dec) : null;
  const opcionesMoneda = [...new Set([cuentaObj?.moneda, 'GTQ', 'USD'])].filter(Boolean);

  const catsOrdenadas = useMemo(() => {
    if (datos.tipo === 'transferencia') return [];
    const frec = categoriasFrecuentes(txs, datos.tipo, 8);
    const delTipo = S.categorias.filter(c => c.tipo === datos.tipo);
    return [
      ...frec.map(id => delTipo.find(c => c.id === id)).filter(Boolean),
      ...delTipo.filter(c => !frec.includes(c.id)).sort((a, b) => a.nombre.localeCompare(b.nombre))
    ];
  }, [datos.tipo, txs, S.categorias]);

  const tecla = k => {
    if (k === 'del') return set({ montoStr: datos.montoStr.slice(0, -1) });
    if (k === '.') return set({ montoStr: datos.montoStr.includes('.') ? datos.montoStr : (datos.montoStr || '0') + '.' });
    if (datos.montoStr.replace('.', '').length >= 9) return;
    set({ montoStr: datos.montoStr + k });
  };

  const montoFormateado = (() => {
    const [ent, frac] = (datos.montoStr || '0').split('.');
    return Number(ent || 0).toLocaleString('en-US') + (frac !== undefined ? '.' + frac : '');
  })();

  const conversionCuenta = entero && cuentaObj && moneda !== cuentaObj.moneda
    ? fmtConMoneda(convertir(entero, moneda, cuentaObj.moneda, S.tasas, datos.fecha), cuentaObj.moneda)
    : null;
  const conversionPrincipal = !conversionCuenta && entero && moneda !== principal
    ? fmtConMoneda(convertir(entero, moneda, principal, S.tasas, datos.fecha), principal)
    : null;

  const agregarFoto = async archivo => {
    try {
      const blob = await comprimirImagen(archivo);
      set({ nuevas: [...datos.nuevas, { id: uid(), blob, url: URL.createObjectURL(blob) }] });
    } catch { toast('No se pudo procesar la imagen'); }
  };

  const puede = entero && cuentaObj && (datos.tipo !== 'transferencia' || (destinoObj && destinoObj.id !== cuentaObj.id));

  const guardar = async () => {
    if (!puede) return;
    const d = datos;
    const monedaFinal = d.tipo === 'transferencia'
      ? cuentaObj.moneda
      : (d.moneda || cuentaObj.moneda || principal);
    const tx = d.editando
      ? { ...d.editando }
      : { id: uid(), createdAt: new Date().toISOString() };
    Object.assign(tx, {
      tipo: d.tipo, monto: entero, moneda: monedaFinal, cuenta: cuentaObj.id,
      cuentaDestino: d.tipo === 'transferencia' ? destinoObj.id : null,
      montoDestino: distintaMoneda
        ? (enteroDestino ?? convertir(entero, cuentaObj.moneda, destinoObj.moneda, S.tasas, d.fecha))
        : null,
      categoria: d.tipo === 'transferencia' ? null : d.categoria,
      etiquetas: d.etiquetas, motivo: d.motivo.trim() || null,
      fecha: d.fecha, adjuntos: [...d.existentes.map(a => a.id), ...d.nuevas.map(a => a.id)],
      eliminada: false, updatedAt: new Date().toISOString()
    });
    // Una cuenta de débito no puede quedar en negativo: gastos y
    // transferencias se bloquean si el dinero no alcanza. Tarjetas y deudas
    // sí pueden quedarlo (es su naturaleza) y las de terceros tampoco se
    // bloquean: lo que devuelven por encima de lo depositado se cuenta como
    // ingreso.
    if (d.tipo !== 'ingreso' && ['efectivo', 'bancaria', 'ahorro'].includes(cuentaObj.tipo)) {
      const disponible = saldoCuenta(cuentaObj, txs, S.tasas)
        - (d.editando ? efectoTx(d.editando, cuentaObj.id, S.tasas, cuentaObj.moneda) : 0);
      const queda = disponible + efectoTx(tx, cuentaObj.id, S.tasas, cuentaObj.moneda);
      if (queda < 0) {
        const que = d.tipo === 'gasto' ? 'el gasto' : 'la transferencia';
        alert(`No se puede guardar: ${cuentaObj.nombre} tiene ${fmtConMoneda(disponible, cuentaObj.moneda)} disponibles y ${que} es de ${fmtConMoneda(entero, monedaFinal)} (faltan ${fmtConMoneda(-queda, cuentaObj.moneda)}).\n\nSi tu banco muestra más dinero, registra el ingreso que falta o corrige el saldo inicial en Cuentas.`);
        return;
      }
    }
    for (const n of d.nuevas) await fin.agregarAdjunto(tx.id, n.blob);
    if (d.editando) {
      for (const idAnterior of d.editando.adjuntos || []) {
        if (!d.existentes.find(a => a.id === idAnterior)) await fin.borrarAdjunto(idAnterior);
      }
    }
    await fin.guardarTx(tx);
    const etiquetasConocidas = new Set(S.etiquetas.map(e => e.nombre));
    for (const e of d.etiquetas) if (!etiquetasConocidas.has(e)) await fin.guardarEtiqueta({ id: uid(), nombre: e });

    const ult = { ...(S.ajustes.ultimaCuenta || {}) };
    ult[d.tipo] = cuentaObj.id;
    if (d.tipo === 'transferencia') ult.transferDestino = destinoObj.id;
    await fin.setAjuste('app', { ...S.ajustes, ultimaCuenta: ult });
    await recargar();
    setTxs(await fin.todasTx());

    if (d.editando) {
      [...d.existentes, ...d.nuevas].forEach(a => URL.revokeObjectURL(a.url));
      toast('✓ Cambios guardados');
    } else {
      d.nuevas.forEach(a => URL.revokeObjectURL(a.url));
      toast(`✓ ${ETIQUETA_TIPO[d.tipo]} de ${fmtConMoneda(entero, monedaFinal)} guardado`);
    }
    // al guardar siempre cerramos: el usuario vuelve a donde estaba
    nav(getState().routeAnterior || '#/');
  };

  const eliminar = async () => {
    if (!datos.editando || !confirm('¿Eliminar esta transacción?')) return;
    for (const a of datos.existentes) await fin.borrarAdjunto(a.id);
    await fin.eliminarTx(datos.editando.id);
    await recargar();
    datos.existentes.forEach(a => URL.revokeObjectURL(a.url));
    toast('Transacción eliminada');
    nav(getState().routeAnterior || '#/');
  };

  const cambiarTipo = t => {
    const activas = S.cuentas.filter(c => !c.archivada);
    const ult = S.ajustes.ultimaCuenta || {};
    // en gasto/ingreso una cuenta de terceros no tiene sentido: lo suyo se
    // mueve con transferencias — el default cae siempre en una cuenta propia
    const candidatas = t === 'transferencia' ? activas : activas.filter(c => c.tipo !== 'tercero');
    set({
      tipo: t,
      cuenta: (t === 'transferencia'
        ? activas.find(c => c.id === ult.transferencia)
        : candidatas.find(c => c.id === ult[t]))?.id || candidatas[0]?.id || null,
      destino: t === 'transferencia'
        ? (activas.find(c => c.id === ult.transferDestino)?.id || activas[1]?.id || null)
        : null,
      montoDestinoStr: ''
    });
  };

  const simbolo = monedaInfo(moneda).simbolo;

  // transform del swipe SOLO durante el gesto: un ancestro transformado (aunque
  // sea identidad) vuelve los sheets fijos relativos a él (overlay recortado y
  // anclado al fondo de la página en vez de a la pantalla).
  return html`<div class="pantalla-agregar">
    <div class="pa-sup">
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button class="btn-icono" onClick=${() => nav(getState().routeAnterior || '#/')}>✕</button>
        ${datos.editando && html`<button class="btn-icono" aria-label="Eliminar transacción" style=${{ color: 'var(--gasto)' }} onClick=${eliminar}>${ICONO_BASURA}</button>`}
      </div>
      <${Segmentado} opciones=${[['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']]} valor=${datos.tipo} onChange=${cambiarTipo}
        onArrastre=${frac => setArrastre({ frac })} onFin=${() => setArrastre(null)} />
    </div>

    <div class="pa-scroll" onClickCapture=${() => setTeclado(false)}>
      <div class=${arrastre ? '' : 'trans-vista'} style=${arrastre ? {
      transform: `translateX(${-(arrastre.frac) * 15}%)`,
      opacity: 1 - Math.abs(arrastre.frac) * 0.35
    } : null}>
      <div class="pa-seccion">
        <label>${datos.tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</label>
        <div class="chips-scroll">
          <button class="chip" onClick=${() => setPicker('cuenta')}>
            ${cuentaObj && html`<${IconoCuenta} tipo=${cuentaObj.tipo} /> `}${cuentaObj
              ? `${cuentaObj.nombre} · ${fmtConMoneda(saldoCuenta(cuentaObj, txs, S.tasas), cuentaObj.moneda)}`
              : 'Elegir cuenta'}
          </button>
          ${datos.tipo === 'transferencia' && html`<span style=${{ alignSelf: 'center', color: 'var(--muted)', fontSize: '18px' }}>→</span>
            <button class="chip" onClick=${() => setPicker('destino')}>
              ${destinoObj && html`<${IconoCuenta} tipo=${destinoObj.tipo} /> `}${destinoObj ? destinoObj.nombre : '¿Hacia dónde?'}
            </button>`}
        </div>
        ${datos.tipo === 'transferencia' && destinoObj && html`<div class="dato-cuenta" style=${{ marginTop: '6px' }}>
          ${[destinoObj.banco, destinoObj.numero && ('№ ' + destinoObj.numero), destinoObj.titular].filter(Boolean).join(' · ')
            || 'Registra banco y número en Cuentas'}
        <//>`}
        ${distintaMoneda && html`<div class="mini-monto" style=${{ marginTop: '8px' }}>
          <span class="dato-cuenta">Recibe ${destinoObj.moneda}</span>
          <input inputMode="decimal" placeholder=${'auto'} value=${datos.montoDestinoStr}
            onInput=${e => set({ montoDestinoStr: e.target.value })} style=${{ maxWidth: '150px' }} />
        <//>`}
      </div>

      ${datos.tipo !== 'transferencia' && html`<div class="pa-seccion">
        <label>Categoría</label>
        <${GridCategorias} categorias=${catsOrdenadas} valor=${datos.categoria} onPick=${id => set({ categoria: id })} />
      <//>`}

      <div class="pa-seccion">
        <label>Actividad (etiquetas)</label>
        <${InputEtiquetas} valor=${datos.etiquetas}
          sugerencias=${S.etiquetas.map(e => e.nombre)} onChange=${etiquetas => set({ etiquetas })} />
      <//>

      <div class="pa-seccion">
        <label>Motivo</label>
        <input list="motivos-recientes" placeholder="¿Qué fue? (opcional)" value=${datos.motivo}
          onInput=${e => set({ motivo: e.target.value })} />
        <datalist id="motivos-recientes">
          ${motivosRecientes(txs).map(m => html`<option key=${m} value=${m} />`)}
        </datalist>
      </div>

      <div class="pa-seccion">
        <label>Fecha y hora</label>
        <${SelectorFecha} valor=${datos.fecha} onChange=${fecha => set({ fecha })} />
      <//>

      <div class="pa-seccion">
        <label>Comprobante</label>
        <${Comprobantes} existentes=${datos.existentes} nuevas=${datos.nuevas}
          onQuitarExistente=${id => set({ existentes: datos.existentes.filter(a => a.id !== id) })}
          onQuitarNueva=${id => set({ nuevas: datos.nuevas.filter(a => a.id !== id) })}
          onAgregar=${agregarFoto} />
      <//>
    <//>
    </div>

    <div class="pa-inferior">
      <div class="pa-monto-fila">
        <div class=${'pa-monto num' + (teclado ? ' activo' : '')} onClick=${() => setTeclado(true)}>
          <span class="simbolo">${simbolo}</span>${montoFormateado}${teclado && html`<span class="caret" />`}
        </div>
        ${datos.tipo !== 'transferencia' && html`<div class="pa-monedas">
          ${opcionesMoneda.map(m => html`<button key=${m} class=${'chip' + (m === moneda ? ' sel' : '')}
            onClick=${() => set({ moneda: m })}>${m}</button>`)}
        <//>`}
      </div>
      <div class="pa-conv">
        ${conversionCuenta ? `≈ ${conversionCuenta} en ${cuentaObj.nombre}`
          : conversionPrincipal ? `≈ ${conversionPrincipal}`
          : (datos.tipo === 'transferencia'
            ? (destinoObj?.tipo === 'tercero' ? 'Sale de tu patrimonio · acumula en la cuenta de terceros'
              : cuentaObj?.tipo === 'tercero' ? 'Entra a tu patrimonio · no es ingreso'
              : 'Mueve dinero entre tus cuentas · no es gasto')
            : ' ')}
      </div>
      <button class="btn btn-primario" disabled=${!puede} onClick=${guardar}>
        ${datos.editando ? 'Guardar cambios' : 'Guardar'}
      </button>
      <div class=${'teclado-wrap' + (teclado ? ' abierto' : '')}>
        <${Teclado} onTecla=${tecla} />
      <//>
    </div>

    ${picker && html`<${PickerCuentas}
      titulo=${datos.tipo === 'transferencia'
        ? (picker === 'cuenta' ? '¿Desde qué cuenta?' : '¿Hacia qué cuenta?')
        : '¿Con qué cuenta?'}
      cuentas=${S.cuentas} txs=${txs} tasas=${S.tasas}
      excluir=${picker === 'cuenta' ? null : datos.cuenta}
      sinTerceros=${datos.tipo !== 'transferencia' && picker === 'cuenta'}
      onPick=${c => {
        const p = picker === 'cuenta' ? { cuenta: c.id } : { destino: c.id };
        setPicker(null); set({ ...p, montoDestinoStr: '' });
      }}
      onClose=${() => setPicker(null)} />`}
  </div>`;
}
