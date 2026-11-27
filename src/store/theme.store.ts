import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tokensCss, type ThemeName } from '@/styles/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

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
      name: 'mro-theme-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

export const resolveTheme = (state: Pick<ThemeState, 'mode' | 'systemDark'>): ThemeName =>
  state.mode === 'system' ? (state.systemDark ? 'dark' : 'light') : state.mode;

/** The theme on screen right now. */
export const useResolvedTheme = (): ThemeName => useThemeStore(resolveTheme);

// The design values reach CSS as variables; <html data-theme> picks the set.
// Done here, before the first render, so nothing paints in the wrong theme.
const style = document.createElement('style');
style.setAttribute('data-app-tokens', '');
style.textContent = tokensCss();
document.head.appendChild(style);

const applyTheme = (state: ThemeState) => {
  document.documentElement.setAttribute('data-theme', resolveTheme(state));
};
applyTheme(useThemeStore.getState());
useThemeStore.subscribe(applyTheme);

systemQuery.addEventListener('change', (event) => {
  useThemeStore.setState({ systemDark: event.matches });
});
