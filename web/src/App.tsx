import { useEffect } from 'react';
import { Board } from './canvas/Board';
import { BoardsPanel } from './ui/BoardsPanel';
import { Dock } from './ui/Dock';
import { GraphDialog, TextDialog } from './ui/Dialogs';
import { ExportPanel } from './ui/ExportPanel';
import { Inspector } from './ui/Inspector';
import { Library } from './ui/Library';
import { SelectionMenu } from './ui/SelectionMenu';
import { TopBar } from './ui/TopBar';
import { useUI } from './ui/uiStore';

export function App() {
  const panel = useUI((s) => s.panel);
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    document.body.classList.toggle('panel-open', panel !== null);
  }, [panel]);
  return (
    <>
      <Board />
      <TopBar />
      <Inspector />
      <SelectionMenu />
      <Dock />
      {panel === 'library' && <Library />}
      {panel === 'boards' && <BoardsPanel />}
      {panel === 'export' && <ExportPanel />}
      {panel === 'graph' && <GraphDialog />}
      {panel === 'text' && <TextDialog />}
      {toast && <div className="toast glass" role="status">{toast}</div>}
    </>
  );
}
