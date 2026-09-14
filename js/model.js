// Lógica de dominio pura: efectos de cada transacción, saldos, conversión de
// monedas y estadísticas. Sin dependencias de la UI: reutilizable en cualquier
// contexto (futuro sync, app nativa, scripts de análisis, etc.).

import { monedaInfo, claveMes, sumarMesClave, isoDia, rangoMes } from './util.js';

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
 * Si la transacción está en otra moneda que la cuenta, convierte con las tasas
 * vigentes a la fecha del movimiento.
 */
export function efectoTx(tx, cuentaId, tasas = [], monedaCuenta = null) {
  const enMonedaCuenta = monto => {
    if (!monedaCuenta || tx.moneda === monedaCuenta) return monto;
    return convertir(monto, tx.moneda, monedaCuenta, tasas, tx.fecha);
  };
  if (tx.cuenta === cuentaId) {
    const m = enMonedaCuenta(tx.monto);
    return tx.tipo === 'gasto' ? -m : tx.tipo === 'ingreso' ? m : -m;
  }
  if (tx.tipo === 'transferencia' && tx.cuentaDestino === cuentaId) {
    return tx.montoDestino ?? tx.monto;
  }
  return 0;
}

/** Saldo actual de una cuenta en su propia moneda (incluye saldo inicial). */
export function saldoCuenta(cuenta, txs, tasas = []) {
  let s = cuenta.saldoInicial || 0;
  for (const tx of txs) s += efectoTx(tx, cuenta.id, tasas, cuenta.moneda);
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
  convertir(saldoCuenta(cuenta, txs, tasas), cuenta.moneda, principal, tasas);

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

/** Estadísticas de un rango [desde, hasta) en ISO local. Las transferencias
 *  quedan fuera de gasto/ingreso. Acepta el store completo (S). */
export function statsRango(desde, hasta, txs, { categorias, tasas, ajustes, principal }) {
  principal = principal || ajustes?.monedaPrincipal || 'GTQ';
  const enRango = txs.filter(t => t.fecha >= desde && t.fecha < hasta);
  const catPorId = new Map(categorias.map(c => [c.id, c]));
  const porCategoria = new Map(), porCategoriaIngreso = new Map(), porEtiqueta = new Map(), porDia = new Map();
  let gasto = 0, ingreso = 0, transferencias = 0;
  for (const tx of enRango) {
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
    gasto, ingreso, transferencias, neto: ingreso - gasto,
    porCategoria: aLista(porCategoria), porCategoriaIngreso: aLista(porCategoriaIngreso),
    porEtiqueta: aLista(porEtiqueta),
    porDia: [...porDia.entries()].map(([dia, monto]) => ({ dia, monto })).sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

/** Estadísticas de un mes (clave 'YYYY-MM'). */
export function statsMes(clave, txs, S) {
  const [desde, hasta] = rangoMes(clave);
  return statsRango(desde, hasta, txs, S);
}

/** Gasto e ingreso de los últimos N meses (inclusive el actual). */
export function tendencia(txs, { tasas, ajustes, principal }, n = 12) {
  principal = principal || ajustes?.monedaPrincipal || 'GTQ';
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


/* ============ Flujo de efectivo: registros futuros del usuario ============ */

const p2f = n => String(n).padStart(2, '0');
const finDeMes = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-11

/**
 * Patrimonio (en moneda principal) que se tenía en una fecha, aplicando solo
 * las transacciones reales anteriores o iguales a esa fecha.
 */
export function patrimonioEn(cuentas, txs, tasas, principal, fechaISO) {
  let total = 0;
  for (const c of cuentas.filter(c => !c.archivada)) {
    let s = c.saldoInicial || 0;
    for (const tx of txs) {
      if (tx.fecha.slice(0, 10) > fechaISO) break;
      s += efectoTx(tx, c.id, tasas, c.moneda);
    }
    total += convertir(s, c.moneda, principal, tasas, fechaISO);
  }
  return total;
}

/**
 * Fechas que se generan al repetir un movimiento futuro.
 * frecuencia: 'unica' | 'mensual' | 'quincenal'; n = cuántas fechas en total.
 */
export function fechasRepetir(fechaBase, frecuencia, n = 6) {
  if (frecuencia === 'unica' || n <= 1) return [fechaBase];
  const base = new Date(fechaBase + 'T12:00');
  const { y, m, d } = { y: base.getFullYear(), m: base.getMonth(), d: base.getDate() };
  const fuera = [];
  if (frecuencia === 'semanal') {
    for (let i = 0; i < n; i++) { fuera.push(isoDia(base)); base.setDate(base.getDate() + 7); }
    return fuera;
  }
  if (frecuencia === 'quincenal') {
    // alterna: si el día base es > 15, parte del fin de mes y salta al 15 siguiente
    let primeraQuincena = d <= 15;
    let cur = new Date(y, m, primeraQuincena ? 15 : finDeMes(y, m), 12);
    for (let i = 0; i < n; i++) {
      fuera.push(`${cur.getFullYear()}-${p2f(cur.getMonth() + 1)}-${p2f(cur.getDate())}`);
      if (primeraQuincena) cur = new Date(cur.getFullYear(), cur.getMonth(), finDeMes(cur.getFullYear(), cur.getMonth()), 12);
      else cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 15, 12);
      primeraQuincena = !primeraQuincena;
    }
    return fuera;
  }
  for (let i = 0; i < n; i++) {
    const cur = new Date(y, m + i, 1);
    const dia = Math.min(d, finDeMes(cur.getFullYear(), cur.getMonth()));
    fuera.push(`${cur.getFullYear()}-${p2f(cur.getMonth() + 1)}-${p2f(dia)}`);
  }
  return fuera;
}

/**
 * Serie DIARIA de saldos reales (en moneda principal) entre dos fechas.
 * cuentaId null = patrimonio total (cuentas activas); si no, esa cuenta sola.
 * Un solo recorrido de transacciones: rápida incluso con años de historial.
 */
export function serieSaldos({ cuentas, txs, tasas, principal, desdeD, hastaD, cuentaId = null }) {
  const lista = cuentaId
    ? cuentas.filter(c => c.id === cuentaId)
    : cuentas.filter(c => !c.archivada);
  const ordenadas = [...txs].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // saldo de cada cuenta al día "desdeD" (transacciones anteriores ya aplicadas)
  let corte = 0;
  const saldos = new Map();
  while (corte < ordenadas.length && ordenadas[corte].fecha.slice(0, 10) <= desdeD) corte++;
  for (const c of lista) {
    let s = c.saldoInicial || 0;
    for (let i = 0; i < corte; i++) s += efectoTx(ordenadas[i], c.id, tasas, c.moneda);
    saldos.set(c.id, s);
  }

  const dias = [];
  let i = corte;
  const cur = new Date(desdeD + 'T12:00'), fin = new Date(hastaD + 'T12:00');
  for (; cur <= fin; cur.setDate(cur.getDate() + 1)) {
    const dISO = isoDia(cur);
    while (i < ordenadas.length && ordenadas[i].fecha.slice(0, 10) <= dISO) {
      for (const c of lista) saldos.set(c.id, saldos.get(c.id) + efectoTx(ordenadas[i], c.id, tasas, c.moneda));
      i++;
    }
    let total = 0;
    for (const c of lista) total += convertir(saldos.get(c.id), c.moneda, principal, tasas, dISO);
    dias.push({ fecha: dISO, balance: total });
  }
  return dias;
}

/**
 * Deltas futuros por fecha para un alcance: cuentaId null = patrimonio
 * (las transferencias son neutras); si no, la cuenta elegida (la transferencia
 * resta en el origen y suma en el destino).
 */
export function deltasFuturos(futuros, tasas, principal, hoyD, cuentaId = null) {
  const evs = [];
  for (const f of futuros) {
    if (f.fecha <= hoyD) continue;
    const conv = convertir(f.monto, f.moneda, principal, tasas, hoyD);
    if (!cuentaId) {
      if (f.tipo === 'ingreso') evs.push({ fecha: f.fecha, delta: conv, f });
      else if (f.tipo === 'gasto') evs.push({ fecha: f.fecha, delta: -conv, f });
      else evs.push({ fecha: f.fecha, delta: 0, f }); // transferencia: neutra para el patrimonio
    } else {
      if (f.tipo === 'transferencia') {
        if (f.cuenta === cuentaId) evs.push({ fecha: f.fecha, delta: -conv, f });
        else if (f.cuentaDestino === cuentaId) {
          const convDest = convertir(f.montoDestino ?? f.monto, f.monedaDestino || f.moneda, principal, tasas, hoyD);
          evs.push({ fecha: f.fecha, delta: convDest, f });
        }
      } else if (f.cuenta === cuentaId) {
        evs.push({ fecha: f.fecha, delta: f.tipo === 'ingreso' ? conv : -conv, f });
      }
    }
  }
  return evs.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Resumen de flujo con registros futuros del usuario.
 * scope: null (patrimonio) o id de cuenta. Devuelve la lista con saldo
 * acumulado y métricas del horizonte elegido.
 */
export function flujoEfectivo({ cuentas, txs, tasas, principal, futuros = [], fijos = [], pasadoMeses = 6, futuroMeses = 6, cuentaId = null }) {
  const hoyD = isoDia();
  const clave = claveMes(hoyD);
  const desdeD = sumarMesClave(clave, -pasadoMeses) + '-01';
  const finClave = sumarMesClave(clave, futuroMeses);
  const hastaD = `${finClave.slice(0, 4)}-${finClave.slice(5, 7)}-${p2f(finDeMes(+finClave.slice(0, 4), +finClave.slice(5, 7) - 1))}`;

  const seriePasado = serieSaldos({ cuentas, txs, tasas, principal, desdeD, hastaD, cuentaId });
  const balanceHoy = patrimonio(cuentas, txs, tasas, principal).total;
  const balanceHoyScope = cuentaId
    ? (seriePasado.find(p => p.fecha === hoyD) || seriePasado.at(-1) || { balance: 0 }).balance
    : balanceHoy;

  const eventos = deltasFuturos(futuros, tasas, principal, hoyD, cuentaId)
    .filter(e => e.fecha <= hastaD);
  // Fijos: se proyectan solos dentro del horizonte. Un gasto fijo cargado a
  // tarjeta/deuda no mueve el patrimonio (cargo y deuda se compensan) — se
  // lista para que se vea venir; en el alcance de esa tarjeta sí resta, y su
  // día de pago repone el ciclo cerrado.
  const cargosPorFecha = new Map();
  for (const r of (fijos || []).filter(f => f.activa !== false)) {
    const fuenteC = r.fuente ? cuentas.find(c => c.id === r.fuente) : null;
    const pasiva = !!fuenteC && (fuenteC.tipo === 'tarjeta' || fuenteC.tipo === 'deuda');
    if (cuentaId && (!pasiva || r.fuente !== cuentaId)) continue;
    const montoP = convertir(r.monto, r.moneda, principal, tasas, hoyD);
    for (const fecha of fechasFijo(r, hoyD, hastaD)) {
      const delta = cuentaId ? -montoP : (r.tipo === 'ingreso' ? montoP : (pasiva ? 0 : -montoP));
      eventos.push({ fecha, delta, f: {
        id: 'fijo-' + r.id + '-' + fecha, esFijo: true, tipo: r.tipo,
        nombre: r.nombre || (r.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo'),
        monto: r.monto, moneda: r.moneda, fecha,
        esCargoTarjeta: pasiva && !cuentaId,
        fuenteNombre: pasiva ? fuenteC.nombre : null,
      }});
      if (cuentaId) cargosPorFecha.set(fecha, (cargosPorFecha.get(fecha) || 0) + montoP);
    }
  }
  // Pago del día límite (solo en el alcance de esa tarjeta): repone los cargos
  // del ciclo que cerró en su corte previo al pago.
  const tarjetaScope = cuentaId ? cuentas.find(c => c.id === cuentaId && c.tipo === 'tarjeta' && c.pagoDia) : null;
  if (tarjetaScope) {
    let y = +hoyD.slice(0, 4), m = +hoyD.slice(5, 7) - 1, limitePrev = null;
    for (let i = 0; i < 3; i++) {
      const pago = `${y}-${p2g(m + 1)}-${p2g(Math.min(tarjetaScope.pagoDia, diasDelMes(y, m)))}`;
      let cierre = null;
      if (tarjetaScope.corte) {
        const dP = new Date(pago + 'T12:00');
        const pc = tarjetaScope.pagoDia > tarjetaScope.corte ? 0 : 1;
        const dm = new Date(dP.getFullYear(), dP.getMonth() - pc, 12);
        cierre = isoDia(new Date(dm.getFullYear(), dm.getMonth(), Math.min(tarjetaScope.corte, diasDelMes(dm.getFullYear(), dm.getMonth())), 12));
      }
      if (pago > hoyD && pago <= hastaD) {
        let montoP = 0;
        for (const [fecha, monto] of cargosPorFecha) {
          if (limitePrev && fecha <= limitePrev) continue;
          if (cierre && fecha > cierre) continue;
          montoP += monto;
        }
        if (montoP > 0) eventos.push({ fecha: pago, delta: montoP, f: {
          id: 'pago-fijo-' + pago, esFijo: true, esPagoTarjeta: true, tipo: 'ingreso',
          nombre: 'Pago de ' + tarjetaScope.nombre, monto: montoP, moneda: principal, fecha: pago,
        }});
      }
      limitePrev = cierre || pago;
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const serie = [{ fecha: hoyD, balance: balanceHoyScope }];
  let acum = balanceHoyScope, totalIn = 0, totalOut = 0;
  const lista = eventos.map(e => {
    acum += e.delta;
    if (e.delta > 0) totalIn += e.delta; else totalOut += -e.delta;
    if (e.delta !== 0) serie.push({ fecha: e.fecha, balance: acum });
    return { ...e.f, delta: e.delta, balanceDespues: acum };
  });

  let minimo = { fecha: hoyD, balance: balanceHoyScope };
  for (const p of serie) if (p.balance < minimo.balance) minimo = p;

  const vencidos = futuros.filter(f => f.fecha <= hoyD).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { desdeD, hastaD, hoyD, balanceHoy: balanceHoyScope, seriePasado, serie, lista, minimo, totalIn, totalOut, vencidos };
}

/* ============ Fijos: poder adquisitivo teórico ============ */

const p2g = n => String(n).padStart(2, '0');
const diasDelMes = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-11

/** Fechas de ocurrencia de una regla fija dentro de [desdeD, hastaD], solo futuras.
 *  frecuencia: 'mensual' (día) | 'quincenal' (15 y fin de mes) | 'semanal' (día = weekday 0-6). */
export function fechasFijo(regla, desdeD, hastaD) {
  const out = [];
  const hoy = isoDia();
  if (regla.frecuencia === 'semanal') {
    let cur = new Date(desdeD + 'T12:00');
    for (let i = 0; i < 7 && cur.getDay() !== (regla.dia ?? 1); i++) cur.setDate(cur.getDate() + 1);
    const fin = new Date(hastaD + 'T12:00');
    for (; cur <= fin; cur.setDate(cur.getDate() + 7)) {
      const iso = isoDia(cur);
      if (iso >= hoy) out.push(iso);
    }
    return out;
  }
  let y = +desdeD.slice(0, 4), m = +desdeD.slice(5, 7) - 1;
  const fy = +hastaD.slice(0, 4), fm = +hastaD.slice(5, 7) - 1;
  for (; y < fy || (y === fy && m <= fm); m++, m > 11 ? (m = 0, y++) : 0) {
    const dias = regla.frecuencia === 'quincenal' ? [15, diasDelMes(y, m)] : [Math.min(regla.dia || 1, diasDelMes(y, m))];
    for (const d of dias) {
      const iso = `${y}-${p2g(m + 1)}-${p2g(d)}`;
      if (iso >= desdeD && iso <= hastaD && iso >= hoy) out.push(iso);
    }
  }
  return out;
}

/**
 * Poder adquisitivo teórico: parte del dinero líquido de hoy (sin contar
 * tarjetas ni deudas — una deuda no impide pagar) y camina el calendario
 * aplicando cada fijo en orden. Cada gasto queda marcado: alcanza o faltante.
 *
 * Fijos con fuente pasiva (tarjeta/deuda): no tocan el líquido; suman a la
 * deuda de esa cuenta el día del cargo (fila '+rojo'). Los pagos de tarjeta
 * cubren el ciclo que cierra en el corte previo a cada fecha de pago — el
 * pago paga el saldo completo al cierre (incluye deuda arrastrada) más los
 * fijos cargados a esa tarjeta dentro del ciclo.
 */
export function poderAdquisitivo({ cuentas, txs, tasas, principal, fijos = [], dias = 45 }) {
  const hoyD = isoDia();
  const finD = (() => { const d = new Date(hoyD + 'T12:00'); d.setDate(d.getDate() + dias); return isoDia(d); })();
  let base = 0;
  for (const c of cuentas.filter(c => !c.archivada && c.tipo !== 'tarjeta' && c.tipo !== 'deuda')) {
    base += convertir(saldoCuenta(c, txs, tasas), c.moneda, principal, tasas, hoyD);
  }
  const ordenadas = [...txs].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const saldoEn = (cuenta, fechaISO) => {
    let s = cuenta.saldoInicial || 0;
    for (const tx of ordenadas) {
      if (tx.fecha.slice(0, 10) > fechaISO) break;
      s += efectoTx(tx, cuenta.id, tasas, cuenta.moneda);
    }
    return s;
  };
  const cuentaDe = id => cuentas.find(c => c.id === id);
  const fuentePasiva = id => { const c = cuentaDe(id); return !!c && (c.tipo === 'tarjeta' || c.tipo === 'deuda'); };

  const eventos = [];
  for (const r of fijos.filter(r => r.activa !== false)) {
    const montoP = convertir(r.monto, r.moneda, principal, tasas, hoyD);
    if (r.tipo === 'gasto' && r.fuente && fuentePasiva(r.fuente)) {
      for (const fecha of fechasFijo(r, hoyD, finD)) {
        eventos.push({ fecha, tipo: 'deuda', fijoId: r.id, fuente: r.fuente,
          nombre: r.nombre || 'Gasto fijo', montoP, moneda: principal });
      }
    } else {
      for (const fecha of fechasFijo(r, hoyD, finD)) {
        eventos.push({
          fecha, tipo: r.tipo, fijoId: r.id,
          nombre: r.nombre || (r.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo'),
          montoP, moneda: principal
        });
      }
    }
  }
  // Pagos de tarjeta: cada pago cubre la factura que cierra en el corte previo
  // al pago. Primera ocurrencia: saldo real completo al cierre (el ciclo abierto
  // de hoy siempre cierra ahí). Siguientes: solo fijos cargados a la tarjeta en
  // su ciclo — los gastos reales futuros no se proyectan.
  for (const c of cuentas.filter(c => !c.archivada && c.tipo === 'tarjeta' && c.pagoDia)) {
    const pagos = [];
    let y = +hoyD.slice(0, 4), m = +hoyD.slice(5, 7) - 1;
    for (let i = 0; i < 3; i++) {
      const pago = `${y}-${p2g(m + 1)}-${p2g(Math.min(c.pagoDia, diasDelMes(y, m)))}`;
      if (pago > finD) break;
      if (pago >= hoyD) pagos.push(pago);
      m++; if (m > 11) { m = 0; y++; }
    }
    const cierres = pagos.map(p => {
      if (!c.corte) return null;
      const dP = new Date(p + 'T12:00');
      const pc = c.pagoDia > c.corte ? 0 : 1; // el pago corre en el mes del corte o al siguiente
      const dm = new Date(dP.getFullYear(), dP.getMonth() - pc, 12);
      return isoDia(new Date(dm.getFullYear(), dm.getMonth(), Math.min(c.corte, diasDelMes(dm.getFullYear(), dm.getMonth())), 12));
    });
    pagos.forEach((pago, i) => {
      const ref = cierres[i] || (i === 0 ? hoyD : pagos[0]);
      const refPrev = i === 0 ? null : (cierres[i - 1] || pagos[i - 1]);
      let montoP = i === 0
        ? Math.max(0, -convertir(saldoEn(c, ref), c.moneda, principal, tasas, ref))
        : 0;
      for (const e of eventos) {
        if (e.tipo !== 'deuda' || e.fuente !== c.id) continue;
        if (ref && e.fecha > ref) continue;
        if (refPrev && e.fecha <= refPrev) continue;
        montoP += e.montoP;
      }
      if (montoP <= 0) return;
      eventos.push({ fecha: pago, tipo: 'gasto', fijoId: 'pago-' + c.id, fuente: c.id,
        nombre: 'Pago de ' + (c.nombre || 'tarjeta'), montoP, moneda: principal });
    });
  }
  // mismo día: los ingresos se aplican antes que los gastos
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'ingreso' ? -1 : 1));
  let saldo = base;
  const rows = eventos.map(e => {
    let ok = true, faltante = 0;
    if (e.tipo === 'ingreso') saldo += e.montoP;
    else if (e.tipo === 'gasto') {
      saldo -= e.montoP;
      ok = saldo >= 0; faltante = saldo < 0 ? -saldo : 0;
    } // deuda: solo informa, no toca el líquido
    return { ...e, balanceDespues: saldo, ok, faltante };
  });
  return { base, rows, hastaD: finD };
}

/** Estructura de un rango [desde, hasta): clasifica transacciones reales en
 *  fijos y variables. Una transacción cuenta como fija si coincide con alguna
 *  regla activa (mismo tipo y monto equivalente dentro de ±1%). */
export function estructuraRango(desde, hasta, txs, S) {
  const principal = S.ajustes.monedaPrincipal;
  const tasas = S.tasas || [];
  const reglas = (S.fijos || []).filter(f => f.activa !== false);
  const montoDe = (monto, moneda, fecha) => convertir(monto, moneda, principal, tasas, fecha);
  let fijoIn = 0, varIn = 0, fijoOut = 0, varOut = 0;
  const tol = p => Math.max(100, Math.round(p * 0.01));
  const esFijo = tx => {
    const mp = montoDe(tx.monto, tx.moneda, tx.fecha);
    return reglas.some(r => r.tipo === tx.tipo &&
      Math.abs(montoDe(r.monto, r.moneda, tx.fecha) - mp) <= tol(montoDe(r.monto, r.moneda, tx.fecha)));
  };
  for (const tx of txs.filter(t => t.fecha >= desde && t.fecha < hasta && t.tipo !== 'transferencia' && !t.eliminada)) {
    const mp = montoDe(tx.monto, tx.moneda, tx.fecha);
    if (tx.tipo === 'ingreso') { if (esFijo(tx)) fijoIn += mp; else varIn += mp; }
    else { if (esFijo(tx)) fijoOut += mp; else varOut += mp; }
  }
  return { fijoIn, varIn, fijoOut, varOut, tieneReglas: reglas.length > 0 };
}

/** Estructura de un mes (clave 'YYYY-MM'). */
export function estructuraMes(clave, txs, S) {
  const [desde, hasta] = rangoMes(clave);
  return estructuraRango(desde, hasta, txs, S);
}
