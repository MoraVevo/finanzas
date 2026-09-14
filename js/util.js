// Utilidades generales: fechas, montos, ids.

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));

const p2 = n => String(n).padStart(2, '0');

/** Fecha local -> 'YYYY-MM-DDTHH:mm' (formato lexicográficamente ordenable) */
export function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function isoDia(d = new Date()) { return isoLocal(d).slice(0, 10); }

export const deISO = iso => new Date(iso + (iso.length <= 10 ? 'T12:00' : ''));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const nombreMes = m => MESES[m];
export const claveMes = iso => iso.slice(0, 7); // '2026-09'
export const mesDeClave = c => { const [a, m] = c.split('-'); return { anio: +a, mes: +m - 1 }; };
export const claveMesActual = () => claveMes(isoLocal());

export function fmtFecha(iso) {
  const d = deISO(iso);
  const hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (isoDia(d) === isoDia(hoy)) return 'Hoy';
  if (isoDia(d) === isoDia(ayer)) return 'Ayer';
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}
export const fmtHora = iso => iso.slice(11, 16);
export function fmtMesLargo(clave) {
  const { anio, mes } = mesDeClave(clave);
  const actual = new Date();
  if (anio === actual.getFullYear()) return nombreMes(mes);
  return `${nombreMes(mes)} ${anio}`;
}
export function rangoMes(clave) {
  const { anio, mes } = mesDeClave(clave);
  const inicio = `${clave}-01T00:00`;
  const fin = mes === 11 ? `${anio + 1}-01-01T00:00` : `${anio}-${p2(mes + 2)}-01T00:00`;
  return [inicio, fin];
}
export function sumarMesClave(clave, delta) {
  const { anio, mes } = mesDeClave(clave);
  const d = new Date(anio, mes + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}

/** Entero en unidades mínimas -> texto con separador de miles y decimales según moneda */
export function fmtMonto(entero, dec = 2, conSigno = false) {
  const neg = entero < 0;
  const abs = Math.abs(entero);
  const factor = 10 ** dec;
  const ent = Math.trunc(abs / factor), frac = abs % factor;
  let t = ent.toLocaleString('en-US');
  if (dec > 0) t += '.' + String(frac).padStart(dec, '0');
  if (neg) t = '-' + t;
  return (conSigno && !neg && entero !== 0 ? '+' : '') + t;
}

/** Texto tecleado ("125.", "1.250.5") -> entero en unidades mínimas. Devuelve null si inválido/0 */
export function textoAEntero(texto, dec = 2) {
  const limpio = texto.replace(/[^0-9.]/g, '');
  const partes = limpio.split('.');
  let valor;
  if (partes.length > 2) {
    const ent = partes.slice(0, -1).join('');
    valor = Number(ent + '.' + partes.at(-1));
  } else {
    valor = Number(limpio || '0');
  }
  if (!isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 10 ** dec);
}

/** Entero -> texto editable simple (para inputs) */
export function enteroATexto(entero, dec = 2) {
  if (!entero) return '';
  const factor = 10 ** dec;
  return (entero / factor).toFixed(dec);
}

export function monedaInfo(codigo) {
  const lista = {
    GTQ: { simbolo: 'Q', dec: 2 }, USD: { simbolo: '$', dec: 2 }, EUR: { simbolo: '€', dec: 2 },
    MXN: { simbolo: 'MX$', dec: 2 }, COP: { simbolo: 'COL$', dec: 2 }, PEN: { simbolo: 'S/', dec: 2 },
    ARS: { simbolo: 'AR$', dec: 2 }, CLP: { simbolo: 'CL$', dec: 0 }, BOB: { simbolo: 'Bs', dec: 2 },
    HNL: { simbolo: 'L', dec: 2 }, NIO: { simbolo: 'C$', dec: 2 }, CRC: { simbolo: '₡', dec: 2 },
    DOP: { simbolo: 'RD$', dec: 2 }, PYG: { simbolo: '₲', dec: 0 }, BRL: { simbolo: 'R$', dec: 2 },
  };
  return lista[codigo] || { simbolo: codigo + ' ', dec: 2 };
}

export const fmtConMoneda = (entero, codigo, conSigno = false) => {
  const m = monedaInfo(codigo);
  return `${m.simbolo}${fmtMonto(entero, m.dec, conSigno)}`;
};

/** Monto compacto para ejes de gráfica: los enteros viven en unidades mínimas,
 *  así que primero se dividen según la moneda (20000 centavos → "200", no
 *  "20,000") y luego se abrevian miles: 250, 2.5k, 48k. */
export function fmtCompacto(entero, codigo) {
  const v = entero / 10 ** monedaInfo(codigo).dec;
  const a = Math.abs(v);
  const t = a >= 1000
    ? (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
    : String(Math.round(a));
  return (v < 0 ? '−' : '') + t;
}

/** Comprime una imagen a JPEG razonable para guardar comprobantes */
export function comprimirImagen(archivo, maxLado = 1400, calidad = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        blob ? resolve(blob) : reject(new Error('compresión'));
      }, 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen inválida')); };
    img.src = url;
  });
}

export const blobAB64 = blob => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(',')[1]);
  r.readAsDataURL(blob);
});
export const b64ABlob = (b64, mime) => fetch(`data:${mime};base64,${b64}`).then(r => r.blob());
