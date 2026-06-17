import { describe, expect, it } from 'vitest';
import {
  calculateMissionProgress,
  getHeroRank,
  countRepTransition,
  calculateBattleDamage,
} from './trainingLogic.js';

describe('hero progression logic', () => {
  it('calculates daily mission progress as a percentage capped at 100', () => {
    const progress = calculateMissionProgress({ pushups: 120, situps: 50, squats: 75, runKm: 2.5 });
    expect(progress).toEqual({ pushups: 100, situps: 50, squats: 75, runKm: 25, total: 63 });
  });

  it('maps XP to hero ranks with clear next-rank targets', () => {
    expect(getHeroRank(0)).toMatchObject({ rank: 'Civilian', nextRank: 'C-Class Hero', progress: 0 });
    expect(getHeroRank(450)).toMatchObject({ rank: 'C-Class Hero', nextRank: 'B-Class Hero', progress: 70 });
    expect(getHeroRank(2100)).toMatchObject({ rank: 'S-Class Hero', nextRank: 'Limiter Breaker', progress: 20 });
  });
});

describe('rep transition logic', () => {
  it('counts one pushup when movement completes top to bottom to top', () => {
    let state = { phase: 'top', reps: 0 };
    state = countRepTransition('pushup', state, { elbowAngle: 72, hipDrop: 0.04 });
    state = countRepTransition('pushup', state, { elbowAngle: 166, hipDrop: 0.03 });
    expect(state).toEqual({ phase: 'top', reps: 1, quality: 'clean' });
  });

  it('rejects a pushup with sagging hips as a weak rep', () => {
    let state = { phase: 'top', reps: 0 };
    state = countRepTransition('pushup', state, { elbowAngle: 70, hipDrop: 0.24 });
    state = countRepTransition('pushup', state, { elbowAngle: 165, hipDrop: 0.22 });
    expect(state).toEqual({ phase: 'top', reps: 0, quality: 'weak-form' });
  });

  it('counts one squat when hips reach depth then return standing', () => {
    let state = { phase: 'top', reps: 4 };
    state = countRepTransition('squat', state, { kneeAngle: 82, hipBelowKnee: true });
    state = countRepTransition('squat', state, { kneeAngle: 171, hipBelowKnee: false });
    expect(state).toEqual({ phase: 'top', reps: 5, quality: 'clean' });
  });

  it('scales battle damage with combo and form quality', () => {
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'clean' })).toBe(17);
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'weak-form' })).toBe(4);
  });
});
