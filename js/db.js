// Capa de datos: Dexie (IndexedDB). Todo local, nada sale del dispositivo.
// Los registros usan id UUID + updatedAt + eliminada (borrado lógico) para poder
// sincronizar entre dispositivos en el futuro sin rediseñar nada.
import { uid } from './util.js';

const db = new Dexie('finanzas');

db.version(1).stores({
  cuentas: 'id, nombre, tipo, archivada',
  transacciones: 'id, fecha, cuenta, cuentaDestino, tipo, categoria, eliminada, updatedAt',
  categorias: 'id, tipo, nombre',
  etiquetas: 'id, nombre',
  presupuestos: 'categoria',
  tasas: '++id, de, a, fecha',
  adjuntos: 'id, transaccionId',
  ajustes: 'key'
});

// v2: tasa de cambio por defecto USD -> GTQ para dispositivos que ya tenían datos.
db.version(2).stores({}).upgrade(async tx => {
  if ((await tx.table('tasas').count()) === 0) {
    await tx.table('tasas').add({ de: 'USD', a: 'GTQ', valor: 7.88, fecha: new Date().toISOString().slice(0, 10) });
  }
});

const fin = {};

/* ---------- ajustes (key/value) ---------- */
fin.getAjuste = async (key, porDefecto = null) => {
  const row = await db.ajustes.get(key);
  return row ? row.valor : porDefecto;
};
fin.setAjuste = (key, valor) => db.ajustes.put({ key, valor });

/* ---------- cuentas ---------- */
fin.cuentas = () => db.cuentas.toArray();
fin.guardarCuenta = c => db.cuentas.put(c);
fin.borrarCuenta = async id => {
  const n = await db.transacciones.filter(t => !t.eliminada && (t.cuenta === id || t.cuentaDestino === id)).count();
  if (n > 0) throw new Error('La cuenta tiene movimientos; archívala en lugar de borrarla.');
  await db.adjuntos.where('transaccionId').anyOf(
    (await db.transacciones.filter(t => t.cuenta === id || t.cuentaDestino === id).primaryKeys())
  ).delete();
  await db.transacciones.filter(t => t.cuenta === id || t.cuentaDestino === id).delete();
  await db.cuentas.delete(id);
};

/* ---------- transacciones ---------- */
fin.txPorRango = (desde, hasta) =>
  db.transacciones.where('fecha').between(desde, hasta, true, false)
    .filter(t => !t.eliminada).toArray();
fin.todasTx = () => db.transacciones.filter(t => !t.eliminada).toArray();
fin.guardarTx = t => db.transacciones.put(t);
fin.eliminarTx = async id => {
  const t = await db.transacciones.get(id);
  if (t) await db.transacciones.put({ ...t, eliminada: true, updatedAt: new Date().toISOString() });
};
fin.recientes = n =>
  db.transacciones.orderBy('fecha').reverse().filter(t => !t.eliminada).limit(n).toArray();

/* ---------- catálogos ---------- */
fin.categorias = () => db.categorias.toArray();
fin.guardarCategoria = c => db.categorias.put(c);
fin.borrarCategoria = async id => {
  const n = await db.transacciones.filter(t => !t.eliminada && t.categoria === id).count();
  if (n > 0) throw new Error('La categoría tiene movimientos asociados.');
  await db.categorias.delete(id);
  await db.presupuestos.delete(id);
};
fin.etiquetas = () => db.etiquetas.toArray();
fin.guardarEtiqueta = e => db.etiquetas.put(e);
fin.borrarEtiqueta = id => db.etiquetas.delete(id);

/* ---------- presupuestos y tasas ---------- */
fin.presupuestos = () => db.presupuestos.toArray();
fin.guardarPresupuesto = p => db.presupuestos.put(p);
fin.borrarPresupuesto = categoria => db.presupuestos.delete(categoria);
fin.tasas = () => db.tasas.toArray();
fin.guardarTasa = t => db.tasas.put(t);
fin.borrarTasa = id => db.tasas.delete(id);

/* ---------- comprobantes (imágenes) ---------- */
fin.agregarAdjunto = async (transaccionId, blob) => {
  const a = { id: uid(), transaccionId, mime: 'image/jpeg', creadoEn: new Date().toISOString(), blob };
  await db.adjuntos.put(a);
  return a.id;
};
fin.adjuntosDe = transaccionId => db.adjuntos.where('transaccionId').equals(transaccionId).toArray();
fin.adjunto = id => db.adjuntos.get(id);
fin.borrarAdjunto = id => db.adjuntos.delete(id);
fin.adjuntoURL = async id => {
  const a = await fin.adjunto(id);
  return a ? URL.createObjectURL(a.blob) : null;
};

/* ---------- carga inicial de catálogos (seed) ---------- */
fin.inicial = async () => {
  if ((await db.categorias.count()) === 0) {
    const gasto = [
      ['🍔', 'Comida'], ['🛒', 'Supermercado'], ['🍽️', 'Restaurantes'], ['☕', 'Café'],
      ['🚗', 'Vehículo'], ['⛽', 'Combustible'], ['🛠️', 'Reparaciones'], ['🏠', 'Hogar'],
      ['💡', 'Servicios'], ['📱', 'Suscripciones'], ['🎬', 'Entretenimiento'], ['👕', 'Ropa'],
      ['👨‍👩‍👧', 'Familia'], ['📚', 'Estudios'], ['🏥', 'Salud'], ['✈️', 'Viajes'],
      ['🎁', 'Regalos'], ['🐾', 'Mascotas'], ['💳', 'Comisión bancaria'], ['📦', 'Otros']
    ];
    const ingreso = [
      ['💰', 'Salario'], ['💼', 'Trabajo extra'], ['📈', 'Inversiones'], ['🎁', 'Regalos recibidos'], ['📦', 'Otros ingresos']
    ];
    const cats = [];
    for (const [emoji, nombre] of gasto) cats.push({ id: uid(), tipo: 'gasto', nombre, emoji });
    for (const [emoji, nombre] of ingreso) cats.push({ id: uid(), tipo: 'ingreso', nombre, emoji });
    await db.categorias.bulkPut(cats);
  }
  if ((await db.tasas.count()) === 0) {
    await db.tasas.add({ de: 'USD', a: 'GTQ', valor: 7.88, fecha: new Date().toISOString().slice(0, 10) });
  }
  if (!(await fin.getAjuste('monedaPrincipal'))) await fin.setAjuste('monedaPrincipal', 'GTQ');
};

fin._db = () => db;

export default fin;
