import test from 'node:test';
import assert from 'node:assert/strict';
import { actividadCuenta } from '../js/actividad-cuenta.js';

const cuenta = { id: 'banco', tipo: 'bancaria', moneda: 'GTQ', saldoInicial: 500000 };
const base = { cuenta, desde: '2026-09-01T00:00', hasta: '2026-10-01T00:00', hoy: '2026-09-14' };
const tx = (tipo, monto, fecha, otros = {}) => ({ tipo, monto, fecha, cuenta: 'banco', moneda: 'GTQ', ...otros });

test('reconcilia saldo con transferencias, historial previo y límites del período', () => {
  const a = actividadCuenta({ ...base, txs: [
    tx('gasto', 10000, '2026-08-31T23:59'),
    tx('ingreso', 100000, '2026-09-01'),
    tx('gasto', 25000, '2026-09-02T09:00'),
    tx('transferencia', 50000, '2026-09-03', { cuentaDestino: 'tarjeta' }),
    tx('transferencia', 20000, '2026-09-14T23:59', { cuenta: 'tercero', cuentaDestino: 'banco' }),
    tx('gasto', 999999, '2026-09-15'),
    tx('ingreso', 999999, '2026-09-04', { eliminada: true }),
    tx('gasto', 999999, '2026-09-04', { cuenta: 'otro', cuentaDestino: 'banco' }),
  ] });
  assert.equal(a.saldoInicial, 490000);
  assert.equal(a.entradas, 120000);
  assert.equal(a.salidas, 75000);
  assert.equal(a.recibidas, 20000);
  assert.equal(a.enviadas, 50000);
  assert.equal(a.cambio, 45000);
  assert.equal(a.saldoFinal, 535000);
  assert.equal(a.saldoFinal, a.saldoInicial + a.cambio);
  assert.equal(a.serie.at(-1).fecha, '2026-09-14');
  assert.equal(a.periodos.reduce((n, p) => n + p.entra - p.sale, 0), a.cambio);
  assert.equal(a.contrapartes.length, 2);
});

test('transferencias en ambas monedas usan monto destino, y los gastos usan la tasa vigente', () => {
  const a = actividadCuenta({ ...base, tasas: [{ de: 'USD', a: 'GTQ', valor: 8, fecha: '2026-01-01' }], txs: [
    tx('transferencia', 10000, '2026-09-01', { cuenta: 'dolares', cuentaDestino: 'banco', moneda: 'USD', montoDestino: 80000 }),
    tx('gasto', 1000, '2026-09-02', { moneda: 'USD' }),
  ] });
  assert.equal(a.recibidas, 80000);
  assert.equal(a.gastos, 8000);
  assert.equal(a.saldoFinal, 572000);
  const usd = actividadCuenta({ ...base, cuenta: { ...cuenta, id: 'dolares', moneda: 'USD', saldoInicial: 0 },
    txs: [tx('transferencia', 80000, '2026-09-02', { cuentaDestino: 'dolares', montoDestino: 10000 })] });
  assert.equal(usd.recibidas, 10000);
});

test('período pasado excluye la fecha final, mantiene saldo inicial y permite saldo negativo', () => {
  const a = actividadCuenta({ ...base, hasta: '2026-09-03T00:00', txs: [
    tx('gasto', 600000, '2026-09-02'), tx('ingreso', 1000000, '2026-09-03'),
  ] });
  assert.equal(a.saldoFinal, -100000);
  assert.equal(a.serie.length, 2);
  assert.equal(a.granularidad, 'día');
});

test('cuenta sin movimientos mantiene saldo y muestra ceros sin ocultar el análisis', () => {
  const a = actividadCuenta({ ...base, txs: [] });
  assert.equal(a.movimientos, 0);
  assert.equal(a.cambio, 0);
  assert.equal(a.saldoInicial, a.saldoFinal);
  assert.equal(a.serie.length, 14);
});

test('cruza año y agrupa todos los movimientos sin inventar períodos futuros', () => {
  const a = actividadCuenta({ ...base, desde: '2025-12-01', hasta: '2026-04-01', hoy: '2026-03-02',
    txs: [tx('ingreso', 100, '2025-12-31'), tx('gasto', 20, '2026-01-01')] });
  assert.equal(a.periodos.length, 4);
  assert.equal(a.periodos[0].entra, 100);
  assert.equal(a.periodos[1].sale, 20);
  assert.equal(a.periodos.at(-1).hasta, '2026-03-02');
});
