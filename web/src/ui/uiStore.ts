import { create } from 'zustand';

export type Panel = 'library' | 'graph' | 'text' | 'boards' | 'export' | null;

interface UIState {
  panel: Panel;
  toast: string | null;
  setPanel: (p: Panel) => void;
  togglePanel: (p: Exclude<Panel, null>) => void;
  showToast: (msg: string) => void;
}

let toastTimer: number | undefined;

export const useUI = create<UIState>((set, get) => ({
  panel: null,
  toast: null,
  setPanel: (panel) => set({ panel }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p }),
  showToast: (toast) => {
    set({ toast });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
}));
