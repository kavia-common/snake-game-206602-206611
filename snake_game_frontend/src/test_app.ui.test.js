import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

/**
 * UI tests intentionally avoid relying on random food placement.
 * We drive deterministic game outcomes by:
 * - using fake timers to control ticks
 * - moving in a straight line into the wall to trigger Game Over
 * - using localStorage to validate high score persistence
 *
 * NOTE: Some helper text appears in multiple locations (pause notice + help panel),
 * so prefer role-based or scoped queries, or getAllBy* variants when appropriate.
 */

const TICK_MS = 140;

/**
 * Advance one game tick worth of timers and flush React 18 updates.
 *
 * React 18 + fake timers can leave interval-driven state updates pending unless
 * each timer advancement is wrapped in async act() and followed by a microtask flush.
 */
async function advanceOneTick() {
  await act(async () => {
    jest.advanceTimersByTime(TICK_MS);
    await Promise.resolve();
  });
}

/**
 * Advance multiple ticks deterministically (one interval at a time).
 * This avoids flakiness where a large time jump doesn't reliably flush all
 * interval callbacks/state updates under React 18.
 */
async function advanceTicks(count) {
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-await-in-loop
    await advanceOneTick();
  }
}

function getScoreValueNode() {
  const label = screen.getByText("Score");
  return label.closest(".stat")?.querySelector(".statValue");
}

function getHighValueNode() {
  const label = screen.getByText("High");
  return label.closest(".stat")?.querySelector(".statValue");
}

function getStatusValueNode() {
  // In the third stat, label is Speed Lx and value is status text.
  // We locate the current "Speed L..." label and then find its value within that stat card.
  const speedLabelNode = screen.getByText(/Speed L\d+/);
  return speedLabelNode.closest(".stat")?.querySelector(".statValue");
}

describe("App UI (stable state tests)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Ensure any timer-driven React updates are flushed before switching timers back.
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
    jest.useRealTimers();
  });

  test("renders initial scoreboard and paused status", () => {
    render(<App />);

    expect(screen.getByText("SNAKE")).toBeInTheDocument();

    expect(getScoreValueNode()).toHaveTextContent("0");
    expect(getHighValueNode()).toHaveTextContent("0");

    expect(getStatusValueNode()).toHaveTextContent("Paused");
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();

    // The paused helper text is displayed in two places (pause notice + help panel).
    expect(screen.getAllByText(/Press Enter/i)).toHaveLength(2);
  });

  test("Start -> Playing, Pause -> Paused, Resume -> Playing", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(getStatusValueNode()).toHaveTextContent("Playing");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(getStatusValueNode()).toHaveTextContent("Paused");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(getStatusValueNode()).toHaveTextContent("Playing");
  });

  test("Space key toggles pause/resume when not game over", () => {
    render(<App />);

    // Start running using keyboard direction (also starts the game)
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(getStatusValueNode()).toHaveTextContent("Playing");

    fireEvent.keyDown(window, { key: " " });
    expect(getStatusValueNode()).toHaveTextContent("Paused");

    fireEvent.keyDown(window, { key: " " });
    expect(getStatusValueNode()).toHaveTextContent("Playing");
  });

  test("running into the wall triggers Game Over overlay; Restart resets score and returns to paused", async () => {
    render(<App />);

    // Start game
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(getStatusValueNode()).toHaveTextContent("Playing");

    // Default direction is Right; on a 21x21 grid starting at x=10, it takes 11 ticks to reach x=21 and collide.
    // Advance a bit more than needed to be safe, but do it tick-by-tick to avoid React 18 flakiness.
    await advanceTicks(12);

    // Overlay appears (wait deterministically for it)
    expect(await screen.findByRole("dialog", { name: "Game status" })).toBeInTheDocument();
    expect(screen.getByText("Game Over")).toBeInTheDocument();

    // Start button should now read Restart (game over state)
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();

    // Click Restart to reset and flush state updates
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Restart" }));
      await Promise.resolve();
    });

    // Overlay should be gone and score back to 0, status paused
    expect(screen.queryByRole("dialog", { name: "Game status" })).not.toBeInTheDocument();
    expect(getScoreValueNode()).toHaveTextContent("0");
    expect(getStatusValueNode()).toHaveTextContent("Paused");
  });

  test("High score is read from localStorage on mount", () => {
    window.localStorage.setItem("snake.highScore.v1", "7");
    render(<App />);

    expect(getHighValueNode()).toHaveTextContent("7");
  });

  test("Reset button resets score to 0 and returns to paused", async () => {
    render(<App />);

    // Start and advance a few ticks; score may remain 0 (food random), but reset should always stabilize UI.
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advanceTicks(3);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(getScoreValueNode()).toHaveTextContent("0");
    expect(getStatusValueNode()).toHaveTextContent("Paused");
  });
});
