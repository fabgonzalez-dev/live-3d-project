/**
 * server/engine/VotingEngine.ts
 * Milestone D — Authoritative Color Palette Voting Round Engine.
 *
 * Responsibilities:
 * - 20-second voting rounds (or custom duration).
 * - Multi-language alias resolution (English & Spanish).
 * - 1 vote per user ID with instant vote replacement / retraction.
 * - Deterministic tie-breaking (order of first arrival, fallback to alphabetical).
 * - Tally tracking and round completion winner resolution.
 */

import type { PaletteId } from '../../src/state/types';

export const PALETTE_CHOICES: readonly PaletteId[] = [
  'blue-violet',
  'magenta-plum',
  'teal-cyan',
  'emerald-blue',
  'warm-amber',
  'soft-pastel',
] as const;

// Bilingual keyword alias map (normalized lowercase)
const ALIAS_MAP: Record<string, PaletteId> = {
  // Blue Violet
  'blue': 'blue-violet',
  'azul': 'blue-violet',
  'violet': 'blue-violet',
  'violeta': 'blue-violet',
  'blue-violet': 'blue-violet',

  // Magenta Plum
  'magenta': 'magenta-plum',
  'plum': 'magenta-plum',
  'pink': 'magenta-plum',
  'rosa': 'magenta-plum',
  'rosado': 'magenta-plum',
  'morado': 'magenta-plum',
  'magenta-plum': 'magenta-plum',

  // Teal Cyan
  'teal': 'teal-cyan',
  'cyan': 'teal-cyan',
  'turquesa': 'teal-cyan',
  'teal-cyan': 'teal-cyan',

  // Emerald Blue
  'emerald': 'emerald-blue',
  'esmeralda': 'emerald-blue',
  'green': 'emerald-blue',
  'verde': 'emerald-blue',
  'emerald-blue': 'emerald-blue',

  // Warm Amber
  'amber': 'warm-amber',
  'ambar': 'warm-amber',
  'orange': 'warm-amber',
  'naranja': 'warm-amber',
  'warm': 'warm-amber',
  'warm-amber': 'warm-amber',

  // Soft Pastel
  'pastel': 'soft-pastel',
  'soft': 'soft-pastel',
  'suave': 'soft-pastel',
  'soft-pastel': 'soft-pastel',
};

export interface VotingState {
  isActive: boolean;
  roundStartTime: number;
  durationMs: number;
  tallies: Record<PaletteId, number>;
  leader: PaletteId | null;
  totalVotes: number;
}

export class VotingEngine {
  private isActive = false;
  private roundStartTime = 0;
  private durationMs = 20_000;

  // User votes: userId -> current voted PaletteId
  private userVotes: Map<string, PaletteId> = new Map();

  // Tallies: PaletteId -> vote count
  private tallies: Record<PaletteId, number>;

  // Monotonic sequence counter for deterministic FIFO tie-breaking
  private arrivalSeq = 0;
  private firstReachedSeq: Map<string, number> = new Map();

  constructor(defaultDurationMs = 20_000) {
    this.durationMs = defaultDurationMs;
    this.tallies = this._createEmptyTallies();
  }

  /**
   * Resolves a raw string input to a known PaletteId using bilingual aliases.
   */
  static resolveChoice(input: string): PaletteId | null {
    const cleaned = input.toLowerCase().trim().replace(/[^a-z-]/g, '');
    return ALIAS_MAP[cleaned] ?? null;
  }

  startRound(durationMs = this.durationMs): void {
    this.isActive = true;
    this.roundStartTime = Date.now();
    this.durationMs = durationMs;
    this.userVotes.clear();
    this.firstReachedSeq.clear();
    this.arrivalSeq = 0;
    this.tallies = this._createEmptyTallies();
  }

  /**
   * Cast or replace a user vote.
   * Returns true if a valid vote was counted or changed, false otherwise.
   */
  vote(userId: string, rawInput: string): boolean {
    if (!this.isActive) return false;

    // Check round expiration
    if (Date.now() - this.roundStartTime >= this.durationMs) {
      this.isActive = false;
      return false;
    }

    const choice = VotingEngine.resolveChoice(rawInput);
    if (!choice) return false;

    const previousVote = this.userVotes.get(userId);
    if (previousVote === choice) {
      return false; // Same vote, no change
    }

    // If changing vote, decrement old tally
    if (previousVote) {
      this.tallies[previousVote] = Math.max(0, this.tallies[previousVote] - 1);
    }

    // Record new vote
    this.userVotes.set(userId, choice);
    const newCount = (this.tallies[choice] ?? 0) + 1;
    this.tallies[choice] = newCount;

    // Record strict arrival sequence for reaching this count
    const key = `${choice}:${newCount}`;
    if (!this.firstReachedSeq.has(key)) {
      this.firstReachedSeq.set(key, ++this.arrivalSeq);
    }

    return true;
  }

  getTallies(): Record<PaletteId, number> {
    return { ...this.tallies };
  }

  getTotalVotes(): number {
    return this.userVotes.size;
  }

  getLeader(): PaletteId | null {
    let maxVotes = 0;
    let leader: PaletteId | null = null;
    let leaderSeq = Infinity;

    for (const choice of PALETTE_CHOICES) {
      const votes = this.tallies[choice];
      if (votes > maxVotes) {
        maxVotes = votes;
        leader = choice;
        leaderSeq = this.firstReachedSeq.get(`${choice}:${votes}`) ?? Infinity;
      } else if (votes === maxVotes && maxVotes > 0) {
        // Deterministic tie-break: choice that reached maxVotes first in sequence wins
        const seq = this.firstReachedSeq.get(`${choice}:${votes}`) ?? Infinity;
        if (seq < leaderSeq || (seq === leaderSeq && choice < (leader ?? ''))) {
          leader = choice;
          leaderSeq = seq;
        }
      }
    }

    return maxVotes > 0 ? leader : null;
  }

  endRound(): PaletteId | null {
    const winner = this.getLeader();
    this.isActive = false;
    return winner;
  }

  getState(): VotingState {
    return {
      isActive: this.isActive,
      roundStartTime: this.roundStartTime,
      durationMs: this.durationMs,
      tallies: this.getTallies(),
      leader: this.getLeader(),
      totalVotes: this.getTotalVotes(),
    };
  }

  private _createEmptyTallies(): Record<PaletteId, number> {
    return {
      'blue-violet': 0,
      'magenta-plum': 0,
      'teal-cyan': 0,
      'emerald-blue': 0,
      'warm-amber': 0,
      'soft-pastel': 0,
    };
  }
}
