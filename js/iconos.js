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

/** Calendario: elegir período. */
export const ICONO_CALENDARIO = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24">
  <rect x="3.8" y="5.2" width="16.4" height="15" rx="2.4" />
  <path d="M3.8 9.9h16.4M8.2 3.4v3.4M15.8 3.4v3.4" />
</svg>`;

/** Dos hojas: copiar al portapapeles. */
export const ICONO_COPIAR = html`<svg class="icono-ui" ...${trazo} viewBox="0 0 24 24" style="width:13px;height:13px">
  <rect x="8.8" y="8.8" width="11.2" height="11.2" rx="2" />
  <path d="M15.2 8.8V6.4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.2a2 2 0 0 0 2 2h2.4" />
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
/** Los emojis de sistema traen selectores de variación (U+FE0F) que rompen
 *  la comparación por clave: todo lookup va pelado. */
const sinFv = e => (e || '').replace(/\uFE0F/g, '');
const EMOJI_A_GRUPO = {};
for (const [grupo, lista] of Object.entries(EMOJIS_GRUPO)) {
  for (const e of lista.split(' ')) EMOJI_A_GRUPO[sinFv(e)] = grupo;
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

/** Icono de categoría: mapea su emoji a un grupo con SVG propio; lo no
 *  reconocido cae en una etiqueta genérica. */
export function IconoCategoria({ emoji, nombre }) {
  const grupo = EMOJI_A_GRUPO[sinFv(emoji)]
    || (NOMBRE_A_GRUPO.find(([re]) => re.test(nombre || ''))?.[1])
    || 'tag';
  return html`<svg class="icono-categoria" ...${trazo} viewBox="0 0 24 24">${CONTENIDO_CATEGORIA[grupo]}</svg>`;
}

/* ---------- Categorías con icono propio ----------
   Cada categoría semilla tiene su trazo DISTINTO (Café ≠ Comida ≠ Restaurantes)
   para conservar la distinción al capturar. Las categorías personalizadas del
   usuario no están en el mapa: muestran su emoji sin conversión. */

const hamburguesa = html`<path d="M5 10.7c0-3.4 3.1-5.7 7-5.7s7 2.3 7 5.7" />
  <path d="M5 13.9h14" />
  <path d="M5 16.9h14v.4a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 17.3Z" />`;

const carrito = html`<path d="M3.5 5h2l2.3 10.6a1.6 1.6 0 0 0 1.6 1.2h7.5a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.2" />
  <path d="M10 20v.01M16.5 20v.01" stroke-width="2.4" />`;

const cubiertos = html`<path d="M8 3.5v17M6 3.5v4.2a2 2 0 0 0 4 0V3.5" />
  <path d="M17 3.5v17M17 3.5c-1.9 1.9-2.6 4.5-1.6 7 .3.8 1 1.2 1.6 1.2" />`;

const tazaCafe = html`<path d="M5 9.5h11V15a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15Z" />
  <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
  <path d="M8.7 3.5c-.9 1-.9 2 0 3M12.3 3.5c-.9 1-.9 2 0 3" />`;

const coche = html`<path d="M5 16.2 6.2 11a2 2 0 0 1 1.9-1.4h7.8a2 2 0 0 1 1.9 1.4l1.2 5.2" />
  <path d="M3.8 16.2h16.4v2.5a.9.9 0 0 1-.9.9h-1.5a.9.9 0 0 1-.9-.9v-.7H7.1v.7a.9.9 0 0 1-.9.9H4.7a.9.9 0 0 1-.9-.9Z" />`;

const cocheFrontal = html`<path d="M6.4 12 7.6 7.9a2.2 2.2 0 0 1 2.1-1.6h4.6a2.2 2.2 0 0 1 2.1 1.6L17.6 12" />
  <rect x="4.2" y="12" width="15.6" height="4.6" rx="2" />
  <path d="M7.3 14.8v.01M16.7 14.8v.01" stroke-width="2.4" />
  <path d="M10.4 14.8h3.2" />`;

const gasolina = html`<path d="M6 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16" />
  <path d="M4.5 21h12" />
  <path d="M8.5 6.5h4v3h-4Z" />
  <path d="M15 8.5h1.3a1.7 1.7 0 0 1 1.7 1.7v5.6a1.6 1.6 0 0 0 3.2 0V9.4L19 7.2" />`;

const llave = html`<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />`;

const telefono = html`<rect x="7.5" y="3" width="9" height="18" rx="2.2" />
  <path d="M11 17.5h2" />`;

const familia = html`<circle cx="9" cy="7.8" r="2.8" />
  <path d="M3.5 20c.6-3.4 2.7-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
  <circle cx="17.2" cy="12.4" r="2.1" />
  <path d="M14.6 20c.4-2.4 1.3-3.6 2.6-3.6s2.2 1.2 2.6 3.6" />`;

const birrete = html`<path d="M12 4.5 21 9l-9 4.5L3 9Z" />
  <path d="M6.5 11.2v4.3c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.3" />
  <path d="M21 9v5.2" />`;

const bolsaDinero = html`<path d="M10 3.5h4l-.7 3.2c3.2 1.4 5.2 4 5.2 7.3A6.5 6.5 0 0 1 12 20.5 6.5 6.5 0 0 1 5.5 14c0-3.3 2-5.9 5.2-7.3Z" />
  <path d="M12 10.5v7M13.9 12.1c-.4-.7-1.1-1.1-1.9-1.1-1.1 0-1.9.6-1.9 1.5s.8 1.3 1.9 1.5 1.9.6 1.9 1.5-.8 1.5-1.9 1.5c-.8 0-1.5-.4-1.9-1.1" />`;

const caja = html`<path d="M12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
  <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />`;

const llaveDePuerta = html`<circle cx="16.5" cy="7.5" r="4.2" />
  <path d="M13.5 10.5 4 20" />
  <path d="M7.6 16.4l2.2 2.2M5.4 18.6l1.7 1.7" />`;

const recibo = html`<path d="M6 3.5h12v16.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z" />
  <path d="M9 8h6M9 11.5h6M9 15h3.5" />`;

const escudo = html`<path d="M12 3.5 19.5 6v6c0 4.8-3.2 7.7-7.5 9-4.3-1.3-7.5-4.2-7.5-9V6Z" />
  <path d="M9 12l2.2 2.2L15.5 10" />`;

const mancuerna = html`<path d="M9.2 12h5.6" />
  <path d="M6.9 8.9v6.2M4.4 7.2v9.6M17.1 8.9v6.2M19.6 7.2v9.6" />`;

const ticket = html`<path d="M3.5 9a2.5 2.5 0 0 1 0 6v1.4a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V15a2.5 2.5 0 0 1 0-6V7.6a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2Z" />
  <path d="M14.4 5.6v2.2M14.4 10.9v2.2M14.4 16.2v2.2" />`;

const bici = html`<circle cx="5.8" cy="16.4" r="3.5" />
  <circle cx="18.2" cy="16.4" r="3.5" />
  <path d="M5.8 16.4 9.8 8.6h3.4l5 7.8M9.8 8.6 8.3 6.4h2.9M13.2 8.6 9.8 16.4h3" />`;

const balon = html`<circle cx="12" cy="12" r="8.2" />
  <path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4Z" />
  <path d="M12 8.2V4.1M15.4 10.7l3.9-1.2M14.1 14.7l2.5 3.3M9.9 14.7l-2.5 3.3M8.6 10.7 4.7 9.5" />`;

const nota = html`<path d="M9.5 17.7V5.5l8.3-1.9v11.7" />
  <circle cx="7.2" cy="17.9" r="2.4" />
  <circle cx="15.5" cy="15.3" r="2.4" />`;

const libro = html`<path d="M12 6.6C10 5.1 7 4.6 4 5.1v13.2c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5.1c-3-.5-6 0-8 1.5Z" />
  <path d="M12 6.6v13.2" />`;

const reloj = html`<circle cx="12" cy="13" r="7.2" />
  <path d="M12 9.5V13l2.4 2.4" />
  <path d="M5.2 5.4 7.4 7.3M18.8 5.4 16.6 7.3" />`;

const flor = html`<circle cx="12" cy="9" r="2" />
  <circle cx="12" cy="5.4" r="1.7" /><circle cx="15.5" cy="8" r="1.7" /><circle cx="14.2" cy="12.1" r="1.7" />
  <circle cx="9.8" cy="12.1" r="1.7" /><circle cx="8.5" cy="8" r="1.7" />
  <path d="M12 14.6v5.4M12 17.4c1.9 0 3.1-1 3.5-2.7" />`;

const arbol = html`<path d="M12 3.5 6.8 11h2.6L5.5 17.2h13L14.6 11h2.6Z" />
  <path d="M12 17.2v4" />`;

const chupete = html`<circle cx="9.5" cy="9.5" r="5" />
  <circle cx="9.5" cy="9.5" r="1.8" />
  <path d="M13.2 13.2l2.6 2.6" />
  <circle cx="18" cy="18" r="1.8" />`;

const corazon = html`<path d="M12 20.3C7.4 16.9 3.5 13.4 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.9 4 2.3C12.9 5.9 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.8-3.9 7.3-8.5 10.7Z" />`;

const globo = html`<circle cx="12" cy="12" r="8.2" />
  <path d="M3.8 12h16.4M12 3.8c-2.4 2.2-3.8 5.2-3.8 8.2s1.4 6 3.8 8.2c2.4-2.2 3.8-5.2 3.8-8.2s-1.4-6-3.8-8.2Z" />`;

const pizza = html`<path d="M12 3.5 20 19.4c-5.3 1.6-12.7 1.6-18 0Z" />
  <circle cx="12" cy="10.2" r="1.1" /><circle cx="9" cy="14.6" r="1.1" /><circle cx="15" cy="14.6" r="1.1" />`;

const helado = html`<path d="M8 10.5a4 4 0 0 1 8 0Z" />
  <path d="M8 10.5h8l-3.4 9.5a.7.7 0 0 1-1.2 0Z" />
  <circle cx="12" cy="5.4" r="1.2" />`;

const tijeras = html`<circle cx="5.8" cy="6.3" r="2.4" />
  <circle cx="5.8" cy="17.7" r="2.4" />
  <path d="M8 8 20 20M8 16 20 4" />`;

const laptop = html`<rect x="4.5" y="5" width="15" height="10" rx="1.5" />
  <path d="M2.5 18.5h19" />`;

const bus = html`<path d="M4.5 6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9.5a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5Z" />
  <path d="M4.5 9.5h15" />
  <path d="M8 20v.01M16 20v.01" stroke-width="2.4" />`;

const vasoPopote = html`<path d="M6.5 8.5h11L16.2 20a1.9 1.9 0 0 1-1.9 1.7h-4.6A1.9 1.9 0 0 1 7.8 20Z" />
  <path d="M9.5 8.5 10 6.5h4l.5 2M13.5 6.5 15 2.8l2.8.7" />`;

const caramelo = html`<circle cx="12" cy="12" r="4.5" />
  <path d="M7.5 10 3 8.5v7L7.5 14M16.5 10 21 8.5v7L16.5 14" />`;

const wifi = html`<path d="M4 9.5a12.5 12.5 0 0 1 16 0M7 13a8.5 8.5 0 0 1 10 0M9.8 16.3a4.5 4.5 0 0 1 4.4 0" />
  <path d="M12 19.5v.01" stroke-width="2.4" />`;

const parqueo = html`<rect x="4" y="4" width="16" height="16" rx="3.5" />
  <path d="M9.5 16.5v-9h3a2.7 2.7 0 0 1 0 5.4h-3" />`;

/** Persona: cuentas de terceros y lo que le corresponde a otro. */
const persona = html`<circle cx="12" cy="8.1" r="3.2" />
  <path d="M5.9 19.6c.8-3.2 3.2-4.9 6.1-4.9s5.3 1.7 6.1 4.9" />`;

const CONTENIDO_CATEGORIA_PROPIA = {
  '🍔': hamburguesa, '🛒': carrito, '🍽️': cubiertos, '☕': tazaCafe,
  '🚗': coche,
  '🚙': cocheFrontal, '⛽': gasolina, '🛠️': llave,
  '🏠': CONTENIDO_CATEGORIA.hogar,
  '💡': CONTENIDO_CATEGORIA.servicios,
  '📱': telefono,
  '🎬': CONTENIDO_CATEGORIA.ocio,
  '👕': CONTENIDO_CATEGORIA.ropa,
  '👨‍👩‍👧': familia,
  '📚': birrete,
  '🏥': CONTENIDO_CATEGORIA.salud,
  '✈️': CONTENIDO_CATEGORIA.viajes,
  '🎁': CONTENIDO_CATEGORIA.regalos,
  '🐾': CONTENIDO_CATEGORIA.mascotas,
  '💳': CONTENIDO_CATEGORIA.dinero,
  '📦': caja,
  '💰': bolsaDinero,
  '💼': CONTENIDO_CATEGORIA.trabajo,
  '📈': CONTENIDO_CATEGORIA.crecimiento,
  // extensiones para categorías nuevas del usuario
  '🔑': llaveDePuerta,
  '🧾': recibo,
  '🛡️': escudo,
  '🏋️': mancuerna,
  '✂️': tijeras,
  '💻': laptop,
  '🚌': bus,
  '🥤': vasoPopote,
  '🍬': caramelo,
  '🍭': caramelo,
  '📶': wifi,
  '🅿️': parqueo,
  '🅿': parqueo,
  '🎫': ticket,
  // marcadores internos de "sin categoría" / terceros (model.js): también SVG
  '🤝': persona,
  '❓': CONTENIDO_CATEGORIA.tag,
  '🏷️': CONTENIDO_CATEGORIA.tag,
};
/** Claves peladas de selectores de variación: el lookup de IconoCat siempre
 *  pasa por aquí, así ningún emoji del historial del usuario se cuela crudo. */
const PROPIA_NORMALIZADA = {};
for (const [e, contenido] of Object.entries(CONTENIDO_CATEGORIA_PROPIA)) {
  PROPIA_NORMALIZADA[sinFv(e)] = contenido;
}

/** Versión exportada para pruebas: emojis de categorías con icono propio. */
export const CATEGORIAS_CON_ICONO = Object.keys(CONTENIDO_CATEGORIA_PROPIA);

/* ---------- Registro de iconos de categoría (por id) ----------
   Paleta para crear categorías propias: solo SVG, sin emojis. Repetir un
   icono en varias categorías está bien. */
export const ICONOS_CATEGORIA = {
  hamburguesa, carrito, cubiertos, cafe: tazaCafe, pizza, helado, vaso: vasoPopote, caramelo,
  coche, camioneta: cocheFrontal, gasolina, llave, bus, bici, parqueo, llavecasa: llaveDePuerta,
  hogar: CONTENIDO_CATEGORIA.hogar, bombilla: CONTENIDO_CATEGORIA.servicios, wifi, telefono, laptop,
  ocio: CONTENIDO_CATEGORIA.ocio, nota, balon, mancuerna, ropa: CONTENIDO_CATEGORIA.ropa,
  tijeras, corazon, salud: CONTENIDO_CATEGORIA.salud, bebe: chupete, familia,
  regalo: CONTENIDO_CATEGORIA.regalos, flor, arbol, mascotas: CONTENIDO_CATEGORIA.mascotas,
  birrete, libro, reloj, viajes: CONTENIDO_CATEGORIA.viajes, globo, bolsa: bolsaDinero,
  billete: CONTENIDO_CATEGORIA.dinero, trabajo: CONTENIDO_CATEGORIA.trabajo,
  crecimiento: CONTENIDO_CATEGORIA.crecimiento, escudo, recibo, caja, ticket,
  etiqueta: CONTENIDO_CATEGORIA.tag,
};

/** SVG de un icono de categoría por id del registro; null si no existe. */
export function IconoId({ id }) {
  const contenido = ICONOS_CATEGORIA[id];
  return contenido
    ? html`<svg class="icono-categoria" ...${trazo} viewBox="0 0 24 24">${contenido}</svg>`
    : null;
}

/** Icono de categoría para grillas y listas: icono propio por id (categorías
 *  nuevas); si no, el mapeado de su emoji (semillas o viejas personalizadas);
 *  lo desconocido cae en la etiqueta genérica — nunca en el emoji crudo. */
export function IconoCat({ icono, emoji }) {
  const e = sinFv(emoji);
  const contenido = (icono && ICONOS_CATEGORIA[icono])
    || PROPIA_NORMALIZADA[e]
    || CONTENIDO_CATEGORIA[EMOJI_A_GRUPO[e] || 'tag'];
  return html`<svg class="icono-categoria" ...${trazo} viewBox="0 0 24 24">${contenido}</svg>`;
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
  tercero: persona,
};

/** Icono de tipo de cuenta (efectivo, bancaria, ahorro, tarjeta, deuda). */
export function IconoCuenta({ tipo }) {
  const contenido = CONTENIDO_CUENTA[tipo];
  return contenido
    ? html`<svg class="icono-cuenta" ...${trazo} viewBox="0 0 24 24">${contenido}</svg>`
    : null;
}
