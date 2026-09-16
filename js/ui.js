// Componentes compartidos de UI (Preact + htm, sin build).
import { html, useState, useEffect, useRef } from '../vendor/preact-standalone.module.js';
import { saldoCuenta } from './model.js';
import { IconoCuenta, IconoCat, IconoId, ICONOS_CATEGORIA, ICONO_TRANSFER, ICONO_TARJETA, ICONO_CAMARA, ICONO_IMAGEN } from './iconos.js';
import { fmtConMoneda, fmtFecha, fmtHora, isoLocal, isoDia } from './util.js';

/* ---------- Sheet: panel deslizante inferior ----------
   Se cierra tocando la asa, deslizando la asa hacia abajo (gesto nativo),
   tocando el fondo oscuro o con Escape en laptop.
   Los gestos van con listeners NATIVOS directos (touch + pointer,
   passive:false): máxima fiabilidad en iOS, sin depender de delegación. */
export function Sheet({ titulo, onClose, children }) {
  const zonaRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!onClose) return;
    const f = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  useEffect(() => {
    const zona = zonaRef.current;
    if (!zona || !onClose) return;
    const sheet = zona.parentElement;
    let startY = null, dy = 0, movio = false, activo = false;

    const yDe = e => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
    const abajo = e => {
      startY = yDe(e); dy = 0; movio = false; activo = true;
      if (e.cancelable) e.preventDefault(); // la zona de agarre nunca inicia scroll
      if (e.pointerId != null) { try { zona.setPointerCapture(e.pointerId); } catch { /* sin captura: el gesto igual funciona */ } }
    };
    const mover = e => {
      if (!activo) return;
      dy = yDe(e) - startY;
      if (Math.abs(dy) > 8) movio = true;
      if (dy > 0) {
        if (e.cancelable) e.preventDefault();
        sheet.style.transition = 'none';
        sheet.style.transform = `translateY(${dy}px)`; // el panel sigue al dedo
      }
    };
    const soltar = () => {
      if (!activo) return;
      activo = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 80 || !movio) onClose(); // arrastre largo o toque simple
    };

    zona.addEventListener('touchstart', abajo, { passive: false });
    zona.addEventListener('touchmove', mover, { passive: false });
    zona.addEventListener('touchend', soltar);
    zona.addEventListener('touchcancel', soltar);
    zona.addEventListener('pointerdown', abajo);
    zona.addEventListener('pointermove', mover);
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);

    return () => {
      zona.removeEventListener('touchstart', abajo);
      zona.removeEventListener('touchmove', mover);
      zona.removeEventListener('touchend', soltar);
      zona.removeEventListener('touchcancel', soltar);
      zona.removeEventListener('pointerdown', abajo);
      zona.removeEventListener('pointermove', mover);
      zona.removeEventListener('pointerup', soltar);
      zona.removeEventListener('pointercancel', soltar);
    };
  }, [onClose]);

  /* Cuerpo de la hoja: deslizar hacia abajo desde cualquier zona SIN elemento
     propio (inputs, botones, chips, teclado…) también la cierra — solo cuando
     el contenido está en el tope y el gesto es claramente hacia abajo. */
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !onClose) return;
    const EXCLUYE = 'input, textarea, select, button, .chips-scroll, .grid-cats, .teclado, .asa-zona';
    let activo = false, cerrando = false, decidido = false, cancelado = false, x0 = 0, y0 = 0;

    const inicio = e => {
      cerrando = false;
      if (e.touches.length !== 1 || sheet.scrollTop > 2 || e.target.closest?.(EXCLUYE)) { cancelado = true; return; }
      cancelado = false; decidido = false; activo = true;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    };
    const mover = e => {
      if (!activo || cancelado || cerrando) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!decidido) {
        if (Math.abs(dy) < 12 && Math.abs(dx) < 12) return;
        // solo un jalón claro hacia abajo cierra; hacia arriba o lateral es scroll
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { cancelado = true; return; }
        decidido = true;
      }
      if (e.cancelable) e.preventDefault(); // el dedo mueve la hoja, no el scroll
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };
    const soltar = () => {
      if (!activo || cerrando) return;
      activo = false;
      const dy = sheet.style.transform ? parseFloat(sheet.style.transform.replace(/[^\d.-]/g, '')) : 0;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (decidido && dy > 80) { cerrando = true; onClose?.(); }
    };
    sheet.addEventListener('touchstart', inicio, { passive: true });
    sheet.addEventListener('touchmove', mover, { passive: false });
    sheet.addEventListener('touchend', soltar);
    sheet.addEventListener('touchcancel', soltar);
    return () => {
      sheet.removeEventListener('touchstart', inicio);
      sheet.removeEventListener('touchmove', mover);
      sheet.removeEventListener('touchend', soltar);
      sheet.removeEventListener('touchcancel', soltar);
    };
  }, [onClose]);

  return html`<div class="sheet-fondo" onClick=${e => e.target === e.currentTarget && onClose?.()}>
    <div class="sheet" ref=${sheetRef}>
      <div class="asa-zona" ref=${zonaRef}><div class="asa"></div></div>
      ${titulo && html`<h2>${titulo}</h2>`}
      ${children}
    </div>
  </div>`;
}

/* ---------- Teclado numérico propio (con auto-repetición al mantener ⌫) ---------- */
export function Teclado({ onTecla }) {
  const del = ev => {
    ev.preventDefault();
    onTecla('del');
    let t1, t2;
    const limpiar = () => { clearTimeout(t1); clearInterval(t2); };
    t1 = setTimeout(() => { t2 = setInterval(() => onTecla('del'), 70); }, 450);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evName =>
      ev.currentTarget.addEventListener(evName, limpiar, { once: true }));
  };
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
  return html`<div class="teclado">
    ${teclas.map(k => html`<button key=${k}
      onPointerDown=${ev => { ev.preventDefault(); onTecla(k); }}>${k}</button>`)}
    <button key="del" onPointerDown=${del} onContextMenu=${e => e.preventDefault()}>⌫</button>
  </div>`;
}

/* ---------- Segmentado con pulgar deslizante (se toca Y se arrastra) ----------
   Gestos con listeners nativos directos: fiables en iOS. */
export function Segmentado({ opciones, valor, onChange, onArrastre, onFin }) {
  const ref = useRef(null);
  const movio = useRef(false);
  const drag = useRef(null); // { idx, iniX, dx, w }
  const [, forzar] = useState(0);
  const n = opciones.length;
  const idx = Math.max(0, opciones.findIndex(o => o[0] === valor));

  useEffect(() => {
    const seg = ref.current;
    if (!seg) return;
    const abajo = e => {
      try { seg.setPointerCapture(e.pointerId); } catch { /* sin captura: igual funciona */ }
      movio.current = false;
      const r = seg.getBoundingClientRect();
      const i = Math.max(0, opciones.findIndex(o => o[0] === valor));
      drag.current = { idx: i, iniX: e.clientX, dx: 0, w: (r.width - 6) / n || 1 };
      forzar(f => f + 1);
    };
    const mover = e => {
      const g = drag.current;
      if (!g) return;
      g.dx = e.clientX - g.iniX;
      if (Math.abs(g.dx) > 6) movio.current = true;
      onArrastre?.(Math.max(-1, Math.min(1, g.dx / (g.w * n))));
      forzar(f => f + 1);
    };
    const soltar = () => {
      const g = drag.current;
      if (!g) return;
      onFin?.();
      const objetivo = Math.min(n - 1, Math.max(0, Math.round(g.idx + g.dx / g.w)));
      drag.current = null;
      forzar(f => f + 1);
      if (objetivo !== g.idx) onChange(opciones[objetivo][0]);
    };
    seg.addEventListener('pointerdown', abajo);
    seg.addEventListener('pointermove', mover);
    seg.addEventListener('pointerup', soltar);
    seg.addEventListener('pointercancel', soltar);
    return () => {
      seg.removeEventListener('pointerdown', abajo);
      seg.removeEventListener('pointermove', mover);
      seg.removeEventListener('pointerup', soltar);
      seg.removeEventListener('pointercancel', soltar);
    };
  }, [valor, opciones, onChange]);

  const g = drag.current;
  const base = g ? g.idx : idx;
  const dx = g ? g.dx : 0;
  return html`<div class="seg" ref=${ref} style=${{ '--n': n }}>
    <div class=${'seg-thumb' + (g ? ' sin-trans' : '')} style=${{ transform: `translateX(calc(${base * 100}% + ${dx}px))` }}></div>
    ${opciones.map(([v, t]) => html`<button key=${v} type="button"
      class=${'seg-btn' + (v === valor ? ' sel' : '')}
      onClick=${() => { if (movio.current) { movio.current = false; return; } onChange(v); }}>${t}</button>`)}
  </div>`;
}

/* ---------- Fila de transacción (listas) ----------
   `perspectiva` (id de cuenta) cambia cómo se lee una transferencia cuando la
   lista ya está enfocada en una cuenta: lo que sale de ella es rojo, lo que
   entra es verde. Sin perspectiva solo se colorea lo que cruza la frontera de
   tu patrimonio (terceros); entre tus propias cuentas el dinero sigue siendo
   tuyo y se mantiene azul con flecha. */
export function FilaTx({ tx, cuentas, categorias, onClick, perspectiva = null }) {
  const cta = cuentas.find(c => c.id === tx.cuenta);
  const cat = categorias.find(c => c.id === tx.categoria);
  const destino = tx.cuentaDestino ? cuentas.find(c => c.id === tx.cuentaDestino) : null;
  const esPagoDeuda = tx.tipo === 'transferencia' && destino && (destino.tipo === 'tarjeta' || destino.tipo === 'deuda');
  let clase = tx.tipo === 'gasto' ? 'm-gasto' : tx.tipo === 'ingreso' ? 'm-ingreso' : 'm-transf';
  let signo = tx.tipo === 'gasto' ? '−' : tx.tipo === 'ingreso' ? '+' : '→ ';
  if (tx.tipo === 'transferencia') {
    const saleATercero = destino?.tipo === 'tercero' && cta?.tipo !== 'tercero';
    const vieneDeTercero = cta?.tipo === 'tercero' && destino?.tipo !== 'tercero';
    if (perspectiva) {
      const sale = tx.cuenta === perspectiva;
      clase = sale ? 'm-gasto' : 'm-ingreso';
      signo = sale ? '−' : '+';
    } else if (saleATercero) { clase = 'm-gasto'; signo = '−'; }
    else if (vieneDeTercero) { clase = 'm-ingreso'; signo = '+'; }
  }
  // El emoji vive SOLO en el ícono de la fila: títulos y subtítulos van limpios.
  const titulo = tx.tipo === 'transferencia'
    ? (esPagoDeuda ? `Pago de deuda · ${destino?.nombre || '?'}` : `${cta?.nombre || '?'} → ${destino?.nombre || '?'}`)
    : (tx.motivo || cat?.nombre || (tx.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'));
  const sub = [
    tx.motivo && cat && tx.tipo !== 'transferencia' ? cat.nombre
      : tx.tipo === 'transferencia' ? (esPagoDeuda ? 'Pago de deuda' : 'Transferencia') : null,
    cta && tx.tipo !== 'transferencia' ? cta.nombre : null,
    (tx.etiquetas || []).map(e => '#' + e).join(' ') || null].filter(Boolean).join(' · ');
  return html`<div class="fila" onClick=${onClick}>
    <span class="emoji">${tx.tipo === 'transferencia' ? (esPagoDeuda ? ICONO_TARJETA : ICONO_TRANSFER) : cat ? html`<${IconoCat} icono=${cat.icono} emoji=${cat.emoji} />` : (tx.tipo === 'ingreso' ? '💰' : '📦')}</span>
    <div class="cuerpo">
      <div class="titulo">${titulo}</div>
      <div class="sub">${sub}</div>
    </div>
    <div class="monto num ${clase}">${signo}${fmtConMoneda(tx.monto, tx.moneda)}
      <span class="hora">${fmtHora(tx.fecha)}</span>
    </div>
  </div>`;
}

/* ---------- Selector de cuentas (sheet con datos de la cuenta) ---------- */
export function PickerCuentas({ titulo = 'Elegir cuenta', cuentas, txs, tasas = [], onPick, onClose, excluir, sinSaldo = false }) {
  const [q, setQ] = useState('');
  const lista = cuentas
    .filter(c => !c.archivada && c.id !== excluir)
    .filter(c => !q || (c.nombre + ' ' + (c.banco || '') + ' ' + (c.numero || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.archivada ? 1 : 0) - (b.archivada ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  return html`<${Sheet} titulo=${titulo} onClose=${onClose}>
    <input type="search" placeholder="Buscar por nombre, banco o número…" value=${q} onInput=${e => setQ(e.target.value)} />
    <div style=${{ marginTop: '8px' }}>
      ${lista.map(c => html`<div key=${c.id} class="fila" onClick=${() => onPick(c)}>
        <span class="emoji"><${IconoCuenta} tipo=${c.tipo} /></span>
        <div class="cuerpo">
          <div class="titulo">${c.nombre}${c.tipo === 'tercero' && html`<span class="badge-tercero">Tercero</span>`}</div>
          <div class="sub">${[c.banco, c.numero, c.moneda].filter(Boolean).join(' · ')}</div>
        </div>
        <div class=${sinSaldo ? 'monto' : 'monto num ' + (saldoCuenta(c, txs, tasas) < 0 ? 'm-gasto' : '')}>${sinSaldo ? '' : fmtConMoneda(saldoCuenta(c, txs, tasas), c.moneda)}</div>
      </div>`)}
      ${lista.length === 0 && html`<div class="vacio">Sin resultados. Crea cuentas en la pestaña Cuentas.</div>`}
    </div>
  <//>`;
}

/* ---------- Grilla de categorías ---------- */
export function GridCategorias({ categorias, valor, onPick }) {
  return html`<div class="grid-cats">
    ${categorias.map(c => html`<button key=${c.id} class=${'cat' + (c.id === valor ? ' sel' : '')} onClick=${() => onPick(c.id === valor ? null : c.id)}>
      <span class="emoji"><${IconoCat} icono=${c.icono} emoji=${c.emoji} /></span><span>${c.nombre}</span>
    </button>`)}
  </div>`;
}

/* ---------- Chips de etiquetas (actividades) ---------- */
export function InputEtiquetas({ valor = [], sugerencias = [], onChange }) {
  const [texto, setTexto] = useState('');
  const agregar = t => {
    const limpio = t.trim().replace(/^#/, '');
    if (!limpio || valor.includes(limpio)) { setTexto(''); return; }
    onChange([...valor, limpio]); setTexto('');
  };
  const sug = texto ? sugerencias.filter(s => !valor.includes(s) && s.toLowerCase().includes(texto.toLowerCase())).slice(0, 4) : [];
  return html`<div>
    <div class="chips-scroll" style=${{ flexWrap: 'wrap' }}>
      ${valor.map(e => html`<button class="chip sel" onClick=${() => onChange(valor.filter(x => x !== e))}>#${e} ✕</button>`)}
      <input style=${{ width: '130px', padding: '8px 10px', borderRadius: '999px', border: 'none', background: 'var(--chip)', minWidth: '90px' }}
        placeholder="+ actividad…" value=${texto}
        onInput=${e => setTexto(e.target.value)}
        onKeyUp=${e => e.key === 'Enter' && agregar(texto)} />
    </div>
    ${sug.length > 0 && html`<div class="chips-scroll">
      ${sug.map(s => html`<button class="chip" onClick=${() => agregar(s)}>#${s}</button>`)}
    <//>`}
  <//>`;
}

/* ---------- Selector de moneda ---------- */
export const MONEDAS = ['GTQ', 'USD', 'EUR', 'MXN', 'COP', 'PEN', 'ARS', 'CLP', 'BOB', 'HNL', 'NIO', 'CRC', 'DOP', 'PYG', 'BRL'];
export const SelectorMoneda = ({ valor, onChange }) => html`
  <select value=${valor} onChange=${e => onChange(e.target.value)}>
    ${MONEDAS.map(m => html`<option key=${m} value=${m}>${m}</option>`)}
  </select>`;

/* ---------- Selector de fecha/hora ---------- */
export function SelectorFecha({ valor, onChange }) {
  const esHoy = valor === isoLocal(), esHoy0 = valor === isoDia() + 'T00:00';
  return html`<div>
    <div class="chips-scroll">
      <button class=${'chip' + (esHoy ? ' sel' : '')} onClick=${() => onChange(isoLocal())}>Ahora</button>
      <button class=${'chip' + (esHoy0 ? ' sel' : '')} onClick=${() => onChange(isoDia() + 'T00:00')}>Hoy (sin hora)</button>
      <button class="chip" onClick=${() => {
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
        onChange(isoLocal(ayer));
      }}>Ayer</button>
    </div>
    <input type="datetime-local" style=${{ marginTop: '8px' }} value=${valor.slice(0, 16)}
      onChange=${e => e.target.value && onChange(e.target.value)} />
    <div class="dato-cuenta" style=${{ marginTop: '4px' }}>Registrado como: ${fmtFecha(valor)} · ${fmtHora(valor)}</div>
  </div>`;
}

/* ---------- Comprobantes (fotos) ---------- */
export function Comprobantes({ existentes = [], nuevas = [], onQuitarExistente, onQuitarNueva, onAgregar }) {
  const [preview, setPreview] = useState(null);
  const cam = useRef(), bib = useRef();
  const elegir = async archivo => { if (archivo) onAgregar(archivo); };
  return html`<div>
    <div class="chips-scroll">
      <button class="chip" onClick=${() => cam.current.click()}>${ICONO_CAMARA} Tomar foto</button>
      <button class="chip" onClick=${() => bib.current.click()}>${ICONO_IMAGEN} Elegir imagen</button>
    </div>
    <input ref=${cam} type="file" accept="image/*" capture="environment" hidden onChange=${e => elegir(e.target.files[0])} />
    <input ref=${bib} type="file" accept="image/*" hidden onChange=${e => elegir(e.target.files[0])} />
    ${(existentes.length + nuevas.length) > 0 && html`<div class="comprobantes">
      ${existentes.map(a => html`<div key=${a.id} class="comprobante" onClick=${() => setPreview(a.url)}>
        <img src=${a.url} alt="comprobante" />
        <button class="quitar" onClick=${e => { e.stopPropagation(); onQuitarExistente(a.id); }}>✕</button>
      <//>`)}
      ${nuevas.map(n => html`<div key=${n.id} class="comprobante" onClick=${() => setPreview(n.url)}>
        <img src=${n.url} alt="comprobante" />
        <button class="quitar" onClick=${e => { e.stopPropagation(); onQuitarNueva(n.id); }}>✕</button>
      <//>`)}
    <//>`}
    ${preview && html`<div class="preview-foto" onClick=${() => setPreview(null)}>
      <button class="cerrar">✕</button>
      <img src=${preview} alt="comprobante" />
    <//>`}
  <//>`;
}

/* ---------- Selector de icono de categoría: solo SVG, sin emojis ---------- */
export function IconoPicker({ valor, onPick }) {
  return html`<div class="grid-cats" style=${{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
    ${Object.keys(ICONOS_CATEGORIA).map(id => html`<button key=${id} type="button" aria-label=${id}
      class=${'cat' + (id === valor ? ' sel' : '')} style=${{ padding: '9px 2px' }}
      onClick=${() => onPick(id)}><span class="emoji"><${IconoId} id=${id} /></span></button>`)}
  <//>`;
}
