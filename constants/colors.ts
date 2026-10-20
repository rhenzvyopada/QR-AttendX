/**
 * QR AttendX palette — Cream / Charcoal / Vermilion design system.
 *
 * - #F6F7EB family (Cream): surfaces and light text on dark surfaces
 * - #393E41 family (Charcoal): text, borders, dark surfaces
 * - #E94F37 family (Vermilion): accents, focus, CTAs (shade #C63E2A for
 *   small text/icon usage where the bright hue would fail WCAG AA)
 *
 * Translucent values are alpha variants of the same three hues.
 */
export const COLORS = {
  background: '#EFEFE3',
  primary: '#393E41',
  accent: 'rgba(233, 79, 55, 0.12)',

  card: '#F6F7EB',
  elevated: '#FAFBF2',
  surface: '#EDEDE1',
  muted: '#EDEDE1',
  border: 'rgba(57, 62, 65, 0.18)',
  shadow: '#393E41',

  textPrimary: '#393E41',
  textSecondary: '#5F6365',
  textOnPrimary: '#F6F7EB',

  primaryInk: '#393E41',
  primaryDark: '#393E41',
  primarySoft: 'rgba(57, 62, 65, 0.08)',
  onPrimarySoft: '#F6F7EB',
  onPrimaryMuted: 'rgba(246, 247, 235, 0.70)',

  success: '#393E41',
  successLight: 'rgba(57, 62, 65, 0.08)',
  warning: '#5F6365',
  danger: '#C63E2A',
} as const;
