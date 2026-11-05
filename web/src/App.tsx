import { useEffect, useRef, useState, useCallback } from "react";
import { Application } from "pixi.js";
import { GameShell, GameTopbar, GameAuth, GameButton, useGameSounds, useLeaderboard } from "@freegamestore/games";
import { OrbCascadeGame, Phase } from "./lib/game";

// useGameSounds reads SoundContext, which GameShell provides internally.
// Calling it above <GameShell> gets the muted default, so this no-render
// child of GameShell exposes the real sounds API to App via a ref.
type SoundsApi = ReturnType<typeof useGameSounds>;

function AudioBridge({ apiRef }: { apiRef: React.MutableRefObject<SoundsApi | null> }) {
  apiRef.current = useGameSounds();
  return null;
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

      <div className="pointer-events-auto">
        <GameButton size="lg" variant="primary" onClick={onStart}>
          Play
        </GameButton>
      </div>

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

      <div className="pointer-events-auto">
        <GameButton size="lg" variant="primary" onClick={onRestart}>
          Play Again
        </GameButton>
      </div>

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
  const audioRef = useRef<SoundsApi | null>(null);
  const { submitScore } = useLeaderboard("orb-cascade");
  const submitScoreRef = useRef(submitScore);
  submitScoreRef.current = submitScore;
  const scoreRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("menu");
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const handleStart = useCallback(() => {
    gameRef.current?.startGame();
    setIsNewBest(false);
  }, []);

  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let initialized = false;
    const app = new Application();

    (async () => {
      await app.init({
        resizeTo: container,
        background: "#050a19",
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      initialized = true;

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const game = new OrbCascadeGame(app, {
        onPhaseChange: (p) => {
          setPhase(p);
          setPaused(false);
          if (p === "over") {
            audioRef.current?.playGameOver();
            if (scoreRef.current > 0) submitScoreRef.current(scoreRef.current);
          }
        },
        onScoreChange: (s) => {
          scoreRef.current = s;
          setScore(s);
        },
        onLivesChange: (l) => setLives(l),
        onHighScore: (s) => {
          setHighScore(s);
          setIsNewBest(true);
        },
        onCatch: () => audioRef.current?.playScore(),
        onMiss: () => audioRef.current?.playError(),
      });

      // Sync initial high score from storage
      setHighScore(game.getHighScore());

      gameRef.current = game;
    })();

    return () => {
      destroyed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
      // Destroying before init() resolves throws in Pixi; the async block handles that case
      if (initialized) app.destroy(true);
    };
  }, []);

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Orb Cascade"
          stats={[
            { label: "Lives", value: lives },
            { label: "Score", value: score.toLocaleString(), accent: true },
            { label: "Best", value: highScore.toLocaleString() },
          ]}
          rules={
            <div>
              <h3 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>Orb Cascade</h3>
              <p>Catch the falling orbs in your basket. Miss three and the game is over.</p>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Controls</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Move the mouse or drag to aim the basket</li>
                <li>Arrow keys or A / D to move</li>
                <li>Space or Enter to start</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Rules</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Each catch is worth 10 points times your combo</li>
                <li>A miss resets the combo and costs a life</li>
                <li>Orbs fall faster and more often as you catch them</li>
              </ul>
            </div>
          }
          onPlayPause={phase === "playing" ? () => setPaused((p) => !p) : undefined}
          paused={paused}
          onRestart={handleStart}
          actions={<GameAuth />}
        />
      }
    >
      <AudioBridge apiRef={audioRef} />
      <div className="relative w-full h-full">
        <div ref={containerRef} className="absolute inset-0" style={{ touchAction: "none" }} />

        {/* Overlays */}
        {phase === "menu" && <MenuScreen onStart={handleStart} />}
        {phase === "over" && (
          <GameOverScreen
            score={score}
            highScore={highScore}
            isNewBest={isNewBest}
            onRestart={handleStart}
          />
        )}
      </div>
    </GameShell>
  );
}
