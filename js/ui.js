// Componentes compartidos de UI (Preact + htm, sin build).
import { html, useState, useEffect, useRef } from '../vendor/preact-standalone.module.js';
import { TIPOS_CUENTA, saldoCuenta } from './model.js';
import { fmtConMoneda, fmtFecha, fmtHora, isoLocal, isoDia } from './util.js';

/* ---------- Sheet: panel deslizante inferior ----------
   Se cierra tocando la asa, deslizando la asa hacia abajo (gesto nativo),
   tocando el fondo oscuro o con Escape en laptop. */
export function Sheet({ titulo, onClose, children }) {
  const el = useRef(null);
  const gesto = useRef({ startY: null, dy: 0, movio: false });

  useEffect(() => {
    if (!onClose) return;
    const f = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  const agarrar = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesto.current = { startY: e.clientY, dy: 0, movio: false, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId); // el gesto sigue al dedo/aunque salga de la zona
  };
  const mover = e => {
    const g = gesto.current;
    if (g.startY == null || e.pointerId !== g.id) return;
    g.dy = e.clientY - g.startY;
    if (Math.abs(g.dy) > 8) g.movio = true;
    if (g.dy > 0 && el.current) {
      el.current.style.transition = 'none';
      el.current.style.transform = `translateY(${g.dy}px)`; // el panel sigue al dedo
    }
  };
  const soltar = e => {
    const g = gesto.current;
    if (g.startY == null || (e && e.pointerId !== g.id)) return;
    if (el.current) { el.current.style.transition = ''; el.current.style.transform = ''; }
    if (g.dy > 80 && onClose) onClose();
    gesto.current = { startY: null, dy: 0, movio: g.movio };
  };
  const tocarAsa = () => {
    // un toque simple (sin arrastre) también cierra
    if (gesto.current.movio) { gesto.current.movio = false; return; }
    onClose?.();
  };

  return html`<div class="sheet-fondo" onClick=${e => e.target === e.currentTarget && onClose?.()}>
    <div class="sheet" ref=${el}>
      <div class="asa-zona"
        onPointerDown=${agarrar} onPointerMove=${mover} onPointerUp=${soltar} onPointerCancel=${soltar}
        onClick=${tocarAsa}>
        <div class="asa"></div>
      </div>
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

/* ---------- Fila de transacción (listas) ---------- */
export function FilaTx({ tx, cuentas, categorias, onClick }) {
  const cta = cuentas.find(c => c.id === tx.cuenta);
  const cat = categorias.find(c => c.id === tx.categoria);
  const destino = tx.cuentaDestino ? cuentas.find(c => c.id === tx.cuentaDestino) : null;
  const clase = tx.tipo === 'gasto' ? 'm-gasto' : tx.tipo === 'ingreso' ? 'm-ingreso' : 'm-transf';
  const signo = tx.tipo === 'gasto' ? '−' : tx.tipo === 'ingreso' ? '+' : '→ ';
  const titulo = tx.tipo === 'transferencia'
    ? `${cta?.nombre || '?'} → ${destino?.nombre || '?'}`
    : (tx.motivo || `${cat?.emoji || ''} ${cat?.nombre || (tx.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')}`.trim());
  const sub = [
    tx.motivo && cat && tx.tipo !== 'transferencia' ? `${cat.emoji} ${cat.nombre}` : (tx.tipo === 'transferencia' ? '🔁 Transferencia' : null),
    cta && tx.tipo !== 'transferencia' ? cta.nombre : null,
    (tx.etiquetas || []).map(e => '#' + e).join(' ') || null].filter(Boolean).join(' · ');
  return html`<div class="fila" onClick=${onClick}>
    <span class="emoji">${tx.tipo === 'transferencia' ? '🔁' : (cat?.emoji || (tx.tipo === 'ingreso' ? '💰' : '📦'))}</span>
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
        <span class="emoji">${TIPOS_CUENTA[c.tipo].emoji}</span>
        <div class="cuerpo">
          <div class="titulo">${c.nombre}</div>
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
      <span class="emoji">${c.emoji}</span><span>${c.nombre}</span>
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
      <button class="chip" onClick=${() => cam.current.click()}>📷 Tomar foto</button>
      <button class="chip" onClick=${() => bib.current.click()}>🖼️ Elegir imagen</button>
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

/* ---------- Selector de emoji ---------- */
const EMOJIS = ('🍔 🍕 🍟 🌮 🍔 🍣 🍜 🍱 🥗 🍿 🍩 ☕ 🍺 🥤 🛒 🍽️ 🚗 🏍️ ⛽ 🛠️ 🧰 🚙 🚌 ✈️ 🚕 🚲 ⛽ 🔧 🏁 🅿️ 🏠 🛋️ 💡 🧻 🧹 🧺 🔌 🚿 📱 💻 🖥️ 🎧 🎮 📺 🎬 🎭 🎫 🎣 ⚽ 🏀 🏋️ 🏊 🏕️ 🎿 👕 👖 👟 🎒 🕶️ 💍 🧴 💊 🩺 🏥 🦷 ❤️ 🧠 📚 ✏️ 🎓 🖊️ 📝 🐶 🐱 🐾 🐦 🌱 🌳 💐 🎁 🎉 🎂 👶 👨 👩 👴 👵 💍 👥 💰 💳 🏦 📈 📉 💵 🧾 📦 🛠️ 🔧 💼 🏆 ⭐ 🔥 🌍 🏖️ 🗺️ 🧳 📷 🔒 🧮 ⏰ ✂️ 🧷').split(' ');
export function EmojiPicker({ valor, onPick }) {
  return html`<div class="grid-cats" style=${{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
    ${EMOJIS.map((e, i) => html`<button key=${i} class=${'cat' + (e === valor ? ' sel' : '')}
      style=${{ padding: '7px 2px', fontSize: '19px' }} onClick=${() => onPick(e)}><span class="emoji">${e}</span></button>`)}
  <//>`;
}
