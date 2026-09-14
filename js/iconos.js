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
};

/** Icono de tipo de cuenta (efectivo, bancaria, ahorro, tarjeta, deuda). */
export function IconoCuenta({ tipo }) {
  const contenido = CONTENIDO_CUENTA[tipo];
  return contenido
    ? html`<svg class="icono-cuenta" ...${trazo} viewBox="0 0 24 24">${contenido}</svg>`
    : null;
}
