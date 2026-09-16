// Liquidez de UNA cuenta, en su moneda. Nunca confundir entradas con ingresos
// globales: una transferencia modifica este saldo, pero no crea dinero.
import { efectoTx } from './model.js';
import { isoDia } from './util.js';

export function actividadCuenta({ cuenta, txs, tasas = [], desde, hasta, hoy = isoDia() }) {
  const inicio = desde.slice(0, 10);
  const finSolicitado = hasta.slice(0, 10); // exclusivo
  const manana = new Date(hoy + 'T12:00'); manana.setDate(manana.getDate() + 1);
  const fin = finSolicitado < isoDia(manana) ? finSolicitado : isoDia(manana);
  const orden = txs.filter(t => !t.eliminada && (t.cuenta === cuenta.id ||
    (t.tipo === 'transferencia' && t.cuentaDestino === cuenta.id)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldoInicial = cuenta.saldoInicial || 0;
  let ingresos = 0, gastos = 0, recibidas = 0, enviadas = 0, movimientos = 0;
  const dias = new Map(), contrapartes = new Map(), gastosCat = new Map(), estado = [];
  let saldoCorrido = saldoInicial;
  for (const tx of orden) {
    const dia = tx.fecha.slice(0, 10);
    if (dia >= fin) continue;
    const delta = efectoTx(tx, cuenta.id, tasas, cuenta.moneda);
    if (dia < inicio) { saldoInicial += delta; saldoCorrido += delta; continue; }
    const fila = dias.get(dia) || { entra: 0, sale: 0 };
    if (delta > 0) fila.entra += delta;
    if (delta < 0) fila.sale -= delta;
    dias.set(dia, fila);
    movimientos++;
    // estado de cuenta: cada movimiento con el saldo QUE QUEDÓ DESPUÉS de él,
    // caminando en orden cronológico — igual que lee uno un estado bancario.
    saldoCorrido += delta;
    estado.push({ tx, delta, balance: saldoCorrido });
    if (tx.tipo === 'transferencia') {
      const entrante = tx.cuentaDestino === cuenta.id;
      if (entrante) recibidas += Math.max(0, delta); else enviadas += Math.max(0, -delta);
      const id = entrante ? tx.cuenta : tx.cuentaDestino;
      const cp = contrapartes.get(id) || { id, recibidas: 0, enviadas: 0 };
      if (entrante) cp.recibidas += Math.max(0, delta); else cp.enviadas += Math.max(0, -delta);
      contrapartes.set(id, cp);
    } else if (tx.tipo === 'ingreso') ingresos += delta;
    else if (tx.tipo === 'gasto') {
      gastos -= delta;
      gastosCat.set(tx.categoria || null, (gastosCat.get(tx.categoria || null) || 0) - delta);
    }
  }
  let saldo = saldoInicial;
  const serie = [];
  const duracion = Math.round((Date.parse(fin) - Date.parse(inicio)) / 86400000);
  const granularidad = duracion <= 7 ? 'día' : duracion <= 62 ? 'semana' : duracion <= 730 ? 'mes' : 'año';
  const periodos = new Map();
  for (const d = new Date(inicio + 'T12:00'); isoDia(d) < fin; d.setDate(d.getDate() + 1)) {
    const fecha = isoDia(d), flujo = dias.get(fecha) || { entra: 0, sale: 0 };
    saldo += flujo.entra - flujo.sale;
    serie.push({ fecha, balance: saldo });
    const clave = granularidad === 'día' ? fecha : granularidad === 'semana'
      ? String(Math.floor((Date.parse(fecha) - Date.parse(inicio)) / 86400000 / 7))
      : granularidad === 'mes' ? fecha.slice(0, 7) : fecha.slice(0, 4);
    const p = periodos.get(clave) || { desde: fecha, hasta: fecha, entra: 0, sale: 0 };
    p.hasta = fecha; p.entra += flujo.entra; p.sale += flujo.sale;
    periodos.set(clave, p);
  }
  return { inicio, fin, serie, periodos: [...periodos.values()], granularidad,
    saldoInicial, saldoFinal: saldo, ingresos, gastos, recibidas, enviadas,
    entradas: ingresos + recibidas, salidas: gastos + enviadas,
    cambio: ingresos + recibidas - gastos - enviadas, movimientos,
    contrapartes: [...contrapartes.values()].sort((a, b) => (b.recibidas + b.enviadas) - (a.recibidas + a.enviadas)),
    estado,
    gastosPorCategoria: [...gastosCat.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto) };
}
