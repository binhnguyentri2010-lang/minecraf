import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { itemBounds } from './canvas/objects';
import { selectionGeo } from './canvas/overlay';
import { useBoard } from './canvas/store';
import { insertShape } from './shapes/insert';
import { SHAPES, buildShapeObj, defaultParams } from './shapes/registry';
import { autosave, restore } from './storage/persist';
import './styles.css';

if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__board = useBoard;
  w.__app = { useBoard, insertShape, SHAPES, buildShapeObj, defaultParams, itemBounds, selectionGeo };
}

function mount() {
  autosave();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// a storage problem must never leave a blank page: start with an empty board instead
restore().catch(() => {}).finally(mount);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
