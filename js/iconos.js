// Iconos SVG de la app: trazo 1.8, puntas redondas, viewBox 24, currentColor
// (heredan el color del botón/texto contenedor). Reemplazan a los emojis
// gradualmente; categorías de gastos aún usan emojis de sistema.
import { html } from '../vendor/preact-standalone.module.js';

const trazo = {
  fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
};

/** Iconos de la barra inferior (sin texto: solo icono + aria-label). */
export const ICONOS_TAB = {
  inicio: html`<svg ...${trazo} viewBox="0 0 24 24">
    <path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.6 1.6 0 0 1-1.6 1.6H6.1a1.6 1.6 0 0 1-1.6-1.6Z" />
    <path d="M9.6 20.1v-5.4h4.8v5.4" />
  </svg>`,
  movs: html`<svg ...${trazo} viewBox="0 0 24 24">
    <rect x="4.2" y="3.6" width="15.6" height="16.8" rx="2.8" />
    <path d="M8.2 8.4h7.6M8.2 12h7.6M8.2 15.6h4.6" />
  </svg>`,
  stats: html`<svg ...${trazo} viewBox="0 0 24 24">
    <path d="M4 20.4h16" opacity=".45" />
    <path d="M6.4 20.4V13M12 20.4V4.8M17.6 20.4v-4.6" />
  </svg>`,
  cuentas: html`<svg ...${trazo} viewBox="0 0 24 24">
    <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.6" />
    <path d="M3.2 9.9h17.6" />
    <path d="M6.6 14.9h4" />
  </svg>`,
};

/** Engrane de ajustes (botón ⚙️ de la cabecera de Inicio). */
export const ICONO_AJUSTES = html`<svg ...${trazo} viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
</svg>`;

/** Lápiz: editar. */
export const ICONO_EDITAR = html`<svg ...${trazo} viewBox="0 0 24 24">
  <path d="M4 20h4.3L19.5 8.8a2.1 2.1 0 0 0 0-3l-1.3-1.3a2.1 2.1 0 0 0-3 0L4 15.7Z" />
  <path d="M13.9 6.1l4 4" />
</svg>`;

/** Bote de basura: eliminar. */
export const ICONO_BASURA = html`<svg ...${trazo} viewBox="0 0 24 24">
  <path d="M4.5 6.5h15" />
  <path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" />
  <path d="M6.2 6.5 7 19a1.8 1.8 0 0 0 1.8 1.7h6.4A1.8 1.8 0 0 0 17 19l.8-12.5" />
  <path d="M10 10.5v6M14 10.5v6" />
</svg>`;

/** Caja cerrada: archivar. */
export const ICONO_CAJA = html`<svg ...${trazo} viewBox="0 0 24 24">
  <path d="M3.8 7.5 12 3.6l8.2 3.9v9L12 20.4l-8.2-3.9Z" />
  <path d="M3.8 7.5 12 11.4l8.2-3.9M12 11.4v9" />
</svg>`;

/** Flecha circular: restaurar. */
export const ICONO_RESTAURAR = html`<svg ...${trazo} viewBox="0 0 24 24">
  <path d="M4.2 12a7.8 7.8 0 1 0 2.3-5.5L4 9" />
  <path d="M4 4.5V9h4.5" />
</svg>`;

/* ---------- Iconos de interfaz (reemplazan emojis fijos) ----------
   Se dimensionan solos: 24px dentro de .fila .emoji, 15px en línea. */

/** Dos flechas opuestas: transferencia. */
export const ICONO_TRANSFER = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <path d="M4.5 8.5h13M14 5l3.5 3.5L14 12" />
  <path d="M19.5 15.5h-13M10 12l-3.5 3.5L10 19" />
</svg>`;

/** Tarjeta: pago de deuda. */
export const ICONO_TARJETA = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.6" />
  <path d="M3.2 9.9h17.6M6.6 14.9h4" />
</svg>`;

/** Etiqueta colgante: actividades. */
export const ICONO_ETIQUETA = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7L20.6 11.9a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0Z" />
  <path d="M7.8 7.8v.01" stroke-width="2.4" />
</svg>`;

/** Cámara: tomar foto. */
export const ICONO_CAMARA = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <path d="M4 9a2 2 0 0 1 2-2h1.5l1.4-2h7.2l1.4 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
  <circle cx="12" cy="12.7" r="3.2" />
</svg>`;

/** Paisaje en marco: elegir imagen. */
export const ICONO_IMAGEN = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <rect x="3.5" y="5" width="17" height="14" rx="2.4" />
  <path d="M6 16.5l4.2-4.2 3 3 2.6-2.6 3.2 3.2" />
  <circle cx="9" cy="9.4" r="1.2" />
</svg>`;

/** Flecha hacia una bandeja: dinero que entra (ingreso). */
export const ICONO_ENTRA = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <path d="M12 4.5v9M8 9.5l4 4 4-4" />
  <path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
</svg>`;

/** Flecha saliendo de una bandeja: dinero que sale (gasto). */
export const ICONO_SALE = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <path d="M12 13.5v-9M8 8.5l4-4 4 4" />
  <path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
</svg>`;

/** Categorías: agrupa los emojis del selector en buckets con icono propio. */

/** Categorías: agrupa los emojis del selector en buckets con icono propio. */
const CONTENIDO_CATEGORIA = {
  comida: html`<path d="M6.5 3.5v17M4.2 3.5v4.1a2.3 2.3 0 0 0 4.6 0V3.5" />
    <path d="M17.6 3.5c-1.9 1.9-2.6 4.6-1.7 7.2.3.9 1 1.4 1.7 1.5v8.3" />`,
  compras: html`<path d="M5.6 8.5h12.8l-1 10.6a1.9 1.9 0 0 1-1.9 1.7H8.5a1.9 1.9 0 0 1-1.9-1.7Z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />`,
  transporte: html`<path d="M5 16.2 6.2 11a2 2 0 0 1 1.9-1.4h7.8a2 2 0 0 1 1.9 1.4l1.2 5.2" />
    <path d="M3.8 16.2h16.4v2.5a.9.9 0 0 1-.9.9h-1.5a.9.9 0 0 1-.9-.9v-.7H7.1v.7a.9.9 0 0 1-.9.9H4.7a.9.9 0 0 1-.9-.9Z" />`,
  hogar: html`<path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.6 1.6 0 0 1-1.6 1.6H6.1a1.6 1.6 0 0 1-1.6-1.6Z" />
    <path d="M9.6 20.1v-5.4h4.8v5.4" />`,
  servicios: html`<path d="M9.6 18.2h4.8M10.4 20.6h3.2" />
    <path d="M12 3.5a5.4 5.4 0 0 0-3.1 9.8c.7.5 1.1 1.2 1.1 2h4c0-.8.4-1.5 1.1-2A5.4 5.4 0 0 0 12 3.5Z" />`,
  ocio: html`<circle cx="12" cy="12" r="8.4" />
    <path d="M10.1 8.9l4.8 3.1-4.8 3.1Z" />`,
  ropa: html`<path d="M8.3 4.2 12 5.8l3.7-1.6 4 3.1-2.4 2.4-1-.7V20H7.7v-9.9l-1 .7-2.4-2.4Z" />`,
  salud: html`<path d="M9.3 4h5.4v5.3H20v5.4h-5.3V20H9.3v-5.3H4V9.3h5.3Z" />`,
  estudios: html`<path d="M5 5.4A1.9 1.9 0 0 1 6.9 3.5h12v14.2H6.9A1.9 1.9 0 0 0 5 19.6Z" />
    <path d="M5 19.6a1.9 1.9 0 0 1 1.9-1.9h12" />`,
  mascotas: html`<circle cx="7" cy="9.4" r="1.4" /><circle cx="10.2" cy="6.9" r="1.5" />
    <circle cx="13.8" cy="6.9" r="1.5" /><circle cx="17" cy="9.4" r="1.4" />
    <path d="M12 11.4c2.7 0 4.4 1.8 4.4 3.9 0 1.6-1.2 2.6-2.7 2.6-.7 0-1.1-.3-1.7-.3s-1 .3-1.7.3c-1.5 0-2.7-1-2.7-2.6 0-2.1 1.7-3.9 4.4-3.9Z" />`,
  viajes: html`<path d="M20.5 3.5 3.8 10.4l5.7 2.4 2.4 5.7Z" />
    <path d="M9.5 12.8 20.5 3.5" />`,
  regalos: html`<rect x="4" y="9.8" width="16" height="9.7" rx="1.6" />
    <path d="M4 9.8h16M12 9.8v9.7" />
    <path d="M12 9.8C9.4 9.8 7.5 8.8 7.5 7.1 7.5 5.5 10.1 5.3 12 9.8Zm0 0c2.6 0 4.5-1 4.5-2.7 0-1.6-2.6-1.8-4.5 2.7Z" />`,
  dinero: html`<rect x="3" y="6.5" width="18" height="11" rx="2.2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6.3 9.6v.01M17.7 14.4v.01" stroke-width="2.4" />`,
  trabajo: html`<rect x="3.5" y="7.6" width="17" height="11.8" rx="2" />
    <path d="M9.2 7.6V6a2 2 0 0 1 2-2h1.6a2 2 0 0 1 2 2v1.6M3.5 12.6h17" />`,
  crecimiento: html`<path d="M3.5 17 9 11.5l3.5 3.5 7.5-8" />
    <path d="M15.8 7h4.2v4.2" />`,
  tag: html`<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7L20.6 11.9a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0Z" />
    <path d="M7.8 7.8v.01" stroke-width="2.4" />`,
};
const EMOJIS_GRUPO = {
  comida: '🍔 🍕 🍟 🌮 🍣 🍜 🍱 🥗 🍿 🍩 ☕ 🥤 🍺 🍽️ 🍨 🥟 🌯 🥞 🧇 🍪',
  compras: '🛒 🛍️ 🏪',
  transporte: '🚗 🚙 🚌 🚕 🚲 🏍️ 🏁 🅿️ ⛽ 🔧 🛠️ 🧰 🚚 🚐',
  hogar: '🏠 🛋️ 🧻 🧹 🧺 🔌 🚿 🛏️ 🪟 🚪',
  servicios: '💡 📱 💻 🖥️ 🎧 📺 ☎️ 📡 🔋',
  ocio: '🎬 🎭 🎫 🎣 ⚽ 🏀 🏋️ 🏊 🏕️ 🎿 🎮 🎯 🎲 🎸 🎹 🥁',
  ropa: '👕 👖 👟 🎒 🕶️ 💍 🧴 👗 🧢 ⌚',
  salud: '💊 🩺 🏥 🦷 ❤️ 🧠 🩹 🚑 👁️',
  estudios: '📚 ✏️ 🎓 🖊️ 📝 🧮 📐 🔬',
  mascotas: '🐶 🐱 🐾 🐦 🌱 🌳 🐢 🐟',
  viajes: '✈️ 🏖️ 🗺️ 🧳 ⛱️ 🌍',
  regalos: '💐 🎁 🎉 🎂 👶 🎈 🪅',
  dinero: '💰 💳 🏦 📈 📉 💵 🧾 💴 💶 💷 🪙',
  trabajo: '💼 🖇️ 📋 📁 🏢',
  crecimiento: '📈 🪙',
};
const EMOJI_A_GRUPO = {};
for (const [grupo, lista] of Object.entries(EMOJIS_GRUPO)) {
  for (const e of lista.split(' ')) EMOJI_A_GRUPO[e] = grupo;
}
const NOMBRE_A_GRUPO = [
  [/comida|restaurant|café|cafe|pizza|soda|snack/i, 'comida'],
  [/super|mercado|tienda/i, 'compras'],
  [/gasolin|vehic|combust|auto|moto|parqueo|llanta/i, 'transporte'],
  [/hogar|casa|alquiler|renta|muebl|limpieza/i, 'hogar'],
  [/servicio|luz|agua|teléfono|telefono|internet|suscrip|cable/i, 'servicios'],
  [/entreten|cine|juego|deporte|salida/i, 'ocio'],
  [/ropa|calzado|accesorio/i, 'ropa'],
  [/salud|farmacia|médic|medic|doctor|dentista/i, 'salud'],
  [/estudio|escuela|universidad|libro|curso/i, 'estudios'],
  [/mascota|veterin|perro|gato|planta/i, 'mascotas'],
  [/viaje|vacacion|hotel|turis/i, 'viajes'],
  [/regalo|cumpleaños|fiesta/i, 'regalos'],
  [/comisión|comision|banco|tarjeta|interes|interés|inversi/i, 'dinero'],
  [/trabajo|oficina|sueldo|negocio/i, 'trabajo'],
];

/** Icono de categoría de gasto/ingreso: mapea su emoji (o nombre) a un grupo
 *  con SVG propio; lo no reconocido cae en una etiqueta genérica. */
export function IconoCategoria({ emoji, nombre }) {
  const grupo = EMOJI_A_GRUPO[emoji]
    || (NOMBRE_A_GRUPO.find(([re]) => re.test(nombre || ''))?.[1])
    || 'tag';
  return html`<svg class="icono-categoria" ...${trazo} viewBox="0 0 24 24">${CONTENIDO_CATEGORIA[grupo]}</svg>`;
}

/** Contenido de cada icono de cuenta (el wrapper común lo pone IconoCuenta). */
const CONTENIDO_CUENTA = {
  efectivo: html`<rect x="3" y="6.5" width="18" height="11" rx="2.2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6.3 9.6v.01M17.7 14.4v.01" stroke-width="2.4" />`,
  bancaria: html`<path d="M4 9.7 12 4.6l8 5.1" />
    <path d="M5.8 12.5v5M10 12.5v5M14 12.5v5M18.2 12.5v5" />
    <path d="M4.5 20.4h15" />`,
  ahorro: html`<path d="M9.3 4.2h5.4" />
    <path d="M7.2 7.6h9.6v8.2a3.7 3.7 0 0 1-3.7 3.7h-2.2a3.7 3.7 0 0 1-3.7-3.7Z" />
    <circle cx="12" cy="13.1" r="2.2" />`,
  tarjeta: html`<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.6" />
    <path d="M3.2 9.9h17.6" />
    <path d="M6.6 14.9h4" />`,
  deuda: html`<path d="M4.2 6.6 9.4 12l3.3-3.3 7 7" />
    <path d="M19.7 15.7v-4.6M19.7 15.7h-4.6" />`,
  tercero: html`<circle cx="12" cy="8.1" r="3.2" />
    <path d="M5.9 19.6c.8-3.2 3.2-4.9 6.1-4.9s5.3 1.7 6.1 4.9" />`,
};

/** Icono de tipo de cuenta (efectivo, bancaria, ahorro, tarjeta, deuda). */
export function IconoCuenta({ tipo }) {
  const contenido = CONTENIDO_CUENTA[tipo];
  return contenido
    ? html`<svg class="icono-cuenta" ...${trazo} viewBox="0 0 24 24">${contenido}</svg>`
    : null;
}
