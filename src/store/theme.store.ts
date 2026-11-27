import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeName } from '@/styles/tokens';
import { THEME_STORAGE_KEY } from '@/styles/themeBoot';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

interface ThemeState {
  /** What the user chose. 'system' follows the PC setting. */
  mode: ThemeMode;
  /** The PC setting (prefers-color-scheme), kept current. */
  systemDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      systemDark: systemQuery.matches,
      setMode: (mode: ThemeMode) => {
        set({ mode });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (state) => ({ mode: state.mode }),
      // The saved value is not trusted (the type says nothing about what is in
      // localStorage): anything but the three choices becomes 'system'. A
      // damaged value used to reach the antd theme and leave the whole app,
      // sign-in included, blank.
      merge: (persisted, current) => {
        const saved = (persisted as { mode?: unknown } | null | undefined)?.mode;
        return {
          ...current,
          mode: THEME_MODES.includes(saved as ThemeMode) ? (saved as ThemeMode) : 'system',
        };
      },
    }
  )
);

// Only 'light' and 'dark' are a choice; everything else follows the PC.
// (index.html applies the same rule before the app loads: styles/themeBoot.ts)
export const resolveTheme = (state: Pick<ThemeState, 'mode' | 'systemDark'>): ThemeName =>
  state.mode === 'light' || state.mode === 'dark' ? state.mode : state.systemDark ? 'dark' : 'light';

/** The theme on screen right now. */
export const useResolvedTheme = (): ThemeName => useThemeStore(resolveTheme);

// <html data-theme> picks the set of CSS variables (they are already in
// index.html, see vite.config.ts). Kept in step with the store from here on.
const applyTheme = (state: ThemeState) => {
  document.documentElement.setAttribute('data-theme', resolveTheme(state));
};
applyTheme(useThemeStore.getState());
useThemeStore.subscribe(applyTheme);

systemQuery.addEventListener('change', (event) => {
  useThemeStore.setState({ systemDark: event.matches });
});
