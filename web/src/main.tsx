import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useBoard } from './canvas/store';
import { autosave, restore } from './storage/persist';
import './styles.css';

if (import.meta.env.DEV) (window as unknown as { __board: typeof useBoard }).__board = useBoard;

restore().then(() => {
  autosave();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
