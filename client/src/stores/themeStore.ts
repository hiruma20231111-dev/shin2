import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: 'hub-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

// Apply theme immediately on module load (before React mounts)
applyTheme(useThemeStore.getState().theme);
