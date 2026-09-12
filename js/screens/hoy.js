// Pantalla Hoy: tu situación de un vistazo + acceso inmediato a registrar.
import { html, useState, useEffect } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav } from '../store.js';
import { patrimonio, saldoConvertido, saldoCuenta, statsMes, TIPOS_CUENTA, convertir } from '../model.js';
import { FilaTx } from '../ui.js';
import { fmtConMoneda, fmtFecha, claveMesActual, rangoMes, fmtMesLargo } from '../util.js';

export default function Hoy() {
  const S = useStore();
  const [txs, setTxs] = useState(null);
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const todas = await fin.todasTx();
      const ult = await fin.recientes(15);
      if (vivo) { setTxs(todas); setRecientes(ult); }
    })();
    return () => { vivo = false; };
  }, [S.cuentas, S.categorias, S.ajustes, S.presupuestos, S.tasas]);

  if (!txs) return html`<div class="vista"><div class="vacio" style=${{ paddingTop: '60px' }}>Cargando…</div></div>`;

  const principal = S.ajustes.monedaPrincipal;
  const p = patrimonio(S.cuentas, txs, S.tasas, principal);
  const clave = claveMesActual();
  const [desde, hasta] = rangoMes(clave);
  const stats = statsMes(clave, txs.filter(t => t.fecha >= desde && t.fecha < hasta), S);
  const presupuestoTotal = S.presupuestos.reduce((s, pr) => s + pr.monto, 0);
  const pct = presupuestoTotal ? Math.min(100, stats.gasto / presupuestoTotal * 100) : 0;
  const excedido = presupuestoTotal && stats.gasto > presupuestoTotal;

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
      <h1>Hoy</h1>
      <div class="acciones">
        <button class="btn-icono" onClick=${() => nav('#/ajustes')}>⚙️</button>
      </div>
    </div>

    <div class="tarjeta" style=${{ textAlign: 'center', padding: '20px 16px' }}>
      <div style=${{ fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Patrimonio</div>
      <div class="num" style=${{ fontSize: '34px', fontWeight: 800, margin: '4px 0 2px' }}>${fmtConMoneda(p.total, principal)}</div>
      <div style=${{ fontSize: '13px', color: 'var(--muted)' }}>
        Disponible <b class="num" style=${{ color: 'var(--ingreso)' }}>${fmtConMoneda(p.disponible, principal)}</b>
        ${p.deudas > 0 && html` · Deudas <b class="num" style=${{ color: 'var(--gasto)' }}>−${fmtConMoneda(p.deudas, principal)}</b>`}
      </div>
      <div class="chips-scroll" style=${{ marginTop: '12px', justifyContent: 'center' }}>
        ${S.cuentas.filter(c => !c.archivada).map(c => html`
          <button key=${c.id} class="chip" onClick=${() => nav('#/cuentas')}>
            ${TIPOS_CUENTA[c.tipo].emoji} ${c.nombre}
            <span class="num" style=${{ color: saldoConvertido(c, txs, S.tasas, principal) < 0 ? 'var(--gasto)' : 'inherit' }}>
              ${fmtConMoneda(saldoCuenta(c, txs), c.moneda)}
            </span>
          </button>`)}
      </div>
    </div>

    <div class="tarjeta">
      <h3>${fmtMesLargo(clave)} · en ${principal}</h3>
      <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Gastado</div>
          <div class="num m-gasto" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.gasto, principal)}</div>
        </div>
        <div>
          <div style=${{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Ingresado</div>
          <div class="num m-ingreso" style=${{ fontSize: '19px', fontWeight: 800 }}>${fmtConMoneda(stats.ingreso, principal)}</div>
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
  </div>`;
}
