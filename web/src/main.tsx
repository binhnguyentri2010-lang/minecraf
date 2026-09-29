import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { itemBounds } from './canvas/objects';
import { selectionGeo } from './canvas/overlay';
import { useBoard } from './canvas/store';
import { insertShape } from './shapes/insert';
import { SHAPES, buildShapeObj, defaultParams } from './shapes/registry';
import { autosave, restore } from './storage/persist';
import { syncTabs } from './ui/tabs';
import { useUI } from './ui/uiStore';
import './styles.css';

if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  const w = window as unknown as Record<string, unknown>;
  w.__board = useBoard;
  w.__ui = useUI;
  w.__app = { useBoard, insertShape, SHAPES, buildShapeObj, defaultParams, itemBounds, selectionGeo };
}

// Show the interface immediately; the saved board is read from storage in the background and drawn when it arrives.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
requestAnimationFrame(() => document.getElementById('boot')?.remove());

// a storage problem must never leave a blank page: keep the empty board
restore().catch(() => {}).finally(() => {
  autosave();
  syncTabs();
  useBoard.subscribe((s, p) => (s.boards !== p.boards || s.boardId !== p.boardId) && syncTabs());
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
