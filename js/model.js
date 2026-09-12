// Lógica de dominio pura: efectos de cada transacción, saldos, conversión de
// monedas y estadísticas. Sin dependencias de la UI: reutilizable en cualquier
// contexto (futuro sync, app nativa, scripts de análisis, etc.).

import { monedaInfo, claveMes, sumarMesClave } from './util.js';

export const TIPOS_CUENTA = {
  efectivo: { emoji: '💵', nombre: 'Efectivo' },
  bancaria: { emoji: '🏦', nombre: 'Cuenta bancaria' },
  ahorro: { emoji: '🏺', nombre: 'Ahorros' },
  tarjeta: { emoji: '💳', nombre: 'Tarjeta de crédito' },
  deuda: { emoji: '📉', nombre: 'Deuda / préstamo' },
};

/**
 * Efecto de una transacción sobre una cuenta, en la moneda de esa cuenta.
 * Gasto: -monto · Ingreso: +monto · Transferencia: origen -monto, destino +montoDestino.
 */
export function efectoTx(tx, cuentaId) {
  if (tx.cuenta === cuentaId) {
    return tx.tipo === 'gasto' ? -tx.monto : tx.tipo === 'ingreso' ? tx.monto : -tx.monto;
  }
  if (tx.tipo === 'transferencia' && tx.cuentaDestino === cuentaId) {
    return tx.montoDestino ?? tx.monto;
  }
  return 0;
}

/** Saldo actual de una cuenta (incluye saldo inicial). */
export function saldoCuenta(cuenta, txs) {
  let s = cuenta.saldoInicial || 0;
  for (const tx of txs) s += efectoTx(tx, cuenta.id);
  return s;
}

/**
 * Convierte un entero de moneda 'desde' a 'hacia' usando la tabla de tasas del
 * usuario. Busca la tasa vigente más cercana hacia atrás de la fecha; si no
 * hay, 1:1. Soporta tasa directa e inversa.
 */
export function convertir(entero, desde, hacia, tasas, fechaISO = '9999') {
  if (desde === hacia) return entero;
  const dec = monedaInfo(desde).dec;
  const num = entero / 10 ** dec;
  const cand = tasas
    .filter(t => (t.de === desde && t.a === hacia) || (t.de === hacia && t.a === desde))
    .filter(t => t.fecha <= fechaISO.slice(0, 10))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const taux = cand[0] ? (cand[0].de === desde ? cand[0].valor : 1 / cand[0].valor) : 1;
  return Math.round(num * taux * 10 ** monedaInfo(hacia).dec);
}

/** Saldo convertido a la moneda principal. */
export const saldoConvertido = (cuenta, txs, tasas, principal) =>
  convertir(saldoCuenta(cuenta, txs), cuenta.moneda, principal, tasas);

/** Patrimonio (todas las cuentas), total de deudas (tarjetas + deudas, saldos negativos). */
export function patrimonio(cuentas, txs, tasas, principal) {
  let total = 0, deudas = 0;
  for (const c of cuentas.filter(c => !c.archivada)) {
    const s = saldoConvertido(c, txs, tasas, principal);
    total += s;
    if (s < 0) deudas += -s;
  }
  return { total, deudas, disponible: total + deudas }; // disponible = activos sin contar deudas
}

/** Estadísticas de un mes. Las transferencias quedan fuera de gasto/ingreso. */
export function statsMes(clave, txs, { categorias, tasas, principal }) {
  const catPorId = new Map(categorias.map(c => [c.id, c]));
  const porCategoria = new Map(), porCategoriaIngreso = new Map(), porEtiqueta = new Map(), porDia = new Map();
  let gasto = 0, ingreso = 0, transferencias = 0;
  for (const tx of txs) {
    const montoP = convertir(tx.monto, tx.moneda, principal, tasas, tx.fecha);
    if (tx.tipo === 'gasto') {
      gasto += montoP;
      const cid = tx.categoria || '_sin';
      porCategoria.set(cid, (porCategoria.get(cid) || 0) + montoP);
      porDia.set(tx.fecha.slice(0, 10), (porDia.get(tx.fecha.slice(0, 10)) || 0) + montoP);
      for (const e of tx.etiquetas || []) porEtiqueta.set(e, (porEtiqueta.get(e) || 0) + montoP);
    } else if (tx.tipo === 'ingreso') {
      ingreso += montoP;
      const cid = tx.categoria || '_sin';
      porCategoriaIngreso.set(cid, (porCategoriaIngreso.get(cid) || 0) + montoP);
    } else {
      transferencias += montoP;
    }
  }
  const aLista = m => [...m.entries()].map(([id, monto]) => ({
    id, monto,
    nombre: id === '_sin' ? 'Sin categoría' : (catPorId.get(id)?.nombre || id),
    emoji: id === '_sin' ? '❓' : (catPorId.get(id)?.emoji || '🏷️'),
  })).sort((a, b) => b.monto - a.monto);
  return {
    clave, gasto, ingreso, transferencias, neto: ingreso - gasto,
    porCategoria: aLista(porCategoria), porCategoriaIngreso: aLista(porCategoriaIngreso),
    porEtiqueta: aLista(porEtiqueta),
    porDia: [...porDia.entries()].map(([dia, monto]) => ({ dia, monto })).sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

/** Gasto e ingreso de los últimos N meses (inclusive el actual). */
export function tendencia(txs, { tasas, principal }, n = 12) {
  const actual = claveMes(new Date().toISOString());
  const meses = [];
  for (let i = n - 1; i >= 0; i--) meses.push(sumarMesClave(actual, -i));
  const por = new Map(meses.map(m => [m, { gasto: 0, ingreso: 0 }]));
  for (const tx of txs) {
    const k = claveMes(tx.fecha);
    const e = por.get(k);
    if (!e) continue;
    const montoP = convertir(tx.monto, tx.moneda, principal, tasas, tx.fecha);
    if (tx.tipo === 'gasto') e.gasto += montoP;
    else if (tx.tipo === 'ingreso') e.ingreso += montoP;
  }
  return meses.map(m => ({ clave: m, ...por.get(m) }));
}

/** Orden de categorías por frecuencia de uso (para la grilla de captura). */
export function categoriasFrecuentes(txs, tipo, limite = 8) {
  const cuenta = new Map();
  for (const tx of txs) {
    if (tx.tipo === tipo && tx.categoria) cuenta.set(tx.categoria, (cuenta.get(tx.categoria) || 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite).map(e => e[0]);
}

/** Motivos/comercios recientes para autocompletar. */
export function motivosRecientes(txs, limite = 30) {
  const vistos = new Set();
  for (const tx of txs) {
    if (tx.motivo && !vistos.has(tx.motivo)) { vistos.add(tx.motivo); if (vistos.size >= limite) break; }
  }
  return [...vistos];
}
