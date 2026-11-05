import { Container, type Application, type Ticker } from "pixi.js";

/**
 * Just enough of a Pixi Application to drive OrbCascadeGame without WebGL:
 * a real stage, a fixed screen, and a ticker the test steps by hand.
 */
export function fakeApp(width = 360, height = 600) {
  const tickers: ((t: Ticker) => void)[] = [];
  const app = {
    stage: new Container(),
    screen: { x: 0, y: 0, width, height },
    canvas: document.createElement("canvas"),
    renderer: { on() {}, off() {} },
    ticker: {
      add: (fn: (t: Ticker) => void) => tickers.push(fn),
      remove: (fn: (t: Ticker) => void) => tickers.splice(tickers.indexOf(fn), 1),
    },
    init: async () => {},
    destroy() {},
  };
  /** Advance the game by `ms` in 50ms steps. */
  const step = (ms: number) => {
    for (let t = 0; t < ms; t += 50) for (const fn of [...tickers]) fn({ deltaMS: 50 } as Ticker);
  };
  return { app: app as unknown as Application, step };
}
