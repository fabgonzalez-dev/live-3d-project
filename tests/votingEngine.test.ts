import { describe, it, expect, beforeEach } from 'vitest';
import { VotingEngine } from '../server/engine/VotingEngine';

describe('VotingEngine', () => {
  let engine: VotingEngine;

  beforeEach(() => {
    engine = new VotingEngine(20_000);
  });

  describe('Bilingual Alias Mapping', () => {
    it('correctly maps English choices', () => {
      expect(VotingEngine.resolveChoice('blue')).toBe('blue-violet');
      expect(VotingEngine.resolveChoice('violet')).toBe('blue-violet');
      expect(VotingEngine.resolveChoice('pink')).toBe('magenta-plum');
      expect(VotingEngine.resolveChoice('teal')).toBe('teal-cyan');
      expect(VotingEngine.resolveChoice('emerald')).toBe('emerald-blue');
      expect(VotingEngine.resolveChoice('amber')).toBe('warm-amber');
      expect(VotingEngine.resolveChoice('pastel')).toBe('soft-pastel');
    });

    it('correctly maps Spanish aliases', () => {
      expect(VotingEngine.resolveChoice('azul')).toBe('blue-violet');
      expect(VotingEngine.resolveChoice('violeta')).toBe('blue-violet');
      expect(VotingEngine.resolveChoice('rosa')).toBe('magenta-plum');
      expect(VotingEngine.resolveChoice('morado')).toBe('magenta-plum');
      expect(VotingEngine.resolveChoice('turquesa')).toBe('teal-cyan');
      expect(VotingEngine.resolveChoice('verde')).toBe('emerald-blue');
      expect(VotingEngine.resolveChoice('esmeralda')).toBe('emerald-blue');
      expect(VotingEngine.resolveChoice('naranja')).toBe('warm-amber');
      expect(VotingEngine.resolveChoice('ambar')).toBe('warm-amber');
      expect(VotingEngine.resolveChoice('suave')).toBe('soft-pastel');
    });

    it('returns null for unrecognized choices', () => {
      expect(VotingEngine.resolveChoice('random_word')).toBeNull();
      expect(VotingEngine.resolveChoice('')).toBeNull();
    });
  });

  describe('Vote Replacement and Tallying', () => {
    it('allows a user to vote, and correctly decrements previous choice if they change their mind', () => {
      engine.startRound(20_000);

      // User 1 votes blue
      expect(engine.vote('user1', 'blue')).toBe(true);
      expect(engine.getTallies()['blue-violet']).toBe(1);
      expect(engine.getTallies()['magenta-plum']).toBe(0);
      expect(engine.getTotalVotes()).toBe(1);

      // User 1 changes mind to pink
      expect(engine.vote('user1', 'pink')).toBe(true);
      expect(engine.getTallies()['blue-violet']).toBe(0); // decremented!
      expect(engine.getTallies()['magenta-plum']).toBe(1);
      expect(engine.getTotalVotes()).toBe(1);

      // User 1 votes pink again (no-op)
      expect(engine.vote('user1', 'pink')).toBe(false);
      expect(engine.getTallies()['magenta-plum']).toBe(1);
      expect(engine.getTotalVotes()).toBe(1);
    });

    it('counts distinct users correctly', () => {
      engine.startRound(20_000);
      engine.vote('user1', 'azul');
      engine.vote('user2', 'blue');
      engine.vote('user3', 'verde');

      const tallies = engine.getTallies();
      expect(tallies['blue-violet']).toBe(2);
      expect(tallies['emerald-blue']).toBe(1);
      expect(engine.getTotalVotes()).toBe(3);
      expect(engine.getLeader()).toBe('blue-violet');
    });
  });

  describe('Deterministic Tie-Breaking', () => {
    it('breaks tie in favor of the choice that reached the tally first', () => {
      engine.startRound(20_000);

      // Teal reaches 1 first
      engine.vote('user1', 'teal');
      // Pink reaches 1 second
      engine.vote('user2', 'pink');

      expect(engine.getTallies()['teal-cyan']).toBe(1);
      expect(engine.getTallies()['magenta-plum']).toBe(1);

      // Teal reached 1 first, so teal wins tie
      expect(engine.getLeader()).toBe('teal-cyan');
    });
  });

  describe('Round Completion', () => {
    it('disallows voting when round is not active', () => {
      expect(engine.vote('user1', 'blue')).toBe(false);
    });

    it('returns the winning palette on endRound and deactivates', () => {
      engine.startRound(20_000);
      engine.vote('user1', 'amber');
      engine.vote('user2', 'amber');
      engine.vote('user3', 'blue');

      const winner = engine.endRound();
      expect(winner).toBe('warm-amber');
      expect(engine.getState().isActive).toBe(false);
    });
  });
});
