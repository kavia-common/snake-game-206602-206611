import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * Snake game configuration.
 * Note: Board is rendered via CSS grid; the cell size adapts to viewport.
 */
const GRID_SIZE = 21; // 21x21 classic feel, still fits mobile
const INITIAL_SPEED_MS = 140; // starting tick speed
const SPEEDUP_EVERY_FOODS = 4; // speed increases every N foods
const SPEEDUP_STEP_MS = 10; // decrease interval by this amount
const MIN_SPEED_MS = 70; // cap maximum speed

const STORAGE_KEY_HIGH_SCORE = "snake.highScore.v1";

const DIR = {
  Up: { x: 0, y: -1, key: "ArrowUp" },
  Down: { x: 0, y: 1, key: "ArrowDown" },
  Left: { x: -1, y: 0, key: "ArrowLeft" },
  Right: { x: 1, y: 0, key: "ArrowRight" },
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function posKey(p) {
  return `${p.x},${p.y}`;
}

function isOpposite(a, b) {
  return a && b && a.x === -b.x && a.y === -b.y;
}

function randomEmptyCell(occupiedSet, gridSize) {
  // Try a bounded number of attempts; fallback to scan for robustness.
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    const k = `${x},${y}`;
    if (!occupiedSet.has(k)) return { x, y };
  }
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const k = `${x},${y}`;
      if (!occupiedSet.has(k)) return { x, y };
    }
  }
  // No space left (win condition)
  return null;
}

function getInitialSnake(gridSize) {
  const mid = Math.floor(gridSize / 2);
  // Head at (mid, mid), moving right
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

function getStoredHighScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function setStoredHighScore(score) {
  try {
    window.localStorage.setItem(STORAGE_KEY_HIGH_SCORE, String(score));
  } catch {
    // ignore storage failures (privacy mode, etc.)
  }
}

function speedForScore(score) {
  const foods = Math.floor(score); // score is "foods eaten"
  const steps = Math.floor(foods / SPEEDUP_EVERY_FOODS);
  return clamp(INITIAL_SPEED_MS - steps * SPEEDUP_STEP_MS, MIN_SPEED_MS, INITIAL_SPEED_MS);
}

// PUBLIC_INTERFACE
function App() {
  const [snake, setSnake] = useState(() => getInitialSnake(GRID_SIZE));
  const [direction, setDirection] = useState(() => DIR.Right);
  const [queuedDirection, setQueuedDirection] = useState(null);

  const [food, setFood] = useState(() => {
    const s = getInitialSnake(GRID_SIZE);
    const occ = new Set(s.map(posKey));
    return randomEmptyCell(occ, GRID_SIZE) || { x: 0, y: 0 };
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0); // number of foods eaten
  const [highScore, setHighScore] = useState(() => getStoredHighScore());

  // Refs to avoid stale closures in interval tick.
  const directionRef = useRef(direction);
  const queuedDirRef = useRef(queuedDirection);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const runningRef = useRef(isRunning);
  const gameOverRef = useRef(isGameOver);
  const scoreRef = useRef(score);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);
  useEffect(() => {
    queuedDirRef.current = queuedDirection;
  }, [queuedDirection]);
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);
  useEffect(() => {
    foodRef.current = food;
  }, [food]);
  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    gameOverRef.current = isGameOver;
  }, [isGameOver]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const occupiedSet = useMemo(() => new Set(snake.map(posKey)), [snake]);

  const updateHighScoreIfNeeded = useCallback(
    (nextScore) => {
      setHighScore((prev) => {
        const updated = Math.max(prev, nextScore);
        if (updated !== prev) setStoredHighScore(updated);
        return updated;
      });
    },
    [setHighScore]
  );

  // PUBLIC_INTERFACE
  const resetGame = useCallback(() => {
    const s = getInitialSnake(GRID_SIZE);
    const occ = new Set(s.map(posKey));
    const nextFood = randomEmptyCell(occ, GRID_SIZE) || { x: 0, y: 0 };

    setSnake(s);
    setDirection(DIR.Right);
    setQueuedDirection(null);
    setFood(nextFood);

    setIsGameOver(false);
    setIsRunning(false);
    setScore(0);
  }, []);

  // PUBLIC_INTERFACE
  const startOrResume = useCallback(() => {
    if (gameOverRef.current) return;
    setIsRunning(true);
  }, []);

  // PUBLIC_INTERFACE
  const togglePause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const commitDirectionIfQueued = useCallback(() => {
    const q = queuedDirRef.current;
    if (q && !isOpposite(q, directionRef.current)) {
      setDirection(q);
      setQueuedDirection(null);
    } else if (q) {
      // Clear invalid opposite queued direction
      setQueuedDirection(null);
    }
  }, []);

  const endGame = useCallback(() => {
    setIsRunning(false);
    setIsGameOver(true);
  }, []);

  const tick = useCallback(() => {
    // Apply any buffered direction at tick boundary to avoid 180-degree flips.
    commitDirectionIfQueued();

    const dir = directionRef.current;
    const currentSnake = snakeRef.current;
    const currentFood = foodRef.current;

    const head = currentSnake[0];
    const nextHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall collision
    if (
      nextHead.x < 0 ||
      nextHead.y < 0 ||
      nextHead.x >= GRID_SIZE ||
      nextHead.y >= GRID_SIZE
    ) {
      endGame();
      return;
    }

    // Determine if we are eating
    const eating = nextHead.x === currentFood.x && nextHead.y === currentFood.y;

    // Self collision:
    // If not eating, tail will move away, so we can ignore current tail cell.
    const bodyToCheck = eating ? currentSnake : currentSnake.slice(0, currentSnake.length - 1);
    const bodySet = new Set(bodyToCheck.map(posKey));
    if (bodySet.has(posKey(nextHead))) {
      endGame();
      return;
    }

    // Move snake
    const nextSnake = [nextHead, ...currentSnake];
    if (!eating) {
      nextSnake.pop();
    }

    // If eating, spawn new food
    if (eating) {
      const nextScore = scoreRef.current + 1;
      setScore(nextScore);
      updateHighScoreIfNeeded(nextScore);

      const occ = new Set(nextSnake.map(posKey));
      const nextFood = randomEmptyCell(occ, GRID_SIZE);

      if (!nextFood) {
        // Board filled: win -> treat as game over (or "you win")
        endGame();
        return;
      }
      setFood(nextFood);
    }

    setSnake(nextSnake);
  }, [commitDirectionIfQueued, endGame, updateHighScoreIfNeeded]);

  // Game loop with dynamic speed based on score.
  useEffect(() => {
    if (!isRunning || isGameOver) return undefined;

    const intervalMs = speedForScore(score);
    const id = window.setInterval(() => {
      if (!runningRef.current || gameOverRef.current) return;
      tick();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isRunning, isGameOver, score, tick]);

  // Keyboard controls: arrows + WASD, space pause, R restart, Enter start/resume.
  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key;

      // Prevent page scroll with arrow keys/space while playing/focused
      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === " " ||
        key === "Spacebar"
      ) {
        e.preventDefault();
      }

      // Start/resume
      if (key === "Enter") {
        startOrResume();
        return;
      }

      // Restart
      if (key === "r" || key === "R") {
        resetGame();
        return;
      }

      // Pause
      if (key === " " || key === "Spacebar" || key === "p" || key === "P") {
        // Don't pause if game over (reset instead)
        if (gameOverRef.current) return;
        togglePause();
        return;
      }

      // Direction input (buffer it; applied on tick)
      let nextDir = null;
      if (key === DIR.Up.key || key === "w" || key === "W") nextDir = DIR.Up;
      if (key === DIR.Down.key || key === "s" || key === "S") nextDir = DIR.Down;
      if (key === DIR.Left.key || key === "a" || key === "A") nextDir = DIR.Left;
      if (key === DIR.Right.key || key === "d" || key === "D") nextDir = DIR.Right;

      if (!nextDir) return;

      // If not started yet, direction input should also start the game.
      if (!runningRef.current && !gameOverRef.current) {
        setIsRunning(true);
      }

      // Do not allow immediate opposite direction
      const current = directionRef.current;
      if (isOpposite(nextDir, current)) return;

      // Queue direction (so quick double-taps can turn corners naturally).
      setQueuedDirection(nextDir);
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetGame, startOrResume, togglePause]);

  const statusText = useMemo(() => {
    if (isGameOver) return "Game Over";
    if (!isRunning) return "Paused";
    return "Playing";
  }, [isGameOver, isRunning]);

  const helperText = useMemo(() => {
    if (isGameOver) return "Press R to restart";
    if (!isRunning) return "Press Enter / Arrow Keys to start • Space to pause";
    return "Arrow Keys / WASD to move • Space to pause • R to restart";
  }, [isGameOver, isRunning]);

  const speedLabel = useMemo(() => {
    const ms = speedForScore(score);
    // Turn into an easy “level”-ish label
    const level = 1 + Math.floor((INITIAL_SPEED_MS - ms) / SPEEDUP_STEP_MS);
    return `Speed L${clamp(level, 1, 99)}`;
  }, [score]);

  return (
    <div className="App">
      <div className="scanlines" aria-hidden="true" />
      <header className="gameShell">
        <div className="topBar">
          <div className="brand">
            <div className="brandTitle">SNAKE</div>
            <div className="brandSub">Retro Grid Edition</div>
          </div>

          <div className="stats" role="status" aria-live="polite">
            <div className="stat">
              <div className="statLabel">Score</div>
              <div className="statValue">{score}</div>
            </div>
            <div className="stat">
              <div className="statLabel">High</div>
              <div className="statValue">{highScore}</div>
            </div>
            <div className="stat">
              <div className="statLabel">{speedLabel}</div>
              <div className="statValue">{statusText}</div>
            </div>
          </div>
        </div>

        <main className="mainArea">
          <div className="boardFrame">
            <div
              className="board"
              role="application"
              aria-label="Snake game board"
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                const x = idx % GRID_SIZE;
                const y = Math.floor(idx / GRID_SIZE);
                const key = `${x},${y}`;

                const isSnake = occupiedSet.has(key);
                const isHead = snake[0].x === x && snake[0].y === y;
                const isFood = food.x === x && food.y === y;

                const className =
                  "cell" +
                  (isSnake ? " cell--snake" : "") +
                  (isHead ? " cell--head" : "") +
                  (isFood ? " cell--food" : "");

                return <div key={key} className={className} />;
              })}

              {(isGameOver || !isRunning) && (
                <div className="overlay" role="dialog" aria-modal="false" aria-label="Game status">
                  <div className="overlayCard">
                    <div className="overlayTitle">{isGameOver ? "Game Over" : "Paused"}</div>
                    <div className="overlayText">{helperText}</div>
                    <div className="overlayActions">
                      <button
                        className="btn btnPrimary"
                        onClick={() => {
                          if (isGameOver) resetGame();
                          else startOrResume();
                        }}
                      >
                        {isGameOver ? "Restart" : "Resume"}
                      </button>
                      <button className="btn btnGhost" onClick={resetGame}>
                        Reset
                      </button>
                    </div>
                    <div className="overlayHint">
                      Controls: Arrows / WASD • Space/P pause • R restart • Enter start
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="controlsPanel" aria-label="Controls">
            <div className="controlRow">
              <button
                className="btn btnPrimary"
                onClick={() => {
                  if (isGameOver) resetGame();
                  else startOrResume();
                }}
                disabled={isRunning && !isGameOver}
              >
                {isGameOver ? "Restart" : isRunning ? "Running" : "Start"}
              </button>

              <button className="btn btnSecondary" onClick={togglePause} disabled={isGameOver}>
                {isRunning ? "Pause" : "Resume"}
              </button>

              <button className="btn btnGhost" onClick={resetGame}>
                Reset
              </button>
            </div>

            <div className="helpText">{helperText}</div>

            <div className="mobileHint">
              Tip: On mobile/tablet, use an external keyboard for best control.
            </div>
          </div>
        </main>

        <footer className="footer">
          <span className="footerLeft">© Retro Arcade</span>
          <span className="footerRight">Grid {GRID_SIZE}×{GRID_SIZE}</span>
        </footer>
      </header>
    </div>
  );
}

export default App;
