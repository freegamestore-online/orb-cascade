import { useEffect, useRef, useState, useCallback } from "react";
import { Application } from "pixi.js";
import { Shell } from "./components/Shell";
import { OrbCascadeGame, Phase } from "./lib/game";

const MAX_LIVES = 3;

function Heart({ filled }: { filled: boolean }) {
  return (
    <span
      className="text-2xl leading-none select-none"
      style={{
        filter: filled
          ? "drop-shadow(0 0 6px #ff4dff)"
          : "none",
        opacity: filled ? 1 : 0.25,
      }}
    >
      ♥
    </span>
  );
}

function HudBar({
  score,
  lives,
  combo,
  highScore,
}: {
  score: number;
  lives: number;
  combo: number;
  highScore: number;
}) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 z-10 pointer-events-none"
      style={{
        background: "linear-gradient(to bottom, rgba(5,10,25,0.85) 0%, transparent 100%)",
      }}
    >
      {/* Lives */}
      <div className="flex gap-1">
        {Array.from({ length: MAX_LIVES }).map((_, i) => (
          <Heart key={i} filled={i < lives} />
        ))}
      </div>

      {/* Score + Combo */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-xl font-bold tabular-nums"
          style={{
            fontFamily: "Fraunces, serif",
            color: "#00ffff",
            textShadow: "0 0 12px #00ffff, 0 0 24px #00ffff88",
          }}
        >
          {score.toLocaleString()}
        </span>
        {combo >= 2 && (
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{
              fontFamily: "Manrope, sans-serif",
              color: "#ff4dff",
              textShadow: "0 0 8px #ff4dff",
              animation: "pulse 0.4s ease-in-out infinite alternate",
            }}
          >
            ×{combo} combo!
          </span>
        )}
      </div>

      {/* High score */}
      <div className="flex flex-col items-end">
        <span
          className="text-xs uppercase tracking-widest"
          style={{ fontFamily: "Manrope, sans-serif", color: "#4d88ff88" }}
        >
          best
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{
            fontFamily: "Fraunces, serif",
            color: "#4d88ff",
            textShadow: "0 0 8px #4d88ff88",
          }}
        >
          {highScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20 pointer-events-none"
      style={{ background: "rgba(5,10,25,0.72)" }}
    >
      <div className="flex flex-col items-center gap-2">
        <h1
          className="text-5xl md:text-6xl font-bold tracking-tight"
          style={{
            fontFamily: "Fraunces, serif",
            color: "#00ffff",
            textShadow: "0 0 20px #00ffff, 0 0 50px #00ffff88, 0 0 80px #00ffff44",
          }}
        >
          Orb Cascade
        </h1>
        <p
          className="text-base md:text-lg"
          style={{
            fontFamily: "Manrope, sans-serif",
            color: "#ff4dff",
            textShadow: "0 0 10px #ff4dff88",
          }}
        >
          Catch the falling orbs. Don't miss 3.
        </p>
      </div>

      <div
        className="flex flex-col items-center gap-2 text-sm"
        style={{ fontFamily: "Manrope, sans-serif", color: "#4d88ffaa" }}
      >
        <p>🖱️ Move mouse / touch to aim basket</p>
        <p>⌨️ Arrow keys or A / D to move</p>
      </div>

      <button
        className="pointer-events-auto px-10 py-4 rounded-2xl text-xl font-bold tracking-wide transition-transform active:scale-95"
        style={{
          fontFamily: "Fraunces, serif",
          background: "linear-gradient(135deg, #00ffff22, #ff4dff22)",
          border: "2px solid #00ffff",
          color: "#00ffff",
          textShadow: "0 0 12px #00ffff",
          boxShadow: "0 0 24px #00ffff44, 0 0 48px #00ffff22, inset 0 0 20px #00ffff11",
          minWidth: 200,
          minHeight: 56,
        }}
        onClick={onStart}
      >
        Play
      </button>

      <p
        className="text-xs"
        style={{ fontFamily: "Manrope, sans-serif", color: "#ffffff33" }}
      >
        Press Space or Enter to start
      </p>
    </div>
  );
}

function GameOverScreen({
  score,
  highScore,
  isNewBest,
  onRestart,
}: {
  score: number;
  highScore: number;
  isNewBest: boolean;
  onRestart: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20 pointer-events-none"
      style={{ background: "rgba(5,10,25,0.82)" }}
    >
      <div className="flex flex-col items-center gap-1">
        <h2
          className="text-4xl md:text-5xl font-bold"
          style={{
            fontFamily: "Fraunces, serif",
            color: "#ff2244",
            textShadow: "0 0 20px #ff2244, 0 0 50px #ff224488",
          }}
        >
          Game Over
        </h2>
        {isNewBest && (
          <p
            className="text-lg font-bold"
            style={{
              fontFamily: "Manrope, sans-serif",
              color: "#ffff4d",
              textShadow: "0 0 12px #ffff4d",
            }}
          >
            ✨ New Best Score!
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span
          className="text-5xl font-bold tabular-nums"
          style={{
            fontFamily: "Fraunces, serif",
            color: "#00ffff",
            textShadow: "0 0 16px #00ffff, 0 0 40px #00ffff88",
          }}
        >
          {score.toLocaleString()}
        </span>
        <span
          className="text-sm"
          style={{ fontFamily: "Manrope, sans-serif", color: "#4d88ffaa" }}
        >
          Best: {highScore.toLocaleString()}
        </span>
      </div>

      <button
        className="pointer-events-auto px-10 py-4 rounded-2xl text-xl font-bold tracking-wide transition-transform active:scale-95"
        style={{
          fontFamily: "Fraunces, serif",
          background: "linear-gradient(135deg, #ff224422, #ff4dff22)",
          border: "2px solid #ff4dff",
          color: "#ff4dff",
          textShadow: "0 0 12px #ff4dff",
          boxShadow: "0 0 24px #ff4dff44, 0 0 48px #ff4dff22, inset 0 0 20px #ff4dff11",
          minWidth: 200,
          minHeight: 56,
        }}
        onClick={onRestart}
      >
        Play Again
      </button>

      <p
        className="text-xs"
        style={{ fontFamily: "Manrope, sans-serif", color: "#ffffff33" }}
      >
        Press Space or Enter to restart
      </p>
    </div>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<OrbCascadeGame | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const handleStart = useCallback(() => {
    gameRef.current?.startGame();
    setIsNewBest(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const app = new Application();

    (async () => {
      await app.init({
        resizeTo: container,
        background: "#050a19",
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const game = new OrbCascadeGame(app, {
        onPhaseChange: (p) => {
          setPhase(p);
          if (p === "over") {
            setFinalScore((prev) => {
              // capture score at game-over time
              return prev;
            });
          }
        },
        onScoreChange: (s) => {
          setScore(s);
          setFinalScore(s);
        },
        onLivesChange: (l) => setLives(l),
        onComboChange: (c) => setCombo(c),
        onHighScore: (s) => {
          setHighScore(s);
          setIsNewBest(true);
        },
      });

      // Sync initial high score from storage
      setHighScore(game.getHighScore());

      gameRef.current = game;
    })();

    return () => {
      destroyed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
      app.destroy(true);
    };
  }, []);

  return (
    <Shell>
      <div className="relative w-full h-full min-h-[400px]">
        <div ref={containerRef} className="absolute inset-0" />

        {/* HUD — always visible during play */}
        {phase === "playing" && (
          <HudBar score={score} lives={lives} combo={combo} highScore={highScore} />
        )}

        {/* Overlays */}
        {phase === "menu" && <MenuScreen onStart={handleStart} />}
        {phase === "over" && (
          <GameOverScreen
            score={finalScore}
            highScore={highScore}
            isNewBest={isNewBest}
            onRestart={handleStart}
          />
        )}
      </div>
    </Shell>
  );
}
