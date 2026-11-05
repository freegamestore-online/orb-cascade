import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrbCascadeGame, type GameCallbacks } from "./game";
import { fakeApp } from "../test/fakeApp";

function setup() {
  const { app, step } = fakeApp();
  const cb = {
    onPhaseChange: vi.fn(), onScoreChange: vi.fn(), onLivesChange: vi.fn(),
    onHighScore: vi.fn(), onCatch: vi.fn(), onMiss: vi.fn(),
  } satisfies GameCallbacks;
  const game = new OrbCascadeGame(app, cb);
  return { game, cb, step };
}

const key = (type: "keydown" | "keyup", k: string) => window.dispatchEvent(new KeyboardEvent(type, { key: k }));

let random: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  random = vi.spyOn(Math, "random");
});
afterEach(() => vi.restoreAllMocks());

describe("OrbCascadeGame", () => {
  it("scores a caught orb and ends after three misses", () => {
    const { game, cb, step } = setup();
    random.mockReturnValue(0.5); // orbs fall onto the centred basket
    game.startGame();
    step(8000);
    expect(cb.onCatch).toHaveBeenCalled();
    expect(cb.onScoreChange).toHaveBeenLastCalledWith(expect.any(Number));

    random.mockReturnValue(0); // orbs fall at the far left edge
    step(20_000);
    expect(cb.onMiss).toHaveBeenCalledTimes(3);
    expect(cb.onPhaseChange).toHaveBeenLastCalledWith("over");
    expect(cb.onHighScore).toHaveBeenCalledTimes(1);
    game.destroy();
  });

  it("keeps running through a combo (catches in a row)", () => {
    const { game, cb, step } = setup();
    random.mockReturnValue(0.5);
    game.startGame();
    expect(() => step(15_000)).not.toThrow();
    expect(cb.onCatch.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(cb.onMiss).not.toHaveBeenCalled();
    game.destroy();
  });

  it("restarts with Space after game over", () => {
    const { game, cb, step } = setup();
    random.mockReturnValue(0);
    game.startGame();
    step(20_000);
    expect(cb.onPhaseChange).toHaveBeenLastCalledWith("over");
    key("keydown", " ");
    expect(cb.onPhaseChange).toHaveBeenLastCalledWith("playing");
    game.destroy();
  });

  it("stops sliding the basket when the window loses focus", () => {
    const { game, step } = setup();
    random.mockReturnValue(0.5);
    game.startGame();
    const basket = () => (game as unknown as { basketX: number }).basketX;
    key("keydown", "ArrowLeft");
    step(200); // 480px/s for 0.2s: target 180 -> 84
    window.dispatchEvent(new Event("blur"));
    step(1000);
    // Without the blur reset it would keep sliding to the left wall (x = 45).
    expect(basket()).toBeCloseTo(84, 0);
    game.destroy();
  });

  it("removes its window listeners on destroy", () => {
    const { game, cb } = setup();
    game.destroy();
    key("keydown", "Enter");
    expect(cb.onPhaseChange).not.toHaveBeenCalledWith("playing");
  });
});
