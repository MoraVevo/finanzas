// Movimientos: historial por mes con búsqueda y filtros. Tocar = editar/corregir.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav } from '../store.js';
import { FilaTx, PickerCuentas, Sheet } from '../ui.js';
import { convertir } from '../model.js';
import { ICONO_ENTRA, ICONO_SALE, ICONO_TRANSFER, ICONO_ETIQUETA, IconoCat } from '../iconos.js';
import { fmtConMoneda, fmtFecha, claveMesActual, sumarMesClave, rangoMes, fmtMesLargo } from '../util.js';

const NOMBRE_TIPO = { gasto: 'Gastos', ingreso: 'Ingresos', transferencia: 'Transferencias' };

export default function Movimientos() {
  const S = useStore();
  const [clave, setClave] = useState(claveMesActual());
  const [txs, setTxs] = useState(null);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState({ tipo: null, cuenta: null, categoria: null, etiqueta: null });
  const [sheet, setSheet] = useState(null); // 'tipo' | 'cuenta' | 'categoria' | 'etiqueta'

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [desde, hasta] = rangoMes(clave);
      const data = await fin.txPorRango(desde, hasta);
      if (vivo) setTxs(data.reverse());
    })();
    return () => { vivo = false; };
  }, [clave, S.cuentas, S.ajustes]);

  if (!txs) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  const principal = S.ajustes.monedaPrincipal;
  const catPorId = new Map(S.categorias.map(c => [c.id, c]));
  const ctaPorId = new Map(S.cuentas.map(c => [c.id, c]));

  const filtradas = txs.filter(t => {
    if (filtro.tipo && t.tipo !== filtro.tipo) return false;
    if (filtro.cuenta && t.cuenta !== filtro.cuenta && t.cuentaDestino !== filtro.cuenta) return false;
    if (filtro.categoria && t.categoria !== filtro.categoria) return false;
    if (filtro.etiqueta && !(t.etiquetas || []).includes(filtro.etiqueta)) return false;
    if (q) {
      const texto = [
        t.motivo, catPorId.get(t.categoria)?.nombre, ctaPorId.get(t.cuenta)?.nombre,
        t.cuentaDestino ? ctaPorId.get(t.cuentaDestino)?.nombre : '', (t.etiquetas || []).join(' ')
      ].filter(Boolean).join(' ').toLowerCase();
      if (!texto.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const totales = { gasto: 0, ingreso: 0 };
  for (const t of filtradas) {
    if (t.tipo === 'gasto') totales.gasto += convertir(t.monto, t.moneda, principal, S.tasas, t.fecha);
    if (t.tipo === 'ingreso') totales.ingreso += convertir(t.monto, t.moneda, principal, S.tasas, t.fecha);
  }

  const grupos = [];
  for (const t of filtradas) {
    const dia = t.fecha.slice(0, 10);
    let g = grupos.find(x => x.dia === dia);
    if (!g) { g = { dia, txs: [], entra: 0, sale: 0 }; grupos.push(g); }
    g.txs.push(t);
    const monto = convertir(t.monto, t.moneda, principal, S.tasas, t.fecha);
    if (t.tipo === 'gasto') g.sale += monto;
    else if (t.tipo === 'ingreso') g.entra += monto;
  }

  const hayFiltros = filtro.tipo || filtro.cuenta || filtro.categoria || filtro.etiqueta || q;

  return html`<div class="vista">
    <div class="cabecera"><h1>Movimientos</h1></div>

    <div class="nav-mes">
      <button onClick=${() => setClave(sumarMesClave(clave, -1))}>‹</button>
      <span class="mes">${fmtMesLargo(clave)}</span>
      ${clave !== claveMesActual()
        ? html`<button onClick=${() => setClave(claveMesActual())}>Hoy</button>`
        : html`<button style=${{ opacity: .3 }}>›</button>`}
    </div>

    <input type="search" placeholder="Buscar motivo, categoría, cuenta, #etiqueta…" value=${q}
      onInput=${e => setQ(e.target.value)} style=${{ marginBottom: '8px' }} />

    <div class="chips-scroll">
      <button class=${'chip' + (filtro.tipo ? ' sel' : '')} onClick=${() => setSheet('tipo')}>
        ${filtro.tipo ? NOMBRE_TIPO[filtro.tipo] : 'Tipo'}
      </button>
      <button class=${'chip' + (filtro.cuenta ? ' sel' : '')} onClick=${() => setSheet('cuenta')}>
        ${filtro.cuenta ? ctaPorId.get(filtro.cuenta)?.nombre || 'Cuenta' : 'Cuenta'}
      </button>
      <button class=${'chip' + (filtro.categoria ? ' sel' : '')} onClick=${() => setSheet('categoria')}>
        ${filtro.categoria ? catPorId.get(filtro.categoria)?.nombre || 'Categoría' : 'Categoría'}
      </button>
      <button class=${'chip' + (filtro.etiqueta ? ' sel' : '')} onClick=${() => setSheet('etiqueta')}>
        ${filtro.etiqueta ? '#' + filtro.etiqueta : 'Actividad'}
      </button>
      ${hayFiltros && html`<button class="chip" onClick=${() => { setFiltro({ tipo: null, cuenta: null, categoria: null, etiqueta: null }); setQ(''); }}>✕ Limpiar</button>`}
    </div>

    <div class="tarjeta" style=${{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '12px' }}>
      <div><div style=${{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 700 }}>GASTOS</div>
        <div class="num m-gasto" style=${{ fontWeight: 800 }}>${fmtConMoneda(totales.gasto, principal)}</div></div>
      <div><div style=${{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 700 }}>INGRESOS</div>
        <div class="num m-ingreso" style=${{ fontWeight: 800 }}>${fmtConMoneda(totales.ingreso, principal)}</div></div>
      <div><div style=${{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 700 }}>MOVIMIENTOS</div>
        <div class="num" style=${{ fontWeight: 800 }}>${filtradas.length}</div></div>
    </div>

    ${grupos.map(g => html`<div key=${g.dia} class="tarjeta" style=${{ paddingTop: '6px' }}>
      <div class="grupo-dia"><span class="fecha">${fmtFecha(g.dia)}</span>
        <span class="total num">
          ${g.entra > 0 && html`<span style=${{ color: 'var(--ingreso)', fontWeight: 700 }}>+${fmtConMoneda(g.entra, principal)}</span>`}
          ${g.entra > 0 && g.sale > 0 && ' · '}
          ${g.sale > 0 && html`<span style=${{ color: 'var(--gasto)', fontWeight: 700 }}>−${fmtConMoneda(g.sale, principal)}</span>`}
        </span>
      </div>
      ${g.txs.map(tx => html`<${FilaTx} key=${tx.id} tx=${tx} cuentas=${S.cuentas} categorias=${S.categorias}
        perspectiva=${filtro.cuenta} onClick=${() => nav('#/agregar?id=' + tx.id)} />`)}
    </div>`)}

    ${grupos.length === 0 && html`<div class="vacio">Sin movimientos${hayFiltros ? ' con estos filtros' : ' este mes'}.</div>`}

    ${sheet === 'tipo' && html`<${Sheet} titulo="Filtrar por tipo" onClose=${() => setSheet(null)}>
      ${['gasto', 'ingreso', 'transferencia'].map(t => html`<div key=${t} class="fila" onClick=${() => { setFiltro({ ...filtro, tipo: filtro.tipo === t ? null : t }); setSheet(null); }}>
        <span class="emoji">${t === 'gasto' ? ICONO_SALE : t === 'ingreso' ? ICONO_ENTRA : ICONO_TRANSFER}</span>
        <div class="cuerpo"><div class="titulo">${NOMBRE_TIPO[t]}</div></div>
      </div>`)}
    <//>`}

    ${sheet === 'cuenta' && html`<${PickerCuentas} titulo="Filtrar por cuenta" cuentas=${S.cuentas} txs=${[]} tasas=${S.tasas}
      onPick=${c => { setFiltro({ ...filtro, cuenta: filtro.cuenta === c.id ? null : c.id }); setSheet(null); }}
      onClose=${() => setSheet(null)} />`}

    ${sheet === 'categoria' && html`<${Sheet} titulo="Filtrar por categoría" onClose=${() => setSheet(null)}>
      ${S.categorias.map(c => html`<div key=${c.id} class="fila" onClick=${() => { setFiltro({ ...filtro, categoria: filtro.categoria === c.id ? null : c.id }); setSheet(null); }}>
        <span class="emoji"><${IconoCat} icono=${c.icono} emoji=${c.emoji} /></span>
        <div class="cuerpo"><div class="titulo">${c.nombre} <span class="dato-cuenta">(${c.tipo})</span></div></div>
      </div>`)}
    <//>`}

    ${sheet === 'etiqueta' && html`<${Sheet} titulo="Filtrar por actividad" onClose=${() => setSheet(null)}>
      ${S.etiquetas.length === 0 && html`<div class="vacio">Aún no tienes etiquetas. Agrégalas al registrar movimientos.</div>`}
      ${S.etiquetas.map(e => html`<div key=${e.id} class="fila" onClick=${() => { setFiltro({ ...filtro, etiqueta: filtro.etiqueta === e.nombre ? null : e.nombre }); setSheet(null); }}>
        <span class="emoji">${ICONO_ETIQUETA}</span>
        <div class="cuerpo"><div class="titulo">#${e.nombre}</div></div>
      </div>`)}
    <//>`}
  </div>`;
}
