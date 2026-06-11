"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Bomb, Bot, Flag, Flame, Gauge, Medal, RotateCcw, Sparkles, Swords, Timer, Trophy } from "lucide-react";
import {
  calculateScore,
  countFlags,
  createBoard,
  difficulties,
  type Cell,
  type Difficulty,
  type DifficultyKey,
  type GameResult,
  type GameStatus,
  hasWon,
  revealAllMines,
  revealCell,
  revealNeighborCells,
  toggleFlag,
  type Score,
  type ScoreInput
} from "@novasweeper/shared";
import { fetchScores, submitScore } from "@/lib/api";

type GameState = {
  board: Cell[][];
  status: GameStatus;
  difficulty: DifficultyKey;
  seed: string;
  moves: number;
  seconds: number;
  penalties: number;
};

type GameMode = "solo" | "pve";
type AiLevel = "easy" | "normal" | "hard";
type AiState = {
  board: Cell[][];
  status: GameStatus;
  level: AiLevel;
  seed: string;
  moves: number;
  seconds: number;
  penalties: number;
};
type PveRecord = Record<AiLevel, { playerWins: number; aiWins: number; matches: number }>;

const defaultName = "Nova Pilot";
const localScoresKey = "novasweeper:scores";
const pveRecordKey = "novasweeper:pve-record";
const aiLevels: Record<AiLevel, { label: string; intervalMs: number; mistakeRate: number; burst: number }> = {
  easy: { label: "Rookie", intervalMs: 1300, mistakeRate: 0.18, burst: 1 },
  normal: { label: "Nova", intervalMs: 850, mistakeRate: 0.08, burst: 1 },
  hard: { label: "Singularity", intervalMs: 560, mistakeRate: 0.025, burst: 2 }
};

export function GameShell() {
  const [playerName, setPlayerName] = useState(defaultName);
  const [state, setState] = useState<GameState>(() => newGame("nova"));
  const [mode, setMode] = useState<GameMode>("solo");
  const [aiState, setAiState] = useState<AiState>(() => newAiGame("nova", "normal"));
  const [pveRecord, setPveRecord] = useState<PveRecord>(() => createEmptyPveRecord());
  const [scores, setScores] = useState<Score[]>([]);
  const [apiState, setApiState] = useState<"idle" | "syncing" | "offline">("idle");
  const savedResultKeyRef = useRef<string | null>(null);
  const matchNoteRef = useRef<string | null>(null);

  const difficulty = difficulties[state.difficulty];
  const flags = countFlags(state.board);
  const remainingMines = difficulty.mines - flags;
  const currentScore = calculateScore(difficulty, state.seconds, state.moves);
  const terminalResult = state.status === "won" || state.status === "lost" ? state.status : null;
  const finalScore = terminalResult ? calculateFinalScore(state.board, state.difficulty, terminalResult, state.seconds, state.moves) : currentScore;
  const aiProgress = getProgress(aiState.board, state.difficulty);
  const playerProgress = getProgress(state.board, state.difficulty);

  useEffect(() => {
    setPveRecord(readPveRecord());
  }, []);

  const loadScores = useCallback(async (key: DifficultyKey) => {
    setApiState("syncing");
    const localScores = readLocalScores(key);
    try {
      const nextScores = await fetchScores(key);
      setScores(mergeScores(nextScores, localScores));
      setApiState("idle");
    } catch {
      setScores(localScores);
      setApiState("offline");
    }
  }, []);

  useEffect(() => {
    void loadScores(state.difficulty);
  }, [loadScores, state.difficulty]);

  useEffect(() => {
    if (state.status !== "playing") return;
    const interval = window.setInterval(() => {
      setState((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (mode === "pve" && state.status === "playing" && aiState.status === "ready") {
      setAiState((current) => ({ ...current, status: "playing" }));
    }
  }, [aiState.status, mode, state.status]);

  useEffect(() => {
    if (mode !== "pve" || state.status !== "playing" || aiState.status !== "playing") return;
    const interval = window.setInterval(() => {
      setAiState((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [aiState.status, mode, state.status]);

  useEffect(() => {
    if (mode !== "pve" || state.status !== "playing" || aiState.status !== "playing") return;
    const config = aiLevels[aiState.level];
    const interval = window.setInterval(() => {
      setAiState((current) => runAiTurn(current, state.difficulty));
    }, config.intervalMs);
    return () => window.clearInterval(interval);
  }, [aiState.level, aiState.status, mode, state.difficulty, state.status]);

  useEffect(() => {
    if (mode !== "pve" || state.status !== "playing") return;

    if (aiState.status === "won") {
      matchNoteRef.current = "AI cleared the field first";
      setState((current) => (current.status === "playing" ? { ...current, status: "lost" } : current));
    }
  }, [aiState.status, mode, state.status]);

  useEffect(() => {
    if (state.status !== "won" && state.status !== "lost") return;
    if (mode === "pve" && !matchNoteRef.current) {
      matchNoteRef.current = state.status === "won" ? "You cleared the field first" : "Your core hit a mine";
    }
    const resultKey = `${state.status}:${state.difficulty}:${state.seconds}:${state.moves}`;
    if (savedResultKeyRef.current === resultKey) return;
    savedResultKeyRef.current = resultKey;

    if (mode === "pve") {
      const nextRecord = incrementPveRecord(readPveRecord(), aiState.level, state.status === "won" ? "player" : "ai");
      writePveRecord(nextRecord);
      setPveRecord(nextRecord);
    }

    const payload: ScoreInput = {
      playerName: playerName.trim() || defaultName,
      difficulty: state.difficulty,
      result: state.status,
      seconds: state.seconds,
      moves: state.moves,
      score: calculateFinalScore(state.board, state.difficulty, state.status, state.seconds, state.moves)
    };

    const localScore = createLocalScore(payload);
    writeLocalScore(localScore);
    setScores((current) => mergeScores([localScore], current));

    submitScore(payload)
      .then(() => loadScores(state.difficulty))
      .catch(() => setApiState("offline"));
  }, [aiState.level, loadScores, mode, playerName, state.difficulty, state.moves, state.seconds, state.status]);

  const statusCopy = useMemo(() => {
    if (state.status === "won") return "Nova cleared";
    if (state.status === "lost") return "Core breached";
    if (state.status === "playing") return "Signal active";
    return "Awaiting first scan";
  }, [state.status]);

  function reset(key = state.difficulty, aiLevel = aiState.level) {
    savedResultKeyRef.current = null;
    matchNoteRef.current = null;
    const seed = createMatchSeed();
    setState(newGame(key, seed));
    setAiState(newAiGame(key, aiLevel, seed));
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    reset();
  }

  function changeAiLevel(level: AiLevel) {
    reset(state.difficulty, level);
  }

  function openCell(row: number, col: number) {
    setState((current) => {
      if (current.status === "won" || current.status === "lost") return current;
      const firstMove = current.status === "ready";
      const board = firstMove ? createBoard(difficulties[current.difficulty], row, col, current.seed) : current.board;
      const selected = board[row]?.[col];
      if (!selected || selected.isFlagged) return current;

      if (firstMove && mode === "pve") {
        const aiBoard = revealCell(createBoard(difficulties[current.difficulty], row, col, current.seed), row, col);
        setAiState((currentAi) => ({
          ...currentAi,
          board: aiBoard,
          seed: current.seed,
          status: "playing",
          moves: 1
        }));
      }

      if (selected.isRevealed) {
        const revealed = revealNeighborCells(board, row, col);
        const hitMine = revealed.flat().some((cell) => cell.isMine && cell.isRevealed);

        if (hitMine && mode === "pve") {
          return {
            ...current,
            board: applyPvePenalty(revealed, current.difficulty),
            status: "playing",
            moves: current.moves + 1,
            penalties: current.penalties + 1
          };
        }

        return {
          ...current,
          board: hitMine ? revealAllMines(revealed) : revealed,
          status: hitMine ? "lost" : hasWon(revealed) ? "won" : "playing",
          moves: current.moves + 1
        };
      }

      if (selected.isMine) {
        if (mode === "pve") {
          return {
            ...current,
            board: applyPvePenalty(board, current.difficulty),
            status: "playing",
            moves: current.moves + 1,
            penalties: current.penalties + 1
          };
        }

        return {
          ...current,
          board: revealAllMines(board),
          status: "lost",
          moves: current.moves + 1
        };
      }

      const revealed = revealCell(board, row, col);
      return {
        ...current,
        board: revealed,
        status: hasWon(revealed) ? "won" : "playing",
        moves: current.moves + 1
      };
    });
  }

  function flagCell(event: MouseEvent, row: number, col: number) {
    event.preventDefault();
    setState((current) => {
      if (current.status === "won" || current.status === "lost") return current;
      const selected = current.board[row]?.[col];
      if (!selected || selected.isRevealed) return current;

      return {
        ...current,
        board: toggleFlag(current.board, row, col),
        status: current.status === "ready" ? "playing" : current.status
      };
    });
  }

  return (
    <main className="app-shell">
      <section className="play-surface" aria-label="Novasweeper game">
        <header className="topbar">
          <div className="brand-lockup">
            <img className="brand-icon" src="/nova.png" alt="NovaSweeper icon" />
            <div>
            <p className="eyebrow">
              <Sparkles size={16} /> Novasweeper
            </p>
            <h1>NovaSweeper</h1>
            </div>
          </div>
          <div className={`status-pill status-${state.status}`}>
            <Flame size={16} />
            {statusCopy}
          </div>
          <nav className="account-nav" aria-label="Account">
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
            <Link href="/profile">Profile</Link>
          </nav>
        </header>

        <div className="command-panel">
          <label className="name-field">
            <span>Pilot</span>
            <input value={playerName} maxLength={32} onChange={(event) => setPlayerName(event.target.value)} />
          </label>

          <div className="mode-tabs" role="tablist" aria-label="Game mode">
            <button className={mode === "solo" ? "active" : ""} onClick={() => changeMode("solo")} type="button">
              <Sparkles size={16} />
              Solo
            </button>
            <button className={mode === "pve" ? "active" : ""} onClick={() => changeMode("pve")} type="button">
              <Swords size={16} />
              PvE
            </button>
          </div>

          <div className="difficulty-tabs" role="tablist" aria-label="Difficulty">
            {Object.values(difficulties).map((option) => (
              <button
                key={option.key}
                className={option.key === state.difficulty ? "active" : ""}
                onClick={() => reset(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <button className="icon-button" type="button" onClick={() => reset()} aria-label="Restart game" title="Restart">
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="metrics">
          <Metric icon={<Bomb size={18} />} label="Mines" value={remainingMines.toString()} />
          <Metric icon={<Timer size={18} />} label="Time" value={`${state.seconds}s`} />
          <Metric icon={<Gauge size={18} />} label="Moves" value={state.moves.toString()} />
          <Metric icon={<Trophy size={18} />} label="Score" value={formatNumber(finalScore)} />
        </div>

        {mode === "pve" ? (
          <section className="pve-panel" aria-label="PvE opponent">
            <div className="pve-header">
              <div>
                <p className="eyebrow">
                  <Bot size={16} /> AI opponent
                </p>
                <h2>{aiLevels[aiState.level].label} core</h2>
              </div>
              <div className="ai-tabs" role="tablist" aria-label="AI difficulty">
                {(Object.keys(aiLevels) as AiLevel[]).map((level) => (
                  <button key={level} className={aiState.level === level ? "active" : ""} onClick={() => changeAiLevel(level)} type="button">
                    {aiLevels[level].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="race-grid">
              <RaceBar label="You" status={state.status} value={playerProgress} moves={state.moves} penalties={state.penalties} />
              <RaceBar label="AI" status={aiState.status} value={aiProgress} moves={aiState.moves} penalties={aiState.penalties} />
            </div>
          </section>
        ) : null}

        <div className={mode === "pve" ? "boards-grid pve-boards" : "boards-grid"}>
          <GameBoard title="Your field" board={state.board} status={state.status} difficulty={difficulty} onOpen={openCell} onFlag={flagCell} />
          {mode === "pve" ? <GameBoard title="AI field" board={aiState.board} status={aiState.status} difficulty={difficulty} isReadOnly /> : null}
        </div>
      </section>

      <aside className="scoreboard" aria-label="Leaderboard">
        <div className="scoreboard-header">
          <div>
            <p className="eyebrow">
              <Medal size={16} /> Leaderboard
            </p>
            <h2>{difficulty.label} pilots</h2>
          </div>
          <span className={`api-dot ${apiState}`} title={`API ${apiState}`} />
        </div>

        <div className="score-list">
          {scores.length === 0 ? (
            <p className="empty-state">No scores yet.</p>
          ) : (
            scores.map((score, index) => (
              <div className="score-row" key={score.id}>
                <span className="rank">{index + 1}</span>
                <div>
                  <strong>{score.playerName}</strong>
                  <span>
                    {score.result.toUpperCase()} - {score.seconds}s - {score.moves} moves
                  </span>
                </div>
                <b>{formatNumber(score.score)}</b>
              </div>
            ))
          )}
        </div>

        {mode === "pve" ? (
          <div className="pve-record">
            <p className="eyebrow">
              <Swords size={16} /> PvE score
            </p>
            {(Object.keys(aiLevels) as AiLevel[]).map((level) => (
              <div className="record-row" key={level}>
                <span>{aiLevels[level].label}</span>
                <strong>
                  {pveRecord[level].playerWins} - {pveRecord[level].aiWins}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      {terminalResult ? (
        <div className="endgame-overlay" role="dialog" aria-modal="true" aria-labelledby="endgame-title">
          <div className="endgame-modal">
            <p className="eyebrow">
              <Trophy size={16} /> Result saved
            </p>
            <h2 id="endgame-title">{terminalResult === "won" ? "You win" : "Game over"}</h2>
            {mode === "pve" && matchNoteRef.current ? <p className="endgame-note">{matchNoteRef.current}</p> : null}
            <div className="endgame-stats">
              <Metric icon={<Trophy size={18} />} label="Final score" value={formatNumber(finalScore)} />
              <Metric icon={<Timer size={18} />} label="Time" value={`${state.seconds}s`} />
              <Metric icon={<Gauge size={18} />} label="Moves" value={state.moves.toString()} />
            </div>
            <button className="play-again-button" type="button" onClick={() => reset()}>
              Play again
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function RaceBar({ label, status, value, moves, penalties }: { label: string; status: GameStatus; value: number; moves: number; penalties: number }) {
  return (
    <div className="race-row">
      <div>
        <strong>{label}</strong>
        <span>
          {Math.round(value)}% - {status} - {moves} moves - {penalties} penalties
        </span>
      </div>
      <div className="race-track" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function GameBoard({
  title,
  board,
  status,
  difficulty,
  isReadOnly = false,
  onOpen,
  onFlag
}: {
  title: string;
  board: Cell[][];
  status: GameStatus;
  difficulty: Difficulty;
  isReadOnly?: boolean;
  onOpen?: (row: number, col: number) => void;
  onFlag?: (event: MouseEvent, row: number, col: number) => void;
}) {
  return (
    <div className="board-frame">
      <div className="board-title">
        <span>{title}</span>
        <strong>{status}</strong>
      </div>
      <div
        className="board"
        style={{
          gridTemplateColumns: `repeat(${difficulty.cols}, minmax(0, 1fr))`,
          ["--cols" as string]: difficulty.cols,
          ["--rows" as string]: difficulty.rows
        }}
      >
        {board.flat().map((cell) => (
          <button
            key={`${cell.row}-${cell.col}`}
            className={cellClassName(cell, status)}
            onClick={() => onOpen?.(cell.row, cell.col)}
            onContextMenu={(event) => onFlag?.(event, cell.row, cell.col)}
            aria-label={`${title} row ${cell.row + 1}, column ${cell.col + 1}`}
            disabled={isReadOnly}
            type="button"
          >
            {renderCell(cell)}
          </button>
        ))}
      </div>
    </div>
  );
}

function newGame(difficulty: DifficultyKey, seed = createMatchSeed()): GameState {
  return {
    board: createBoard(difficulties[difficulty], undefined, undefined, seed),
    difficulty,
    seed,
    status: "ready",
    moves: 0,
    seconds: 0,
    penalties: 0
  };
}

function newAiGame(difficulty: DifficultyKey, level: AiLevel, seed = createMatchSeed()): AiState {
  const board = createBoard(difficulties[difficulty], undefined, undefined, seed);
  return {
    board,
    status: "ready",
    level,
    seed,
    moves: 0,
    seconds: 0,
    penalties: 0
  };
}

function runAiTurn(current: AiState, difficulty: DifficultyKey): AiState {
  if (current.status === "won" || current.status === "lost") return current;

  let board = current.board;
  let status: GameStatus = "playing";
  let moves = current.moves;
  let penalties = current.penalties;
  const config = aiLevels[current.level];

  for (let index = 0; index < config.burst; index += 1) {
    const decision = chooseAiDecision(board, config.mistakeRate, current.level);
    if (!decision) break;
    moves += 1;

    if (decision.action === "flag") {
      board = toggleFlag(board, decision.cell.row, decision.cell.col);
      continue;
    }

    if (decision.cell.isMine) {
      board = applyPvePenalty(board, difficulty);
      penalties += 1;
      break;
    }

    board = revealCell(board, decision.cell.row, decision.cell.col);
    if (hasWon(board)) {
      status = "won";
      break;
    }
  }

  return {
    ...current,
    board,
    moves,
    penalties,
    status
  };
}

function chooseAiDecision(board: Cell[][], mistakeRate: number, level: AiLevel): { action: "reveal" | "flag"; cell: Cell } | null {
  const hidden = board.flat().filter((cell) => !cell.isRevealed && !cell.isFlagged);
  if (hidden.length === 0) return null;

  const deductions = getAiDeductions(board);
  const mine = deductions.mines.find((cell) => !cell.isFlagged);
  if (mine && level !== "easy") return { action: "flag", cell: mine };

  const safe = pickRandom(deductions.safe.filter((cell) => !cell.isFlagged && !cell.isRevealed));
  if (safe) return { action: "reveal", cell: safe };

  if (Math.random() < mistakeRate) {
    return { action: "reveal", cell: pickRandom(hidden) ?? hidden[0] };
  }

  const candidates = hidden
    .map((cell) => ({ cell, risk: estimateCellRisk(board, cell) }))
    .sort((left, right) => left.risk - right.risk);

  const poolSize = level === "hard" ? 3 : level === "normal" ? 8 : candidates.length;
  const pool = candidates.slice(0, Math.max(1, Math.min(poolSize, candidates.length)));
  const picked = pickRandom(pool);
  return picked ? { action: "reveal", cell: picked.cell } : null;
}

function getAiDeductions(board: Cell[][]): { safe: Cell[]; mines: Cell[] } {
  const safe = new Map<string, Cell>();
  const mines = new Map<string, Cell>();

  board.flat().forEach((cell) => {
    if (!cell.isRevealed || cell.isMine || cell.adjacentMines === 0) return;

    const neighbors = getLocalNeighbors(board, cell.row, cell.col);
    const flagged = neighbors.filter((neighbor) => neighbor.isFlagged).length;
    const hidden = neighbors.filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged);
    const remainingMines = cell.adjacentMines - flagged;

    if (remainingMines === 0) {
      hidden.forEach((neighbor) => safe.set(cellKey(neighbor), neighbor));
    }

    if (remainingMines > 0 && remainingMines === hidden.length) {
      hidden.forEach((neighbor) => mines.set(cellKey(neighbor), neighbor));
    }
  });

  return {
    safe: Array.from(safe.values()),
    mines: Array.from(mines.values())
  };
}

function estimateCellRisk(board: Cell[][], cell: Cell): number {
  const revealedNeighbors = getLocalNeighbors(board, cell.row, cell.col).filter((neighbor) => neighbor.isRevealed && !neighbor.isMine);
  if (revealedNeighbors.length === 0) return 0.45;

  const risks = revealedNeighbors.map((neighbor) => {
    const neighbors = getLocalNeighbors(board, neighbor.row, neighbor.col);
    const flagged = neighbors.filter((candidate) => candidate.isFlagged).length;
    const hidden = neighbors.filter((candidate) => !candidate.isRevealed && !candidate.isFlagged).length;
    if (hidden === 0) return 1;
    return Math.max(0, neighbor.adjacentMines - flagged) / hidden;
  });

  return Math.max(...risks);
}

function applyPvePenalty(board: Cell[][], difficulty: DifficultyKey): Cell[][] {
  const next = board.map((row) =>
    row.map((cell) => ({
      ...cell,
      isRevealed: cell.isMine ? false : cell.isRevealed
    }))
  );
  const revealedSafeCells = next.flat().filter((cell) => cell.isRevealed && !cell.isMine);
  if (revealedSafeCells.length === 0) return next;

  const center = pickRandom(revealedSafeCells) ?? revealedSafeCells[0];
  const radius = difficulty === "rookie" ? 1 : difficulty === "nova" ? 2 : 3;

  next.flat().forEach((cell) => {
    const distance = Math.abs(cell.row - center.row) + Math.abs(cell.col - center.col);
    if (!cell.isMine && distance <= radius) {
      cell.isRevealed = false;
      cell.isFlagged = false;
    }
  });

  return next;
}

function hasRevealedNeighbor(board: Cell[][], row: number, col: number): boolean {
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) continue;
      if (board[row + rowDelta]?.[col + colDelta]?.isRevealed) return true;
    }
  }
  return false;
}

function getLocalNeighbors(board: Cell[][], row: number, col: number): Cell[] {
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

function cellKey(cell: Cell): string {
  return `${cell.row}:${cell.col}`;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function getProgress(board: Cell[][], difficulty: DifficultyKey): number {
  const safeCells = difficulties[difficulty].rows * difficulties[difficulty].cols - difficulties[difficulty].mines;
  const revealedSafeCells = board.flat().filter((cell) => cell.isRevealed && !cell.isMine).length;
  return safeCells > 0 ? (revealedSafeCells / safeCells) * 100 : 0;
}

function cellClassName(cell: Cell, status: GameStatus): string {
  const classes = ["cell"];
  if (cell.isRevealed) classes.push("revealed");
  if (cell.isFlagged) classes.push("flagged");
  if (cell.isMine && cell.isRevealed) classes.push(status === "lost" ? "mine-hit" : "mine");
  if (cell.adjacentMines > 0 && cell.isRevealed) classes.push(`count-${cell.adjacentMines}`);
  return classes.join(" ");
}

function renderCell(cell: Cell) {
  if (cell.isFlagged && !cell.isRevealed) return <Flag size={15} fill="currentColor" />;
  if (!cell.isRevealed) return null;
  if (cell.isMine) return <Bomb size={15} />;
  if (cell.adjacentMines > 0) return cell.adjacentMines;
  return null;
}

function calculateFinalScore(board: Cell[][], difficulty: DifficultyKey, result: GameResult, seconds: number, moves: number): number {
  const baseScore = calculateScore(difficulties[difficulty], seconds, moves);
  if (result === "won") return baseScore;

  const safeCells = difficulties[difficulty].rows * difficulties[difficulty].cols - difficulties[difficulty].mines;
  const revealedSafeCells = board.flat().filter((cell) => cell.isRevealed && !cell.isMine).length;
  const progress = safeCells > 0 ? revealedSafeCells / safeCells : 0;
  return Math.max(10, Math.round(baseScore * progress * 0.5));
}

function readLocalScores(difficulty: DifficultyKey): Score[] {
  if (typeof window === "undefined") return [];

  return readAllLocalScores().filter((score) => score.difficulty === difficulty);
}

function writeLocalScore(score: Score) {
  if (typeof window === "undefined") return;

  const scores = mergeScores([score], readAllLocalScores());
  window.localStorage.setItem(localScoresKey, JSON.stringify(scores.slice(0, 60)));
}

function readAllLocalScores(): Score[] {
  if (typeof window === "undefined") return [];

  try {
    const rawScores = window.localStorage.getItem(localScoresKey);
    return rawScores ? normalizeScores(JSON.parse(rawScores) as Partial<Score>[]) : [];
  } catch {
    return [];
  }
}

function createLocalScore(input: ScoreInput): Score {
  return {
    ...input,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString()
  };
}

function mergeScores(primary: Score[], secondary: Score[]): Score[] {
  const byKey = new Map<string, Score>();

  [...primary, ...secondary].forEach((score) => {
    const key = `${score.playerName}:${score.difficulty}:${score.result}:${score.seconds}:${score.moves}:${score.score}`;
    if (!byKey.has(key)) {
      byKey.set(key, score);
    }
  });

  return Array.from(byKey.values())
    .sort(
      (left, right) =>
        resultWeight(right.result) - resultWeight(left.result) ||
        right.score - left.score ||
        left.seconds - right.seconds ||
        Date.parse(right.createdAt) - Date.parse(left.createdAt)
    )
    .slice(0, 20);
}

function normalizeScores(scores: Partial<Score>[]): Score[] {
  return scores
    .filter((score): score is Partial<Score> & Pick<Score, "id" | "playerName" | "difficulty" | "seconds" | "moves" | "score" | "createdAt"> => {
      return Boolean(score.id && score.playerName && score.difficulty && score.createdAt);
    })
    .map((score) => ({
      ...score,
      result: score.result === "lost" ? "lost" : "won"
    }));
}

function resultWeight(result: GameResult): number {
  return result === "won" ? 1 : 0;
}

function createMatchSeed(): string {
  return `nova-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyPveRecord(): PveRecord {
  return {
    easy: { playerWins: 0, aiWins: 0, matches: 0 },
    normal: { playerWins: 0, aiWins: 0, matches: 0 },
    hard: { playerWins: 0, aiWins: 0, matches: 0 }
  };
}

function readPveRecord(): PveRecord {
  if (typeof window === "undefined") return createEmptyPveRecord();

  try {
    const saved = window.localStorage.getItem(pveRecordKey);
    return saved ? { ...createEmptyPveRecord(), ...(JSON.parse(saved) as Partial<PveRecord>) } : createEmptyPveRecord();
  } catch {
    return createEmptyPveRecord();
  }
}

function writePveRecord(record: PveRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(pveRecordKey, JSON.stringify(record));
}

function incrementPveRecord(record: PveRecord, level: AiLevel, winner: "player" | "ai"): PveRecord {
  const next = {
    ...record,
    [level]: { ...record[level] }
  };

  next[level].matches += 1;
  if (winner === "player") {
    next[level].playerWins += 1;
  } else {
    next[level].aiWins += 1;
  }

  return next;
}
