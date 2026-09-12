// Onboarding: una sola pantalla — moneda principal + primeras cuentas. Nada más.
import { html, useState } from '../../vendor/preact-standalone.module.js';
import fin from '../db.js';
import { useStore, nav, recargar, toast } from '../store.js';
import { SelectorMoneda } from '../ui.js';
import { uid, textoAEntero, enteroATexto } from '../util.js';

const PRESETS = [
  { tipo: 'efectivo', nombre: 'Efectivo', emoji: '💵' },
  { tipo: 'bancaria', nombre: 'Cuenta bancaria', emoji: '🏦' },
  { tipo: 'tarjeta', nombre: 'Tarjeta de crédito', emoji: '💳' },
];

export default function Onboarding() {
  const S = useStore();
  const [moneda, setMoneda] = useState(S.ajustes.monedaPrincipal || 'GTQ');
  const [cuentas, setCuentas] = useState(
    PRESETS.map(p => ({ ...p, activa: true, saldo: '', moneda: S.ajustes.monedaPrincipal || 'GTQ' }))
  );

  const toggle = i => setCuentas(cuentas.map((c, j) => j === i ? { ...c, activa: !c.activa } : c));
  const upd = (i, p) => setCuentas(cuentas.map((c, j) => j === i ? { ...c, ...p } : c));
  const agregar = () => setCuentas([...cuentas, { tipo: 'ahorro', nombre: '', emoji: '🏺', activa: true, saldo: '', moneda }]);

  const empezar = async () => {
    const finales = cuentas.filter(c => c.activa && c.nombre.trim());
    if (finales.length === 0) {
      finales.push({ tipo: 'efectivo', nombre: 'Efectivo', moneda });
    }
    const pasivo = t => t === 'tarjeta' || t === 'deuda';
    for (const c of finales) {
      const dec = c.moneda === moneda ? 2 : 2;
      const saldo = textoAEntero(c.saldo || '0', 2) || 0;
      await fin.guardarCuenta({
        id: uid(), tipo: c.tipo, nombre: c.nombre.trim(), moneda: c.moneda,
        saldoInicial: pasivo(c.tipo) ? -saldo : saldo,
        banco: null, numero: null, titular: null, notas: null, archivada: false,
        createdAt: new Date().toISOString()
      });
    }
    await fin.setAjuste('app', { ...(S.ajustes || {}), monedaPrincipal: moneda, iniciado: true });
    await recargar();
    toast('¡Listo! Empieza registrando un gasto con el botón +');
    nav('#/');
  };

  return html`<div class="onb">
    <div class="logo">ƒ</div>
    <h1>Finanzas</h1>
    <p class="centro">Tus cuentas, tus reglas. Rápido, privado y sin suscripciones.</p>

    <div class="tarjeta">
      <h3>1 · Moneda principal</h3>
      <${SelectorMoneda} valor=${moneda} onChange=${setMoneda} />
      <div class="dato-cuenta" style=${{ marginTop: '6px' }}>Es la que se usa en reportes y presupuestos. Puedes tener cuentas en otras monedas.</div>
    </div>

    <div class="tarjeta">
      <h3>2 · Tus primeras cuentas</h3>
      ${cuentas.map((c, i) => html`<div key=${i} style=${{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', opacity: c.activa ? 1 : .45 }}>
        <input type="checkbox" checked=${c.activa} onChange=${() => toggle(i)} style=${{ width: '20px', height: '20px' }} />
        <div style=${{ flex: 1, display: 'grid', gap: '6px' }}>
          <input placeholder=${c.nombre || 'Nombre'} value=${c.nombre} onInput=${e => upd(i, { nombre: e.target.value })} />
          <div style=${{ display: 'flex', gap: '6px' }}>
            <select value=${c.tipo} onChange=${e => upd(i, { tipo: e.target.value })} style=${{ flex: 1 }}>
              <option value="efectivo">💵 Efectivo</option>
              <option value="bancaria">🏦 Bancaria</option>
              <option value="ahorro">🏺 Ahorro</option>
              <option value="tarjeta">💳 Tarjeta de crédito</option>
              <option value="deuda">📉 Deuda / préstamo</option>
            </select>
            <input placeholder=${(c.tipo === 'tarjeta' || c.tipo === 'deuda') ? 'Deuda actual' : 'Saldo actual'}
              inputMode="decimal" value=${c.saldo} style=${{ flex: 1, textAlign: 'right' }}
              onInput=${e => upd(i, { saldo: e.target.value })} />
          </div>
        </div>
      </div>`)}
      <button class="chip" onClick=${agregar}>＋ Añadir otra</button>
    </div>

    <div class="pie">
      <button class="btn btn-primario" onClick=${empezar}>Empezar</button>
      <div class="dato-cuenta" style=${{ textAlign: 'center', marginTop: '10px' }}>
        Tarjeta y deuda se registran con saldo negativo: pagarlas será una transferencia, no un gasto.
      </div>
    </div>
  </div>`;
}
