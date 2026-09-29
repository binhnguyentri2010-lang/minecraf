import { useState } from 'react';
import { exportPng } from '../canvas/render';
import { useBoard } from '../canvas/store';
import { downloadBlob, exportPdf, itemsToSvg, safeName, shareBlob } from '../storage/export';
import { loadSnapshot } from '../storage/persist';
import { Icons } from './icons';
import { useUI } from './uiStore';

export function ExportPanel() {
  const setPanel = useUI((s) => s.setPanel);
  const toast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      toast(`Đã xuất ${label}`);
    } catch {
      toast(`Không xuất được ${label}`);
    } finally {
      setBusy(false);
    }
  };
  const cur = () => {
    const s = useBoard.getState();
    return { items: s.items, bg: s.background, name: safeName(s.boards.find((b) => b.id === s.boardId)?.name ?? 'bang-toan') };
  };
  const png = async (share: boolean) => {
    const { items, bg, name } = cur();
    const blob = await exportPng(items, bg);
    if (!blob) throw new Error('png');
    if (share && (await shareBlob(blob, `${name}.png`))) return;
    downloadBlob(blob, `${name}.png`);
  };
  return (
    <aside className="panel glass compact" aria-label="Xuất" data-testid="export-panel">
      <header>
        <h2>Xuất bảng</h2>
        <button onClick={() => setPanel(null)} aria-label="Đóng">{Icons.close}</button>
      </header>
      <div className="list">
        <button disabled={busy} onClick={() => run('PNG', () => png(false))} data-testid="export-png">Ảnh PNG</button>
        <button
          disabled={busy}
          onClick={() =>
            run('SVG', async () => {
              const { items, bg, name } = cur();
              downloadBlob(new Blob([itemsToSvg(items, bg)], { type: 'image/svg+xml' }), `${name}.svg`);
            })
          }
          data-testid="export-svg"
        >
          Ảnh vector SVG
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run('PDF', async () => {
              const { items, bg, name } = cur();
              downloadBlob(await exportPdf([{ items, background: bg }]), `${name}.pdf`);
            })
          }
          data-testid="export-pdf"
        >
          PDF (bảng này)
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run('PDF', async () => {
              const st = useBoard.getState();
              const pages = [];
              for (const b of st.boards) {
                const snap = await loadSnapshot(b.id);
                if (snap) pages.push({ items: snap.items, background: snap.background });
              }
              downloadBlob(await exportPdf(pages), 'tat-ca-bang.pdf');
            })
          }
          data-testid="export-pdf-all"
        >
          PDF (tất cả các bảng)
        </button>
        {canShare && (
          <button disabled={busy} onClick={() => run('ảnh', () => png(true))} data-testid="export-share">
            Chia sẻ ảnh…
          </button>
        )}
      </div>
    </aside>
  );
}
