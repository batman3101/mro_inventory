#!/usr/bin/env node
/**
 * WCAG contrast check of the design values in src/styles/tokens.ts.
 * Text pairs must reach 4.5:1 (AA, body text); control borders 3:1 (WCAG 1.4.11).
 * Exit 0 when every pair passes, 1 otherwise. Chart colours are printed for information.
 * Needs Node 22.18+ (it loads the .ts file directly).
 */
import { palettes } from '../src/styles/tokens.ts';

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text, ground, where it is used]
const TEXT_PAIRS = [
  ['ink', 'surface', 'body text'],
  ['ink', 'surface2', 'text on a table header / hover'],
  ['ink', 'surface3', 'neutral tag'],
  ['ink', 'ground', 'text on the page ground'],
  ['ink', 'hover', 'hovered row / menu'],
  ['ink', 'dangerWeak', 'low-stock row'],
  ['ink', 'sel', 'selected row'],
  ['ink2', 'surface', 'secondary text, labels'],
  ['ink2', 'surface2', 'table header text'],
  ['ink2', 'ground', 'secondary text on the ground'],
  ['ink2', 'hover', 'menu icon on hover'],
  ['ink3', 'surface', 'quiet text, placeholder'],
  ['ink3', 'surface2', 'quiet text on a header'],
  ['accent', 'surface', 'link, chosen value'],
  ['accent', 'accentWeak', 'chosen menu / segment / tag'],
  ['accent', 'dangerWeak', 'link button in a low-stock row'],
  ['accent', 'hover', 'link button in a hovered row'],
  ['accentInk', 'accent', 'primary button'],
  ['accentInk', 'accentHover', 'primary button, hover'],
  ['ok', 'surface', 'good state text'],
  ['ok', 'okWeak', 'good state tag / alert'],
  ['warn', 'surface', 'warning text'],
  ['warn', 'warnWeak', 'warning tag / alert'],
  ['danger', 'surface', 'danger text'],
  ['danger', 'dangerWeak', 'danger tag / low-stock number'],
  ['danger', 'hover', 'delete button in a hovered row'],
  ['dangerInk', 'danger', 'danger button'],
  ['brandInk', 'surface', 'sign-in title and wordmark'],
  ['tipInk', 'tip', 'tooltip'],
];
const UI_PAIRS = [
  ['lineInput', 'surface', 'input border'],
  ['accent', 'surface', 'focus / chosen border'],
  ['focus', 'surface', 'focus outline'],
  ['focus', 'ground', 'focus outline on the ground'],
];
const CHART = ['viz1', 'viz2', 'viz3', 'viz4'];

let failed = 0;
for (const [name, p] of Object.entries(palettes)) {
  console.log(`\n== ${name}`);
  for (const [pairs, min, kind] of [[TEXT_PAIRS, 4.5, 'text'], [UI_PAIRS, 3, 'ui']]) {
    for (const [fg, bg, where] of pairs) {
      const r = ratio(p[fg], p[bg]);
      const ok = r >= min;
      if (!ok) failed += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(5)} (>= ${min}) ${kind.padEnd(4)} ${fg} on ${bg} — ${where}`);
    }
  }
  for (const v of CHART) {
    console.log(`info ${ratio(p[v], p.surface).toFixed(2).padStart(5)} chart ${v} on surface (lines and bars; WorkBoard's chart colours, not text)`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below the WCAG AA minimum`);
  process.exit(1);
}
console.log('\nAll text and control pairs meet WCAG AA');
