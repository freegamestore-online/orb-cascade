import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApp } from "./test/fakeApp";

const fake = vi.hoisted(() => ({ step: (_ms: number) => {} }));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  return {
    ...pixi,
    Application: function Application() {
      const { app, step } = fakeApp();
      fake.step = step;
      return app;
    },
  };
});
const { default: App } = await import("./App");

const run = (ms: number) =>
  act(() => {
    fake.step(ms);
  });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("clears 'New Best' when a game is restarted with Space", async () => {
    const random = vi.spyOn(Math, "random");
    render(<App />);
    await act(async () => {}); // let the async Pixi init finish

    // Game 1: catch some orbs (new best), then miss three.
    fireEvent.click(screen.getByText("Play"));
    random.mockReturnValue(0.5);
    run(8000);
    random.mockReturnValue(0);
    run(20_000);
    expect(screen.getByText("✨ New Best Score!")).toBeTruthy();

    // Game 2, started from the keyboard: three straight misses, score 0.
    fireEvent.keyDown(window, { key: " " });
    run(20_000);
    expect(screen.getByText("Game Over")).toBeTruthy();
    expect(screen.queryByText("✨ New Best Score!")).toBeNull();
  }, 30_000);
});
