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

/**
 * Advance Jest fake timers and ensure React state updates triggered by timers
 * are fully flushed before assertions.
 *
 * React 18 can schedule updates asynchronously from timer callbacks; using
 * async act() + a microtask flush makes these tests deterministic.
 */
async function advanceTimersAndFlush(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // Flush any microtasks scheduled by React updates/timer callbacks.
    await Promise.resolve();
  });
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

  afterEach(() => {
    jest.runOnlyPendingTimers();
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
    await advanceTimersAndFlush(12 * 140);

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
    await advanceTimersAndFlush(3 * 140);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(getScoreValueNode()).toHaveTextContent("0");
    expect(getStatusValueNode()).toHaveTextContent("Paused");
  });
});
