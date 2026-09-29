import { useBoard } from '../canvas/store';
import { deleteBoard, leaveEditor, newBoard, openBoard } from '../storage/persist';
import { useUI } from './uiStore';

/** Keep the tab strip consistent with the boards that exist and the board that is open. */
export function syncTabs() {
  const { boards, boardId } = useBoard.getState();
  if (!boardId) return;
  const ui = useUI.getState();
  const ids = new Set(boards.map((b) => b.id));
  let tabs = ui.tabs.filter((t) => ids.has(t));
  // the open board always has a tab while editing; in the library an empty strip is allowed
  if (ui.view === 'editor' && !tabs.includes(boardId)) tabs = [...tabs, boardId];
  if (tabs.length !== ui.tabs.length || tabs.some((t, i) => t !== ui.tabs[i])) ui.setTabs(tabs);
}

export async function openInTab(id: string) {
  useUI.getState().setView('editor');
  await openBoard(id);
  syncTabs();
}

export async function addBoard() {
  useUI.getState().setView('editor');
  await newBoard();
  syncTabs();
}

export async function closeTab(id: string) {
  const ui = useUI.getState();
  const { boardId } = useBoard.getState();
  const i = ui.tabs.indexOf(id);
  const rest = ui.tabs.filter((t) => t !== id);
  if (id === boardId) {
    // switch first, drop the tab afterwards: otherwise the sync after the switch would re-add it
    const next = rest[Math.min(i, rest.length - 1)];
    if (next) await openBoard(next);
    else await showLibrary();
  }
  useUI.getState().setTabs(rest);
}

export async function showLibrary() {
  await leaveEditor();
  useUI.getState().setView('library');
}

export async function removeBoard(id: string) {
  const ui = useUI.getState();
  ui.setTabs(ui.tabs.filter((t) => t !== id));
  await deleteBoard(id);
  syncTabs();
}
