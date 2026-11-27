// Design values, kept in this one file. They follow ALMUS WorkBoard
// (apps/web/src/styles/prototype.css :root + the WCAG AA corrections in app.css).
// Everything else reads them from here: the CSS variables (app.css uses var(--…)),
// the Ant Design theme (antdTheme.ts) and the charts (components/chartTheme.ts).
// No imports on purpose: scripts/check-contrast.mjs loads this file with plain Node.

export interface Palette {
  /** page ground behind the work surface */
  ground: string;
  surface: string;
  surface2: string;
  surface3: string;
  hover: string;
  line: string;
  line2: string;
  /** form control borders (3:1 against the surface) */
  lineInput: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentHover: string;
  accentWeak: string;
  /** text on an accent fill */
  accentInk: string;
  danger: string;
  dangerWeak: string;
  /** text on a danger fill */
  dangerInk: string;
  ok: string;
  okWeak: string;
  warn: string;
  warnWeak: string;
  /** selected row / text selection */
  sel: string;
  focus: string;
  /** brand colour where it stands as text or a mark on the surface */
  brandInk: string;
  /** tooltip ground and its text */
  tip: string;
  tipInk: string;
  shadowPop: string;
  scrim: string;
  viz1: string;
  viz2: string;
  viz3: string;
  viz4: string;
  vizGrid: string;
  vizAxis: string;
}

export const light: Palette = {
  ground: '#E9EDF2',
  surface: '#FFFFFF',
  surface2: '#F5F7FA',
  surface3: '#EBEEF3',
  hover: '#F0F3F7',
  line: '#E0E4EA',
  line2: '#C9D0DA',
  lineInput: '#858E9E',
  ink: '#1C2230',
  ink2: '#525B6C',
  ink3: '#636B7B',
  accent: '#1F5BD1',
  accentHover: '#1649AE',
  accentWeak: '#E6EDFB',
  accentInk: '#FFFFFF',
  danger: '#B42A37',
  dangerWeak: '#FBE8EA',
  dangerInk: '#FFFFFF',
  ok: '#147A4A',
  okWeak: '#E3F4EB',
  warn: '#9C5B07',
  warnWeak: '#FCF1E0',
  sel: '#DCE7FC',
  focus: '#3C78EE',
  brandInk: '#1F3D7C',
  tip: '#1C2230',
  tipInk: '#FFFFFF',
  shadowPop: '0 8px 28px rgba(18,26,43,.16),0 1px 3px rgba(18,26,43,.10)',
  scrim: 'rgba(17,22,33,.42)',
  viz1: '#2A78D6',
  viz2: '#EB6834',
  viz3: '#1BAF7A',
  viz4: '#EDA100',
  vizGrid: '#E6E9EE',
  vizAxis: '#C9D0DA',
};

export const dark: Palette = {
  ground: '#0E1115',
  surface: '#171B21',
  surface2: '#1C2128',
  surface3: '#242A33',
  hover: '#20262E',
  line: '#2A303A',
  line2: '#3A424F',
  lineInput: '#66707F',
  ink: '#E3E7ED',
  ink2: '#A8B0BE',
  ink3: '#8A94A5',
  accent: '#6D9BF2',
  accentHover: '#8DB2F6',
  accentWeak: '#1B2842',
  accentInk: '#0D1016',
  danger: '#EE6B7A',
  dangerWeak: '#3A1D22',
  dangerInk: '#0D1016',
  ok: '#35B97A',
  okWeak: '#16301F',
  warn: '#E9A23E',
  warnWeak: '#35270F',
  sel: '#1E2D4A',
  focus: '#6D9BF2',
  brandInk: '#E3E7ED',
  tip: '#2F3743',
  tipInk: '#FFFFFF',
  shadowPop: '0 10px 30px rgba(0,0,0,.5),0 1px 3px rgba(0,0,0,.4)',
  scrim: 'rgba(0,0,0,.55)',
  viz1: '#3987E5',
  viz2: '#D95926',
  viz3: '#199E70',
  viz4: '#C98500',
  vizGrid: '#262C35',
  vizAxis: '#3A424F',
};

export type ThemeName = 'light' | 'dark';

export const palettes: Record<ThemeName, Palette> = { light, dark };

/** Sizes shared by both themes (px). */
export const shape = {
  radius: 6,
  radiusSmall: 4,
  radiusTag: 3,
  radiusLarge: 8,
  row: 36,
  top: 48,
  side: 256,
  control: 32,
  controlSmall: 28,
  controlLarge: 40,
} as const;

export const fontFamily =
  '"Inter","Noto Sans KR","Segoe UI","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

const kebab = (name: string) => name.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

const paletteVars = (p: Palette) =>
  Object.entries(p)
    .map(([name, value]) => `--${kebab(name)}:${value}`)
    .join(';');

/** The stylesheet that hands the values to CSS: light on :root, dark on :root[data-theme="dark"]. */
export function tokensCss(): string {
  const sizes = Object.entries(shape)
    .map(([name, value]) => `--${kebab(name)}:${value}px`)
    .join(';');
  return [
    `:root{${paletteVars(light)};${sizes};--font:${fontFamily};color-scheme:light}`,
    `:root[data-theme="dark"]{${paletteVars(dark)};color-scheme:dark}`,
  ].join('\n');
}
