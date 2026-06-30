/**
 * Revploy design tokens.
 *
 * These mirror the CSS custom properties declared in `src/index.css` and the
 * Tailwind theme in `tailwind.config.ts`. Use them when you need design values
 * in TypeScript (e.g. charts, canvas, inline styles) rather than utility
 * classes. The CSS variables remain the single source of truth at runtime.
 */

export const colors = {
  navy: '#0d1f3c',
  navyLight: '#1a3254',
  gold: '#f5a623',
  goldLight: '#fdf0d5',
  white: '#ffffff',
  gray50: '#f4f6f9',
  gray100: '#e8ecf2',
  gray400: '#9aa3b2',
  gray700: '#374151',
  gray900: '#111827',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  muted: '#9aa3b2',
} as const

export const fonts = {
  sans: "'DM Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const

/** Names of the CSS custom properties, for `var(--color-...)` lookups. */
export const cssVars = {
  navy: '--color-navy',
  navyLight: '--color-navy-light',
  gold: '--color-gold',
  goldLight: '--color-gold-light',
  white: '--color-white',
  gray50: '--color-gray-50',
  gray100: '--color-gray-100',
  gray400: '--color-gray-400',
  gray700: '--color-gray-700',
  gray900: '--color-gray-900',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
  info: '--color-info',
  muted: '--color-muted',
  fontSans: '--font-sans',
  fontMono: '--font-mono',
} as const

export const tokens = {
  colors,
  fonts,
  cssVars,
} as const

export type ColorToken = keyof typeof colors
