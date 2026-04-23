type ROBox = { width: number; height: number };

function readBox(el: Element): ROBox {
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function ensureResizeObserver() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { ResizeObserver?: unknown };
  if (typeof w.ResizeObserver !== "undefined") return;

  class ResizeObserverPolyfill {
    private callback: (entries: Array<{ target: Element; contentRect: DOMRect }>) => void;
    private elements = new Map<Element, ROBox>();
    private timer: number | null = null;

    constructor(callback: (entries: Array<{ target: Element; contentRect: DOMRect }>) => void) {
      this.callback = callback;
    }

    observe = (target: Element) => {
      if (!target) return;
      this.elements.set(target, readBox(target));
      this.start();
      this.emit(target);
    };

    unobserve = (target: Element) => {
      this.elements.delete(target);
      if (this.elements.size === 0) this.stop();
    };

    disconnect = () => {
      this.elements.clear();
      this.stop();
    };

    private start() {
      if (this.timer !== null) return;
      this.timer = window.setInterval(() => this.tick(), 200);
    }

    private stop() {
      if (this.timer === null) return;
      window.clearInterval(this.timer);
      this.timer = null;
    }

    private tick() {
      const changed: Element[] = [];
      for (const [el, prev] of this.elements.entries()) {
        const next = readBox(el);
        if (next.width !== prev.width || next.height !== prev.height) {
          this.elements.set(el, next);
          changed.push(el);
        }
      }
      for (const el of changed) this.emit(el);
    }

    private emit(target: Element) {
      const rect = target.getBoundingClientRect();
      this.callback([{ target, contentRect: rect }]);
    }
  }

  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;
}

