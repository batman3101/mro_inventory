import { tokensCss } from './tokens';

// What index.html carries so the very first paint is already in the right theme,
// before the app's JavaScript has arrived. vite.config.ts puts both pieces into
// <head>; nothing here is written by hand in index.html, so the design values
// stay in tokens.ts only. Relative import on purpose: vite.config.ts loads this
// file outside the app's "@/…" alias.

/** localStorage key of the saved choice (zustand persist: {"state":{"mode":…},"version":0}). */
export const THEME_STORAGE_KEY = 'mro-theme-storage';

/** The design values as CSS variables, and the page ground. */
export const bootCss = (): string => `${tokensCss()}\nhtml{background:var(--ground)}`;

/**
 * Sets <html data-theme> from the saved choice, else from the PC setting.
 * Same rule as resolveTheme() in store/theme.store.ts: only 'light' and 'dark'
 * are taken as a choice; anything else (nothing saved, 'system', a damaged
 * value, storage not readable) follows the PC.
 */
export const bootScript = (): string =>
  `(function(){var m;try{m=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})).state.mode}catch(e){}` +
  `var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);` +
  `document.documentElement.setAttribute('data-theme',d?'dark':'light')})()`;
