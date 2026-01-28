"use strict";

/**
 * Pure game-logic helpers extracted from App.js to enable deterministic unit testing.
 * These functions avoid accessing React state, DOM, timers, or global randomness.
 */

/**
 * Direction vectors used by the game.
 */
export const DIR = {
  Up: { x: 0, y: -1, key: "ArrowUp" },
  Down: { x: 0, y: 1, key: "ArrowDown" },
  Left: { x: -1, y: 0, key: "ArrowLeft" },
  Right: { x: 1, y: 0, key: "ArrowRight" },
};

// PUBLIC_INTERFACE
export function clamp(n, min, max) {
  /** Clamp a number between min and max (inclusive). */
  return Math.max(min, Math.min(max, n));
}

// PUBLIC_INTERFACE
export function posKey(p) {
  /** Convert a coordinate to a stable string key. */
  return `${p.x},${p.y}`;
}

// PUBLIC_INTERFACE
export function isOpposite(a, b) {
  /** Returns true when two direction vectors are exact opposites. */
  return !!(a && b && a.x === -b.x && a.y === -b.y);
}

// PUBLIC_INTERFACE
export function getInitialSnake(gridSize) {
  /**
   * Create the initial snake positions centered on the board, facing right.
   * Returns array of positions: [head, ...tail].
   */
  const mid = Math.floor(gridSize / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

// PUBLIC_INTERFACE
export function nextHead(head, dir) {
  /** Compute next head position from a head and a direction. */
  return { x: head.x + dir.x, y: head.y + dir.y };
}

// PUBLIC_INTERFACE
export function isWallCollision(p, gridSize) {
  /** True if position p is outside the grid. */
  return p.x < 0 || p.y < 0 || p.x >= gridSize || p.y >= gridSize;
}

// PUBLIC_INTERFACE
export function isSelfCollision(nextHeadPos, snake, { eating }) {
  /**
   * True if nextHeadPos collides with snake body.
   * If not eating, tail would move away, so tail cell is ignored.
   */
  const bodyToCheck = eating ? snake : snake.slice(0, Math.max(0, snake.length - 1));
  const set = new Set(bodyToCheck.map(posKey));
  return set.has(posKey(nextHeadPos));
}

// PUBLIC_INTERFACE
export function moveSnake(snake, dir, { eating }) {
  /**
   * Return the next snake array after moving one step.
   * If eating=true, snake grows (no tail removal).
   */
  if (!snake || snake.length === 0) return [];
  const nh = nextHead(snake[0], dir);
  const next = [nh, ...snake];
  if (!eating) next.pop();
  return next;
}

/**
 * Deterministic empty-cell selection (injection-friendly).
 * The chooser decides which candidate cell to use; tests can provide a stable chooser.
 */
function defaultChooseIndex(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

// PUBLIC_INTERFACE
export function randomEmptyCell(occupiedSet, gridSize, chooseIndex = defaultChooseIndex) {
  /**
   * Pick an empty cell not in occupiedSet.
   * Deterministic if caller provides chooseIndex.
   *
   * Strategy:
   * 1) bounded random attempts (using chooseIndex)
   * 2) fallback scan
   * 3) null if no empty cells
   */
  const total = gridSize * gridSize;
  for (let i = 0; i < 300; i++) {
    const idx = chooseIndex(total);
    const x = idx % gridSize;
    const y = Math.floor(idx / gridSize);
    const k = `${x},${y}`;
    if (!occupiedSet.has(k)) return { x, y };
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const k = `${x},${y}`;
      if (!occupiedSet.has(k)) return { x, y };
    }
  }
  return null;
}
