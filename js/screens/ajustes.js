// Ajustes: moneda y tasas, categorías, etiquetas, presupuestos, datos (exportar/importar),
// instalación en iPhone y acerca de.
import { html, useState, useEffect, useRef } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, recargar, toast, nav } from '../store.js';
import { Sheet, SelectorMoneda, IconoPicker, Segmentado } from '../ui.js';
import { uid, textoAEntero, enteroATexto, isoDia, fmtConMoneda } from '../util.js';
import { exportarCSV, exportarJSON, importarJSON, copiarParaIA } from '../export.js';
import { ICONO_ETIQUETA, IconoCat } from '../iconos.js';

const VERSION = '1.77';

export default function Ajustes() {
  const S = useStore();
  const [panel, setPanel] = useState(null);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const filas = [
    ['moneda', 'Moneda principal', 'Reportes y presupuestos en ' + S.ajustes.monedaPrincipal],
    ['tasas', 'Tasas de cambio', S.tasas.length ? S.tasas.length + ' tasa(s) registrada(s)' : 'Para cuentas en varias monedas'],
    ['categorias', 'Categorías', S.categorias.length + ' categorías'],
    ['etiquetas', 'Actividades / etiquetas', S.etiquetas.length + ' etiquetas'],
    ['presupuestos', 'Presupuestos mensuales', 'Por categoría, en ' + S.ajustes.monedaPrincipal],
    ['datos', 'Mis datos', 'Exportar CSV/JSON, respaldo, copiar para IA, importar'],
    ['instalar', 'Instalar en iPhone', standalone ? 'Ya instalada como app' : 'Pantalla de inicio, offline'],
  ];

  return html`<div class="vista">
    <div class="cabecera">
      <h1>Ajustes</h1>
      <div class="acciones"><button class="btn-icono" onClick=${() => nav('#/')}>←</button></div>
    </div>

    <div class="tarjeta" style=${{ paddingTop: '4px' }}>
      ${filas.map(([k, titulo, sub]) => html`
        <div key=${k} class="fila" onClick=${() => setPanel(k)}>
          <div class="cuerpo"><div class="titulo">${titulo}</div><div class="sub">${sub}</div></div>
          <span style=${{ color: 'var(--muted)' }}>›</span>
        </div>`)}
    </div>

    <div class="tarjeta">
      <h3>Acerca de</h3>
      <div class="dato-cuenta" style=${{ lineHeight: 1.7 }}>
        <b>Finanzas v${VERSION}</b> — app personal local: tus datos viven en este dispositivo y en tus respaldos,
        no en servidores de terceros. Funciona sin internet. Formato de respaldo abierto (JSON/CSV).
      </div>
    </div>

    ${panel === 'moneda' && html`<${Sheet} titulo="Moneda principal" onClose=${() => setPanel(null)}>
      <${SelectorMoneda} valor=${S.ajustes.monedaPrincipal} onChange=${async m => {
        await fin.setAjuste('app', { ...S.ajustes, monedaPrincipal: m });
        await recargar(); toast('Moneda principal: ' + m);
      }} />
      <div class="dato-cuenta" style=${{ marginTop: '8px' }}>Se usa para estadísticas, presupuestos y patrimonio. Cada cuenta conserva su propia moneda.</div>
    <//>`}

    ${panel === 'tasas' && html`<${PanelTasas} store=${S} cerrar=${() => setPanel(null)} />`}
    ${panel === 'categorias' && html`<${PanelCategorias} store=${S} cerrar=${() => setPanel(null)} />`}
    ${panel === 'etiquetas' && html`<${PanelEtiquetas} store=${S} cerrar=${() => setPanel(null)} />`}
    ${panel === 'presupuestos' && html`<${PanelPresupuestos} store=${S} cerrar=${() => setPanel(null)} />`}
    ${panel === 'datos' && html`<${PanelDatos} store=${S} cerrar=${() => setPanel(null)} />`}
    ${panel === 'instalar' && html`<${Sheet} titulo="Instalar en tu iPhone" onClose=${() => setPanel(null)}>
      <div class="dato-cuenta" style=${{ lineHeight: 1.9 }}>
        ${standalone
          ? html`<b>Ya está instalada</b> como aplicación. Funciona sin internet.`
          : html`<b>Una vez, desde Safari:</b><br/>
            1. Toca el botón <b>Compartir</b> (cuadro con flecha ↑).<br/>
            2. Elige <b>“Añadir a pantalla de inicio”</b>.<br/>
            3. Confirma <b>Añadir</b>.<br/><br/>
            La app abrirá a pantalla completa, funcionará offline y sus datos no se borran por inactividad.`}
        <br/><br/>También úsala desde tu laptop: abre la misma dirección en el navegador.
      </div>
    <//>`}
  </div>`;
}

/* ================= Panel Tasas ================= */
function PanelTasas({ store: S, cerrar }) {
  const [f, setF] = useState({ de: 'USD', a: S.ajustes.monedaPrincipal, valor: '', fecha: isoDia() });
  const agregar = async () => {
    const valor = parseFloat(f.valor.replace(',', '.'));
    if (!(valor > 0)) { toast('Valor inválido'); return; }
    await fin.guardarTasa({ de: f.de, a: f.a, valor, fecha: f.fecha });
    await recargar();
    toast('✓ Tasa guardada');
    setF({ ...f, valor: '' });
  };
  const ordenadas = [...S.tasas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return html`<${Sheet} titulo="Tasas de cambio" onClose=${cerrar}>
    <div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      Ej.: 1 USD = 7.80 GTQ. Las estadísticas convierten con la tasa vigente más cercana a cada movimiento.
      Sin tasa registrada se asume 1:1.
    </div>
    ${ordenadas.map(t => html`<div key=${t.id} class="fila">
      <div class="cuerpo"><div class="titulo num">1 ${t.de} = ${t.valor} ${t.a}</div><div class="sub">desde ${t.fecha}</div></div>
      <button class="chip" onClick=${async () => { await fin.borrarTasa(t.id); await recargar(); }}>✕</button>
    </div>`)}
    ${ordenadas.length === 0 && html`<div class="vacio">Sin tasas registradas.</div>`}
    <div style=${{ display: 'flex', gap: '6px', alignItems: 'end', marginTop: '12px' }}>
      <div style=${{ flex: 1 }}><div class="dato-cuenta">1 unidad de</div><${SelectorMoneda} valor=${f.de} onChange=${de => setF({ ...f, de })} /></div>
      <span style=${{ paddingBottom: '10px' }}>=</span>
      <div style=${{ flex: 1 }}><div class="dato-cuenta">equivale a (en)</div><${SelectorMoneda} valor=${f.a} onChange=${a => setF({ ...f, a })} /></div>
      <input style=${{ width: '84px', textAlign: 'right' }} inputMode="decimal" placeholder="7.80" value=${f.valor}
        onInput=${e => setF({ ...f, valor: e.target.value })} />
    </div>
    <input type="date" style=${{ marginTop: '8px' }} value=${f.fecha} onChange=${e => setF({ ...f, fecha: e.target.value || isoDia() })} />
    <button class="btn btn-primario" style=${{ marginTop: '10px' }} onClick=${agregar}>Añadir tasa</button>
  <//>`;
}

/* ================= Panel Categorías ================= */
function PanelCategorias({ store: S, cerrar }) {
  const [tipo, setTipo] = useState('gasto');
  const [edit, setEdit] = useState(null);
  const lista = S.categorias.filter(c => c.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return html`<${Sheet} titulo="Categorías" onClose=${cerrar}>
    <${Segmentado} opciones=${[['gasto', 'Gastos'], ['ingreso', 'Ingresos']]} valor=${tipo} onChange=${setTipo} />
    ${lista.map(c => html`<div key=${c.id} class="fila" onClick=${() => setEdit(c)}>
      <span class="emoji"><${IconoCat} icono=${c.icono} emoji=${c.emoji} /></span>
      <div class="cuerpo"><div class="titulo">${c.nombre}</div></div>
      <span style=${{ color: 'var(--muted)' }}>›</span>
    </div>`)}
    <button class="btn btn-suave" style=${{ marginTop: '10px' }} onClick=${() => setEdit({ icono: null, emoji: null, nombre: '', tipo })}>＋ Nueva categoría</button>

    ${edit && html`<${Sheet} titulo=${edit.id ? 'Editar' : 'Nueva categoría'} onClose=${() => setEdit(null)}>
      <${EditorCategoria} c=${edit} store=${S} cerrar=${() => setEdit(null)} />
    <//>`}
  <//>`;
}

function EditorCategoria({ c, store: S, cerrar }) {
  const [f, setF] = useState({ icono: c.icono || null, emoji: c.emoji || null, nombre: c.nombre || '', tipo: c.tipo || 'gasto' });
  const guardar = async () => {
    if (!f.nombre.trim()) { toast('Ponle nombre'); return; }
    if (!f.icono && !f.emoji) { toast('Elige un icono'); return; }
    await fin.guardarCategoria({ id: c.id || uid(), ...f, nombre: f.nombre.trim() });
    await recargar(); cerrar();
  };
  const borrar = async () => {
    if (!confirm('¿Borrar "' + f.nombre + '"?')) return;
    try { await fin.borrarCategoria(c.id); await recargar(); cerrar(); }
    catch (e) { toast(e.message); }
  };
  return html`<div>
    ${f.icono || f.emoji ? html`<div style=${{ textAlign: 'center', marginBottom: '8px' }}><${IconoCat} icono=${f.icono} emoji=${f.emoji} /></div>` : null}
    <${IconoPicker} valor=${f.icono} onPick=${icono => setF({ ...f, icono })} />
    <input style=${{ marginTop: '10px' }} placeholder="Nombre" value=${f.nombre} onInput=${e => setF({ ...f, nombre: e.target.value })} />
    <${Segmentado} opciones=${[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} valor=${f.tipo} onChange=${t => setF({ ...f, tipo: t })} />
    <button class="btn btn-primario" style=${{ marginTop: '12px' }} onClick=${guardar}>Guardar</button>
    ${c.id && html`<button class="btn btn-rojo" style=${{ marginTop: '8px' }} onClick=${borrar}>Eliminar</button>`}
  </div>`;
}

/* ================= Panel Etiquetas ================= */
function PanelEtiquetas({ store: S, cerrar }) {
  return html`<${Sheet} titulo="Actividades / etiquetas" onClose=${cerrar}>
    <div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      Las etiquetas agrupan gastos a través de categorías (p. ej. <b>#carro</b> = combustible + reparaciones + seguro).
    </div>
    ${S.etiquetas.map(e => html`<div key=${e.id} class="fila">
      <span class="emoji">${ICONO_ETIQUETA}</span>
      <div class="cuerpo"><div class="titulo">#${e.nombre}</div></div>
      <button class="chip" onClick=${async () => {
        const usada = (await fin.todasTx()).some(t => (t.etiquetas || []).includes(e.nombre));
        if (usada) { toast('Está en uso en movimientos; primero quítala de ellos.'); return; }
        await fin.borrarEtiqueta(e.id); await recargar();
      }}>✕</button>
    </div>`)}
    ${S.etiquetas.length === 0 && html`<div class="vacio">Se crean solas cuando las usas al registrar un movimiento.</div>`}
  <//>`;
}

/* ================= Panel Presupuestos ================= */
function PanelPresupuestos({ store: S, cerrar }) {
  const principal = S.ajustes.monedaPrincipal;
  const gastos = S.categorias.filter(c => c.tipo === 'gasto').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const presup = new Map(S.presupuestos.map(p => [p.categoria, p.monto]));
  const guardar = async (categoria, texto) => {
    const monto = textoAEntero(texto || '0', 2) || 0;
    if (monto > 0) await fin.guardarPresupuesto({ categoria, monto });
    else await fin.borrarPresupuesto(categoria);
    await recargar();
  };
  const total = S.presupuestos.reduce((s, p) => s + p.monto, 0);
  return html`<${Sheet} titulo="Presupuestos mensuales" onClose=${cerrar}>
    <div class="dato-cuenta" style=${{ marginBottom: '10px' }}>
      Monto máximo por categoría cada mes, en ${principal}. Déjalo vacío para no presupuestar.
    </div>
    ${gastos.map(c => html`<div key=${c.id} style=${{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style=${{ width: '26px', textAlign: 'center' }}><${IconoCat} icono=${c.icono} emoji=${c.emoji} /></span>
      <span style=${{ flex: 1, fontSize: '14.5px', fontWeight: 600 }}>${c.nombre}</span>
      <input style=${{ width: '110px', textAlign: 'right' }} inputMode="decimal" placeholder="—"
        defaultValue=${presup.get(c.id) ? enteroATexto(presup.get(c.id), 2) : ''}
        onBlur=${e => guardar(c.id, e.target.value)} />
    </div>`)}
    ${total > 0 && html`<div class="grupo-dia"><span class="fecha">Total presupuestado</span>
      <span class="num" style=${{ fontWeight: 800 }}>${fmtConMoneda(total, principal)}</span></div>`}
  <//>`;
}

/* ================= Panel Datos ================= */
function PanelDatos({ store: S, cerrar }) {
  const [mesesIA, setMesesIA] = useState(3);
  const [stats, setStats] = useState(null);
  const [textoIA, setTextoIA] = useState(null);
  const archivo = useRef();

  useEffect(() => {
    (async () => {
      const nTx = await fin._db().transacciones.filter(t => !t.eliminada).count();
      const nAdj = await fin._db().adjuntos.count();
      let tam = '';
      try {
        const est = await navigator.storage.estimate();
        tam = (est.usage / 1048576).toFixed(1) + ' MB usados';
      } catch { }
      setStats(`${nTx} movimientos · ${nAdj} comprobantes ${tam ? '· ' + tam : ''}`);
    })();
  }, []);

  const ctx = { tasas: S.tasas, principal: S.ajustes.monedaPrincipal, cuentas: S.cuentas, categorias: S.categorias };
  const [ocupado, setOcupado] = useState(false);

  return html`<${Sheet} titulo="Mis datos" onClose=${cerrar}>
    <div class="dato-cuenta" style=${{ marginBottom: '12px' }}>${stats || '…'}</div>

    <button class="btn btn-primario" disabled=${ocupado} onClick=${async () => { setOcupado(true); try { await exportarCSV(ctx); } catch (e) { toast('Error: ' + e.message); } setOcupado(false); }}>
      Exportar CSV (Excel / Sheets)
    </button>
    <div class="dato-cuenta" style=${{ margin: '6px 0 10px' }}>
      Columnas: fecha, hora, tipo, monto, moneda, monto convertido, cuenta, categoría, etiquetas, motivo.
    </div>

    <div style=${{ display: 'flex', gap: '8px' }}>
      <button class="btn btn-suave" disabled=${ocupado} onClick=${async () => { setOcupado(true); try { await exportarJSON({ incluirImagenes: false }); } catch (e) { toast('Error: ' + e.message); } setOcupado(false); }}>
        Respaldo JSON
      </button>
      <button class="btn btn-suave" disabled=${ocupado} onClick=${async () => { setOcupado(true); try { await exportarJSON({ incluirImagenes: true }); } catch (e) { toast('Error: ' + e.message); } setOcupado(false); }}>
        Con comprobantes
      </button>
    </div>
    <div class="dato-cuenta" style=${{ margin: '6px 0 10px' }}>
      El respaldo completo incluye todo (cuentas, categorías, movimientos, ajustes) y sirve para restaurar o mudar de dispositivo.
    </div>

    <div class="tarjeta" style=${{ background: 'var(--accent-soft)', boxShadow: 'none' }}>
      <h3 style=${{ color: 'var(--accent)' }}>Copiar para IA</h3>
      <div class="dato-cuenta" style=${{ marginBottom: '8px' }}>
        Copia al portapapeles un JSON con tu patrimonio y los movimientos recientes, listo para pegar en
        ChatGPT (u otra IA) con una instrucción de análisis incluida. No incluye comprobantes.
      </div>
      <div class="chips-scroll" style=${{ marginBottom: '8px' }}>
        ${[3, 6, 12].map(m => html`<button key=${m} class=${'chip' + (mesesIA === m ? ' sel' : '')} onClick=${() => setMesesIA(m)}>${m} meses</button>`)}
      </div>
      <button class="btn btn-primario" disabled=${ocupado} onClick=${async () => {
        setOcupado(true);
        try {
          const r = await copiarParaIA({ ...ctx, meses: mesesIA });
          if (r.ok) toast(`✓ ${r.n} movimientos copiados. Pégalo en tu IA.`);
          else if (r.n === 0) toast('No hay movimientos en ese periodo.');
          else setTextoIA(r.texto);
        } catch (e) { toast('Error: ' + e.message); }
        setOcupado(false);
      }}>Copiar análisis de ${mesesIA} meses</button>
      ${textoIA && html`<div style=${{ marginTop: '10px' }}>
        <div class="dato-cuenta">No se pudo usar el portapapeles aquí. Copia manualmente el texto de abajo:</div>
        <textarea rows="8" style=${{ fontSize: '11px', fontFamily: 'monospace', marginTop: '6px' }} readonly
          onClick=${e => e.target.select()}>${textoIA}</textarea>
      <//>`}
    </div>

    <button class="btn btn-suave" onClick=${() => archivo.current?.click()}>Importar respaldo (JSON)</button>
    <input ref=${archivo} type="file" accept="application/json,.json" hidden onChange=${async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!confirm('Importar reemplaza TODOS los datos actuales por los del respaldo. ¿Continuar?')) return;
      try {
        await importarJSON(await f.text());
        await recargar();
        toast('✓ Respaldo importado');
      } catch (err) { toast('Error al importar: ' + err.message); }
    }} />
    <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
      La importación reemplaza todo (es para restaurar o migrar de dispositivo). Exporta un respaldo antes.
    </div>
  <//>`;
}
