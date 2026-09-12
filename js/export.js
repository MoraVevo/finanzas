// Exportación e importación de datos. Tus datos son tuyos:
// CSV para Excel/Sheets, JSON completo para respaldo, y un resumen compacto
// listo para pegar en un asistente de IA (ChatGPT u otro) y que analice tus finanzas.

import fin from './db.js';
import { fmtMonto, monedaInfo, blobAB64, b64ABlob, isoLocal, claveMes, sumarMesClave, fmtConMoneda } from './util.js';
import { convertir, saldoCuenta, patrimonio } from './model.js';

/* ---------- descarga de archivos ---------- */
export async function descargarArchivo(nombre, blob) {
  const archivo = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const csvCell = v => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* ---------- CSV (movimientos, para Excel / Sheets / IA) ---------- */
export async function exportarCSV({ tasas, principal, cuentas, categorias }) {
  const txs = await fin.todasTx();
  const nombreCuenta = new Map(cuentas.map(c => [c.id, c]));
  const nombreCat = new Map(categorias.map(c => [c.id, c]));
  const filas = [
    ['fecha', 'hora', 'tipo', 'monto', 'moneda', `monto_en_${principal}`, 'cuenta', 'cuenta_destino',
      'categoria', 'etiquetas', 'motivo', 'comprobante', 'id'].join(',')
  ];
  for (const tx of txs.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    filas.push([
      tx.fecha.slice(0, 10), tx.fecha.slice(11, 16), tx.tipo,
      (tx.monto / 10 ** monedaInfo(tx.moneda).dec).toFixed(monedaInfo(tx.moneda).dec),
      tx.moneda,
      (convertir(tx.monto, tx.moneda, principal, tasas, tx.fecha) / 10 ** monedaInfo(principal).dec).toFixed(monedaInfo(principal).dec),
      nombreCuenta.get(tx.cuenta)?.nombre || '',
      tx.cuentaDestino ? (nombreCuenta.get(tx.cuentaDestino)?.nombre || '') : '',
      tx.categoria ? (nombreCat.get(tx.categoria)?.nombre || '') : '',
      (tx.etiquetas || []).join('|'),
      tx.motivo || '',
      (tx.adjuntos?.length || 0) > 0 ? 'si' : 'no',
      tx.id
    ].map(csvCell).join(','));
  }
  const csv = '\uFEFF' + filas.join('\n'); // BOM para que Excel respete UTF-8
  await descargarArchivo(`finanzas-${isoLocal().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- JSON completo (respaldo / importación) ---------- */
export async function exportarJSON({ incluirImagenes }) {
  const [cuentas, transacciones, categorias, etiquetas, presupuestos, tasas, ajustes, adjuntos] = await Promise.all([
    fin.cuentas(), db2().transacciones.toArray(), fin.categorias(), fin.etiquetas(),
    fin.presupuestos(), fin.tasas(), db2().ajustes.toArray(), db2().adjuntos.toArray()
  ]);
  const data = {
    formato: 'finanzas-backup', version: 1, exportadoEn: new Date().toISOString(),
    cuentas, transacciones, categorias, etiquetas, presupuestos, tasas, ajustes
  };
  if (incluirImagenes) {
    data.adjuntos = await Promise.all(adjuntos.map(async a => ({
      ...a, blob: undefined, data: await blobAB64(a.blob)
    })));
  }
  await descargarArchivo(
    `finanzas-respaldo-${isoLocal().slice(0, 10)}${incluirImagenes ? '-completo' : ''}.json`,
    new Blob([JSON.stringify(data)], { type: 'application/json' })
  );
}
const db2 = () => fin._db(); // accessor interno, definido abajo

/* ---------- Importar respaldo (reemplaza todo) ---------- */
export async function importarJSON(texto) {
  const data = JSON.parse(texto);
  if (data.formato !== 'finanzas-backup') throw new Error('No parece un respaldo de esta app.');
  const d = fin._db();
  await d.transaction('rw', d.tables, async () => {
    for (const tabla of ['cuentas', 'transacciones', 'categorias', 'etiquetas', 'presupuestos', 'tasas', 'adjuntos', 'ajustes']) {
      await d.table(tabla).clear();
    }
    await d.cuentas.bulkPut(data.cuentas || []);
    await d.transacciones.bulkPut(data.transacciones || []);
    await d.categorias.bulkPut(data.categorias || []);
    await d.etiquetas.bulkPut(data.etiquetas || []);
    await d.presupuestos.bulkPut(data.presupuestos || []);
    await d.tasas.bulkPut(data.tasas || []);
    await d.ajustes.bulkPut(data.ajustes || []);
    if (data.adjuntos) {
      await d.adjuntos.bulkPut(await Promise.all(data.adjuntos.map(async a => ({
        ...a, blob: await b64ABlob(a.data, a.mime || 'image/jpeg')
      }))));
    }
  });
}

/* ---------- Copiar para IA ---------- */
/** Genera un paquete de texto compacto con todo lo que una IA necesita para
 *  analizar tus finanzas, y lo copia al portapapeles. */
export async function copiarParaIA({ meses = 3, tasas, principal, cuentas, categorias }) {
  const hasta = isoLocal();
  const desdeClave = sumarMesClave(claveMes(hasta), -(meses - 1));
  const txs = (await fin.todasTx())
    .filter(t => t.fecha.slice(0, 7) >= desdeClave)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const nombreCuenta = new Map(cuentas.map(c => [c.id, c.nombre]));
  const nombreCat = new Map(categorias.map(c => [c.id, c.nombre]));
  const todasTx = await fin.todasTx();

  const paquete = {
    contexto: 'Registro personal de finanzas. Moneda principal para reportes: ' + principal +
      '. "tipo": gasto consume dinero; ingreso lo aporta; transferencia mueve entre cuentas propias y NO es gasto ni ingreso. Los montos con "_p" ya están convertidos a la moneda principal.',
    moneda_principal: principal,
    tasas_de_cambio_usadas: tasas.map(t => ({ de: t.de, a: t.a, valor: t.valor, fecha: t.fecha })),
    patrimonio_actual: (() => {
      const p = patrimonio(cuentas, todasTx, tasas, principal);
      return {
        total: fmtConMoneda(p.total, principal),
        deudas: fmtConMoneda(-p.deudas, principal),
        cuentas: cuentas.filter(c => !c.archivada).map(c => ({
          nombre: c.nombre, tipo: c.tipo, moneda: c.moneda,
          saldo: fmtMonto(saldoCuenta(c, todasTx), monedaInfo(c.moneda).dec)
        }))
      };
    })(),
    periodo_analizado: { meses, desde: desdeClave + '-01', hasta: hasta.slice(0, 10) },
    transacciones: txs.map(t => ({
      fecha: t.fecha, tipo: t.tipo,
      monto: +(t.monto / 10 ** monedaInfo(t.moneda).dec).toFixed(2),
      moneda: t.moneda,
      monto_p: +(convertir(t.monto, t.moneda, principal, tasas, t.fecha) / 10 ** monedaInfo(principal).dec).toFixed(2),
      cuenta: nombreCuenta.get(t.cuenta) || '',
      destino: t.cuentaDestino ? (nombreCuenta.get(t.cuentaDestino) || '') : undefined,
      categoria: t.categoria ? (nombreCat.get(t.categoria) || '') : undefined,
      etiquetas: t.etiquetas?.length ? t.etiquetas : undefined,
      motivo: t.motivo || undefined
    }))
  };
  const texto = JSON.stringify(paquete, null, 1);
  const paqueteFinal = 'Analiza mis finanzas personales con este JSON (datos reales de mi app). Dame: resumen de situación, ' +
    'patrones de gasto, top categorías y actividades/etiquetas, días de mayor consumo, entrada vs salida, ' +
    'alertas y recomendaciones concretas y accionables. Luego responde dudas específicas que te haga.\n\n' + texto;
  try {
    await navigator.clipboard.writeText(paqueteFinal);
    return { ok: true, n: txs.length };
  } catch {
    return { ok: false, n: txs.length, texto: paqueteFinal };
  }
}
