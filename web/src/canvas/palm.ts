/**
 * Palm rejection. While the pen is touching, hovering or was active a moment ago, every touch contact is ignored
 * for its whole life (no draw, no pan, no zoom, no tap gestures). Contacts already on the glass when the pen lands
 * (a resting palm) are dropped too.
 */
export const PALM_WINDOW_MS = 500;

export class PalmGuard {
  private pens = new Set<number>();
  private lastPen = -Infinity;
  private ignored = new Set<number>();
  private touches = new Set<number>();

  constructor(private now: () => number = () => performance.now()) {}

  /** Report a pen event. Returns the touch ids that must be dropped because the pen has just landed. */
  pen(kind: 'down' | 'move' | 'hover' | 'up', id: number): number[] {
    this.lastPen = this.now();
    if (kind === 'up') this.pens.delete(id);
    if (kind !== 'down') return [];
    this.pens.add(id);
    const dropped = [...this.touches];
    for (const t of dropped) this.ignored.add(t);
    this.touches.clear();
    return dropped;
  }

  get penActive(): boolean {
    return this.pens.size > 0 || this.now() - this.lastPen < PALM_WINDOW_MS;
  }

  /** true when the touch should be handled; false when it is palm/finger noise around the pen */
  touchDown(id: number): boolean {
    if (this.penActive) {
      this.ignored.add(id);
      return false;
    }
    this.touches.add(id);
    return true;
  }

  isIgnored(id: number): boolean {
    return this.ignored.has(id);
  }

  touchEnd(id: number) {
    this.touches.delete(id);
    this.ignored.delete(id);
  }
}
