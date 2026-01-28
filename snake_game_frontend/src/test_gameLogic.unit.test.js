import {
  DIR,
  clamp,
  getInitialSnake,
  isOpposite,
  isSelfCollision,
  isWallCollision,
  moveSnake,
  nextHead,
  posKey,
  randomEmptyCell,
} from "./gameLogic";

describe("gameLogic helpers (pure unit tests)", () => {
  test("posKey produces stable key", () => {
    expect(posKey({ x: 2, y: 3 })).toBe("2,3");
  });

  test("clamp clamps within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  test("isOpposite detects opposite directions", () => {
    expect(isOpposite(DIR.Left, DIR.Right)).toBe(true);
    expect(isOpposite(DIR.Up, DIR.Down)).toBe(true);
    expect(isOpposite(DIR.Up, DIR.Right)).toBe(false);
    expect(isOpposite(null, DIR.Right)).toBe(false);
  });

  test("getInitialSnake creates 3-long snake centered", () => {
    const s = getInitialSnake(21);
    expect(s).toHaveLength(3);
    expect(s[0]).toEqual({ x: 10, y: 10 });
    expect(s[1]).toEqual({ x: 9, y: 10 });
    expect(s[2]).toEqual({ x: 8, y: 10 });
  });

  test("nextHead returns correct next coordinate", () => {
    expect(nextHead({ x: 2, y: 2 }, DIR.Right)).toEqual({ x: 3, y: 2 });
    expect(nextHead({ x: 2, y: 2 }, DIR.Up)).toEqual({ x: 2, y: 1 });
  });

  test("isWallCollision detects out-of-bounds", () => {
    const N = 5;
    expect(isWallCollision({ x: 0, y: 0 }, N)).toBe(false);
    expect(isWallCollision({ x: 4, y: 4 }, N)).toBe(false);
    expect(isWallCollision({ x: -1, y: 0 }, N)).toBe(true);
    expect(isWallCollision({ x: 0, y: -1 }, N)).toBe(true);
    expect(isWallCollision({ x: 5, y: 0 }, N)).toBe(true);
    expect(isWallCollision({ x: 0, y: 5 }, N)).toBe(true);
  });

  test("moveSnake moves forward and keeps length when not eating", () => {
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];

    const next = moveSnake(snake, DIR.Right, { eating: false });
    expect(next).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ]);
  });

  test("moveSnake grows when eating", () => {
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];

    const next = moveSnake(snake, DIR.Right, { eating: true });
    expect(next).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  test("isSelfCollision ignores tail when not eating (moving into current tail is allowed)", () => {
    // Next head will be at {2,1}. Tail is also {2,1}.
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }, // tail
    ];

    const nextHeadPos = { x: 2, y: 1 };
    expect(isSelfCollision(nextHeadPos, snake, { eating: false })).toBe(false);
    expect(isSelfCollision(nextHeadPos, snake, { eating: true })).toBe(true);
  });

  test("isSelfCollision detects collision with body when not eating", () => {
    const snake = [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ];

    const nextHeadPos = { x: 2, y: 1 }; // collides with body segment
    expect(isSelfCollision(nextHeadPos, snake, { eating: false })).toBe(true);
  });

  test("randomEmptyCell is deterministic when chooseIndex is injected", () => {
    const gridSize = 3; // total 9
    const occupiedSet = new Set(["0,0", "1,0", "2,0"]);
    // chooseIndex returns 0..2 first (occupied), then 3 -> (0,1) which is empty
    const picks = [0, 1, 2, 3];
    const chooseIndex = () => picks.shift();

    const cell = randomEmptyCell(occupiedSet, gridSize, chooseIndex);
    expect(cell).toEqual({ x: 0, y: 1 });
  });

  test("randomEmptyCell returns null when board is full", () => {
    const gridSize = 2;
    const occupiedSet = new Set(["0,0", "1,0", "0,1", "1,1"]);
    const chooseIndex = () => 0;

    expect(randomEmptyCell(occupiedSet, gridSize, chooseIndex)).toBeNull();
  });
});
