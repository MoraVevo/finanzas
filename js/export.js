// Exportación e importación de datos. Tus datos son tuyos:
// CSV para Excel/Sheets, JSON completo para respaldo, y un resumen compacto
// listo para pegar en un asistente de IA (ChatGPT u otro) y que analice tus finanzas.

import fin from './db.js';
import { fmtMonto, monedaInfo, blobAB64, b64ABlob, isoLocal, isoDia, claveMes, sumarMesClave, fmtConMoneda } from './util.js';
import { convertir, saldoCuenta, patrimonio, pagosTarjeta, deudasAntesDeIngreso, flujoEfectivo, planCuotas } from './model.js';

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

/** Arma el objeto completo del respaldo (tablas + contexto derivado). */
async function armarRespaldo() {
  const [cuentas, transacciones, categorias, etiquetas, presupuestos, tasas, futuros, fijos, cuotas, ajustes] = await Promise.all([
    fin.cuentas(), db2().transacciones.toArray(), fin.categorias(), fin.etiquetas(),
    fin.presupuestos(), fin.tasas(), fin.futuros(), fin.fijos(), fin.cuotas(), db2().ajustes.toArray()
  ]);
  const data = {
    formato: 'finanzas-backup', version: 2, exportadoEn: new Date().toISOString(),
    cuentas, transacciones, categorias, etiquetas, presupuestos, tasas, futuros, fijos, cuotas, ajustes
  };
  // contexto derivado para quien lea el respaldo (tú o una IA): pagos de
  // tarjeta con fechas de corte, compromisos, programados y proyección. La
  // importación lo ignora — solo restaura las tablas.
  const ajustesApp = ajustes.find(a => a.key === 'app')?.valor || {};
  data.contexto_financiero = contextoFinanciero({
    cuentas, txs: transacciones.filter(t => !t.eliminada), tasas,
    principal: ajustesApp.monedaPrincipal || 'GTQ', futuros, fijos, cuotas,
  });
  return { data, adjuntos: await db2().adjuntos.toArray() };
}

export async function exportarJSON({ incluirImagenes }) {
  const { data, adjuntos } = await armarRespaldo();
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

/** Copia el respaldo JSON como TEXTO al portapapeles — en iOS la hoja de
 *  compartir "Copia" un archivo solo pega su nombre; el texto sí se pega
 *  completo en cualquier parte (notas, chat, una IA). Sin comprobantes:
 *  el base64 multiplicaría el tamaño y el portapapeles podría truncarlo. */
export async function copiarRespaldoJSON() {
  const { data } = await armarRespaldo();
  const texto = JSON.stringify(data, null, 1);
  try {
    await navigator.clipboard.writeText(texto);
    return { ok: true };
  } catch {
    return { ok: false, texto };
  }
}
const db2 = () => fin._db(); // accessor interno, definido abajo

/* ---------- Contexto financiero derivado (para IA) ----------
   Lo que un LLM no puede deducir de las tablas crudas: cuánto debes pagar de
   cada tarjeta y cuándo, qué vence antes del próximo ingreso, qué fijos y
   cuotas vienen, y cómo queda el saldo proyectado a 2 meses. Los saldos dejan
   de ser una foto estática y se vuelven movimiento: por qué están así, qué se
   paga ahora y cómo se ve el futuro. */
export function contextoFinanciero({ cuentas, txs, tasas, principal, futuros = [], fijos = [], cuotas = [] }) {
  const activas = cuentas.filter(c => !c.archivada);
  const nombreC = id => cuentas.find(c => c.id === id)?.nombre || null;
  const esPasiva = c => c.tipo === 'tarjeta' || c.tipo === 'deuda';
  const hoyD = isoDia();
  const pat = patrimonio(cuentas, txs, tasas, principal);
  const deudaYa = deudasAntesDeIngreso({ cuentas, txs, tasas, principal, futuros, fijos, cuotas });
  const fl = flujoEfectivo({ cuentas, txs, tasas, principal, futuros, fijos, cuotas, futuroMeses: 2 });
  const concepto = e => e.esPagoTarjeta ? e.nombre
    : e.esCargoTarjeta ? `${e.nombre} (se cargará a ${e.fuenteNombre})`
    : e.esCuota ? `${e.nombre} · cuota ${e.cuotaK} de ${e.cuotaN}`
    : e.tipo === 'transferencia' ? `${nombreC(e.cuenta)} → ${nombreC(e.cuentaDestino)}${e.nombre ? ' · ' + e.nombre : ''}`
    : (e.nombre || (e.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'));
  return {
    generado: hoyD,
    moneda_principal: principal,
    como_leerlo: 'Fechas en ISO (aaaa-mm-dd); "día de corte/pago" son días del mes. Los montos ya están formateados con su moneda. "deudas_por_pagar_ahora" es lo que vence antes del próximo ingreso fijo. "proximos_pagos_estimados" de cada tarjeta: el primero cubre lo ya gastado en el ciclo cerrado; los siguientes proyectan fijos y cuotas. "proyeccion_2_meses" asume SOLO lo registrado (fijos, cuotas y programados): no predice gastos nuevos. Saldo negativo = deuda; las cuentas "tercero" no son del usuario.',
    patrimonio_hoy: {
      total: fmtConMoneda(pat.total, principal),
      deudas_totales: fmtConMoneda(pat.deudas, principal),
      por_cuenta: activas.map(c => ({ nombre: c.nombre, tipo: c.tipo, moneda: c.moneda, saldo: fmtConMoneda(saldoCuenta(c, txs, tasas), c.moneda) })),
    },
    tarjetas_y_deudas: activas.filter(esPasiva).map(c => {
      const saldo = saldoCuenta(c, txs, tasas);
      return {
        nombre: c.nombre, tipo: c.tipo, moneda: c.moneda,
        dia_de_corte: c.corte || null,
        dia_limite_de_pago: c.pagoDia || null,
        deuda_hoy: fmtConMoneda(Math.max(0, -saldo), c.moneda),
        limite_de_credito: c.limite > 0 ? fmtConMoneda(c.limite, c.moneda) : null,
        credito_disponible: c.limite > 0 ? fmtConMoneda(Math.max(0, c.limite + saldo), c.moneda) : null,
        proximos_pagos_estimados: (c.pagoDia
          ? pagosTarjeta(c, { txs, tasas, principal, fijos, cuotas, n: 2 })
          : []).map(p => ({ fecha: p.fecha, monto: fmtConMoneda(p.montoP, principal) })),
      };
    }),
    deudas_por_pagar_ahora: {
      total: fmtConMoneda(deudaYa.total, principal),
      ventana: deudaYa.sinIngresoFijo
        ? 'próximos 30 días (no hay ingreso fijo registrado)'
        : `desde mañana hasta el ingreso fijo del ${deudaYa.limite}`,
    },
    ingresos_y_gastos_fijos: fijos.filter(f => f.activa !== false).map(f => ({
      nombre: f.nombre || (f.tipo === 'ingreso' ? 'Ingreso fijo' : 'Gasto fijo'),
      tipo: f.tipo,
      monto: fmtConMoneda(f.monto, f.moneda),
      frecuencia: f.frecuencia,
      dia: f.dia ?? null,
      cuenta: f.tipo === 'ingreso' ? nombreC(f.cuenta) : nombreC(f.fuente),
    })),
    planes_de_cuotas: cuotas.filter(p => p.activa !== false && !planCuotas(p).terminado).map(p => {
      const i = planCuotas(p);
      return {
        nombre: p.nombre || 'Plan de pago',
        paga_a: nombreC(p.cuentaId),
        cuota_mensual: fmtConMoneda(i.cuota, p.moneda),
        pagadas: i.vencidas, total_cuotas: i.n,
        proxima_cuota: i.proxima ? { fecha: i.proxima.fecha, monto: fmtConMoneda(i.montoK(i.proxima.k), p.moneda) } : null,
        pendiente_total: fmtConMoneda(i.pendiente, p.moneda),
        ultima_cuota: i.ultima,
      };
    }),
    pagos_programados: [...futuros].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(f => ({
      fecha: f.fecha,
      tipo: f.tipo,
      nombre: f.nombre || null,
      monto: fmtConMoneda(f.monto, f.moneda),
      desde: nombreC(f.cuenta),
      hacia: f.cuentaDestino ? nombreC(f.cuentaDestino) : null,
      ...(f.fecha < hoyD ? { aviso: 'VENCIDO sin registrar como movimiento' } : {}),
    })),
    proyeccion_2_meses: {
      saldo_hoy: fmtConMoneda(fl.balanceHoy, principal),
      saldo_proyectado_en_2_meses: fmtConMoneda(fl.serie.at(-1).balance, principal),
      punto_mas_bajo: { fecha: fl.minimo.fecha, saldo: fmtConMoneda(fl.minimo.balance, principal) },
      proximos_movimientos: fl.lista.slice(0, 25).map(e => ({
        fecha: e.fecha,
        concepto: concepto(e),
        monto: fmtConMoneda(e.monto, e.moneda),
        saldo_proyectado_despues: fmtConMoneda(e.balanceDespues, principal),
      })),
    },
  };
}

/* ---------- Importar respaldo (reemplaza todo) ---------- */
export async function importarJSON(texto) {
  const data = JSON.parse(texto);
  if (data.formato !== 'finanzas-backup') throw new Error('No parece un respaldo de esta app.');
  const d = fin._db();
  await d.transaction('rw', d.tables, async () => {
    for (const tabla of ['cuentas', 'transacciones', 'categorias', 'etiquetas', 'presupuestos', 'tasas', 'futuros', 'fijos', 'cuotas', 'adjuntos', 'ajustes']) {
      await d.table(tabla).clear();
    }
    await d.cuentas.bulkPut(data.cuentas || []);
    await d.transacciones.bulkPut(data.transacciones || []);
    await d.categorias.bulkPut(data.categorias || []);
    await d.etiquetas.bulkPut(data.etiquetas || []);
    await d.presupuestos.bulkPut(data.presupuestos || []);
    await d.tasas.bulkPut(data.tasas || []);
    await d.futuros.bulkPut(data.futuros || []);
    await d.fijos.bulkPut(data.fijos || []);
    await d.cuotas.bulkPut(data.cuotas || []);
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
  const [futuros, fijos, cuotas] = await Promise.all([fin.futuros(), fin.fijos(), fin.cuotas()]);

  const paquete = {
    contexto: 'Registro personal de finanzas. Moneda principal para reportes: ' + principal +
      '. "tipo": gasto consume dinero; ingreso lo aporta; transferencia mueve entre cuentas (propias o de terceros) y NO es gasto ni ingreso. Las cuentas tipo "tercero" no son del usuario: su saldo acumula lo depositado y queda fuera del patrimonio. Los montos con "_p" ya están convertidos a la moneda principal.',
    moneda_principal: principal,
    tasas_de_cambio_usadas: tasas.map(t => ({ de: t.de, a: t.a, valor: t.valor, fecha: t.fecha })),
    patrimonio_actual: (() => {
      const p = patrimonio(cuentas, todasTx, tasas, principal);
      return {
        total: fmtConMoneda(p.total, principal),
        deudas: fmtConMoneda(-p.deudas, principal),
        cuentas: cuentas.filter(c => !c.archivada).map(c => ({
          nombre: c.nombre, tipo: c.tipo, moneda: c.moneda,
          saldo: fmtMonto(saldoCuenta(c, todasTx, tasas), monedaInfo(c.moneda).dec)
        }))
      };
    })(),
    contexto_financiero: contextoFinanciero({ cuentas, txs: todasTx, tasas, principal, futuros, fijos, cuotas }),
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
  const paqueteFinal = 'Analiza mis finanzas personales con este JSON (datos reales de mi app). Fíjate en "contexto_financiero": ahí están mis pagos de tarjeta con fechas de corte y pago, lo que vence antes de mi próximo ingreso, mis fijos, cuotas y pagos programados, y la proyección a 2 meses. Dame: resumen de situación (incluye qué debo pagar primero y cuándo), patrones de gasto, top categorías y actividades/etiquetas, días de mayor consumo, entrada vs salida, alertas (especialmente si un pago no alcanza a cubrirse con mi saldo actual) y recomendaciones concretas y accionables. Luego responde dudas específicas que te haga.\n\n' + texto;
  try {
    await navigator.clipboard.writeText(paqueteFinal);
    return { ok: true, n: txs.length };
  } catch {
    return { ok: false, n: txs.length, texto: paqueteFinal };
  }
}
