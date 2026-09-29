import { create } from 'zustand';

export type Panel = 'library' | 'graph' | 'text' | 'boards' | 'export' | null;
export type Popover = 'shapes' | 'more' | null;
export type View = 'editor' | 'library';

function readTabs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem('bt-tabs') ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface UIState {
  panel: Panel;
  popover: Popover;
  view: View;
  /** ids of the boards open as tabs, in order */
  tabs: string[];
  toast: string | null;
  setPanel: (p: Panel) => void;
  togglePanel: (p: Exclude<Panel, null>) => void;
  setPopover: (p: Popover) => void;
  togglePopover: (p: Exclude<Popover, null>) => void;
  setView: (v: View) => void;
  setTabs: (t: string[]) => void;
  showToast: (msg: string) => void;
}

let toastTimer: number | undefined;

export const useUI = create<UIState>((set, get) => ({
  panel: null,
  popover: null,
  view: 'editor',
  tabs: readTabs(),
  toast: null,
  setPanel: (panel) => set({ panel, popover: null }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p, popover: null }),
  setPopover: (popover) => set({ popover }),
  togglePopover: (p) => set({ popover: get().popover === p ? null : p }),
  setView: (view) => set({ view, panel: null, popover: null }),
  setTabs: (tabs) => {
    try {
      localStorage.setItem('bt-tabs', JSON.stringify(tabs));
    } catch {
      /* ignore */
    }
    set({ tabs });
  },
  showToast: (toast) => {
    set({ toast });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
}));
