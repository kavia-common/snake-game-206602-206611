import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

/**
 * UI tests intentionally avoid relying on random food placement.
 * We drive deterministic game outcomes by:
 * - using fake timers to control ticks
 * - moving in a straight line into the wall to trigger Game Over
 * - using localStorage to validate high score persistence
 */

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
    expect(screen.getByText(/Press Enter/i)).toBeInTheDocument();
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

  test("running into the wall triggers Game Over overlay; Restart resets score and returns to paused", () => {
    render(<App />);

    // Start game
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(getStatusValueNode()).toHaveTextContent("Playing");

    // Default direction is Right; on a 21x21 grid starting at x=10, it takes 11 ticks to reach x=21 and collide.
    act(() => {
      jest.advanceTimersByTime(12 * 140);
    });

    // Overlay appears
    expect(screen.getByRole("dialog", { name: "Game status" })).toBeInTheDocument();
    expect(screen.getByText("Game Over")).toBeInTheDocument();

    // Start button should now read Restart (game over state)
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();

    // Click Restart to reset
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

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

  test("Reset button resets score to 0 and returns to paused", () => {
    render(<App />);

    // Start and advance a few ticks; score may remain 0 (food random), but reset should always stabilize UI.
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => {
      jest.advanceTimersByTime(3 * 140);
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(getScoreValueNode()).toHaveTextContent("0");
    expect(getStatusValueNode()).toHaveTextContent("Paused");
  });
});
