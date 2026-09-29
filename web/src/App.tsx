import { useEffect } from 'react';
import { Board } from './canvas/Board';
import { BoardsPanel } from './ui/BoardsPanel';
import { GraphDialog, TextDialog } from './ui/Dialogs';
import { ExportPanel } from './ui/ExportPanel';
import { Inspector } from './ui/Inspector';
import { Library } from './ui/Library';
import { SelectionMenu } from './ui/SelectionMenu';
import { FloatBar } from './ui/FloatBar';
import { Header } from './ui/Header';
import { LibraryScreen } from './ui/LibraryScreen';
import { Pills } from './ui/Pills';
import { useUI } from './ui/uiStore';

export function App() {
  const panel = useUI((s) => s.panel);
  const toast = useUI((s) => s.toast);
  const view = useUI((s) => s.view);
  const popover = useUI((s) => s.popover);
  useEffect(() => {
    document.body.classList.toggle('panel-open', panel !== null);
  }, [panel]);
  return (
    <>
      <Board />
      <Header />
      <FloatBar />
      <Pills />
      <Inspector />
      <SelectionMenu />
      {popover && <div className="scrim" onPointerDown={() => useUI.getState().setPopover(null)} />}
      {panel === 'library' && <Library />}
      {panel === 'boards' && <BoardsPanel />}
      {panel === 'export' && <ExportPanel />}
      {panel === 'graph' && <GraphDialog />}
      {panel === 'text' && <TextDialog />}
      {view === 'library' && <LibraryScreen />}
      {toast && <div className="toast glass" role="status">{toast}</div>}
    </>
  );
}
