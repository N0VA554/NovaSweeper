export type DifficultyKey = "rookie" | "nova" | "singularity";

export type Difficulty = {
  key: DifficultyKey;
  label: string;
  rows: number;
  cols: number;
  mines: number;
};

export type Cell = {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
};

export type GameStatus = "ready" | "playing" | "won" | "lost";
export type GameResult = "won" | "lost";

export type ScoreInput = {
  playerName: string;
  difficulty: DifficultyKey;
  result: GameResult;
  seconds: number;
  moves: number;
  score: number;
};

export type Score = ScoreInput & {
  id: string;
  createdAt: string;
};

export const difficulties: Record<DifficultyKey, Difficulty> = {
  rookie: { key: "rookie", label: "Rookie", rows: 9, cols: 9, mines: 10 },
  nova: { key: "nova", label: "Nova", rows: 16, cols: 16, mines: 40 },
  singularity: { key: "singularity", label: "Singularity", rows: 16, cols: 30, mines: 99 }
};

export function createBoard(difficulty: Difficulty, safeRow?: number, safeCol?: number, seed?: string): Cell[][] {
  const board = Array.from({ length: difficulty.rows }, (_, row) =>
    Array.from({ length: difficulty.cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0
    }))
  );

  const safeZone = new Set<string>();
  if (safeRow !== undefined && safeCol !== undefined) {
    getNeighbors(board, safeRow, safeCol).forEach((cell) => safeZone.add(`${cell.row}:${cell.col}`));
    safeZone.add(`${safeRow}:${safeCol}`);
  }

  const candidates = board.flat().filter((cell) => !safeZone.has(`${cell.row}:${cell.col}`));
  shuffle(candidates, seed ? createSeededRandom(seed) : Math.random);
  candidates.slice(0, difficulty.mines).forEach((cell) => {
    cell.isMine = true;
  });

  board.flat().forEach((cell) => {
    cell.adjacentMines = getNeighbors(board, cell.row, cell.col).filter((neighbor) => neighbor.isMine).length;
  });

  return board;
}

export function revealCell(board: Cell[][], row: number, col: number): Cell[][] {
  const next = cloneBoard(board);
  const start = next[row]?.[col];
  if (!start || start.isFlagged || start.isRevealed) return next;

  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell || cell.isRevealed || cell.isFlagged) continue;
    cell.isRevealed = true;

    if (!cell.isMine && cell.adjacentMines === 0) {
      getNeighbors(next, cell.row, cell.col)
        .filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine)
        .forEach((neighbor) => queue.push(neighbor));
    }
  }

  return next;
}

export function toggleFlag(board: Cell[][], row: number, col: number): Cell[][] {
  const next = cloneBoard(board);
  const cell = next[row]?.[col];
  if (!cell || cell.isRevealed) return next;
  cell.isFlagged = !cell.isFlagged;
  return next;
}

export function revealNeighborCells(board: Cell[][], row: number, col: number): Cell[][] {
  const source = board[row]?.[col];
  if (!source || !source.isRevealed) return cloneBoard(board);

  let next = cloneBoard(board);
  const neighbors = getNeighbors(next, row, col).filter((cell) => !cell.isFlagged && !cell.isRevealed);

  neighbors.forEach((cell) => {
    next = revealCell(next, cell.row, cell.col);
  });

  return next;
}

export function revealAllMines(board: Cell[][]): Cell[][] {
  const next = cloneBoard(board);
  next.flat().forEach((cell) => {
    if (cell.isMine) cell.isRevealed = true;
  });
  return next;
}

export function hasWon(board: Cell[][]): boolean {
  return board.flat().every((cell) => cell.isMine || cell.isRevealed);
}

export function countFlags(board: Cell[][]): number {
  return board.flat().filter((cell) => cell.isFlagged).length;
}

export function calculateScore(difficulty: Difficulty, seconds: number, moves: number): number {
  const mineWeight = difficulty.mines * 120;
  const sizeWeight = difficulty.rows * difficulty.cols * 4;
  const timePenalty = seconds * 9;
  const movePenalty = moves * 2;
  return Math.max(100, mineWeight + sizeWeight - timePenalty - movePenalty);
}

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function getNeighbors(board: Cell[][], row: number, col: number): Cell[] {
  const neighbors: Cell[] = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) continue;
      const neighbor = board[row + rowDelta]?.[col + colDelta];
      if (neighbor) neighbors.push(neighbor);
    }
  }
  return neighbors;
}

function shuffle<T>(items: T[], random = Math.random): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function createSeededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let next = hash;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
