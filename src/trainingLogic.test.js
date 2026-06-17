import { describe, expect, it } from 'vitest';
import {
  calculateMissionProgress,
  getHeroRank,
  countRepTransition,
  calculateBattleDamage,
  calculateDistanceKm,
  updateRunTracker,
  landmarksToPoseMetrics,
} from './trainingLogic.js';

describe('hero progression logic', () => {
  it('calculates daily mission progress as a percentage capped at 100', () => {
    const progress = calculateMissionProgress({ pushups: 120, situps: 50, squats: 75, runKm: 2.5 });
    expect(progress).toEqual({ pushups: 100, situps: 50, squats: 75, runKm: 25, total: 63 });
  });

  it('starts missions from zero for a fresh workout session', () => {
    const progress = calculateMissionProgress({ pushups: 0, situps: 0, squats: 0, runKm: 0 });
    expect(progress).toEqual({ pushups: 0, situps: 0, squats: 0, runKm: 0, total: 0 });
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

  it('converts pose landmarks into pushup/squat metrics', () => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 1 }));
    lm[11] = { x: 0, y: 0, visibility: 1 }; // left shoulder
    lm[13] = { x: 1, y: 0, visibility: 1 }; // left elbow
    lm[15] = { x: 1, y: 1, visibility: 1 }; // left wrist
    lm[23] = { x: 0, y: 0.7, visibility: 1 }; // left hip
    lm[25] = { x: 0, y: 1.1, visibility: 1 }; // left knee
    lm[27] = { x: 0, y: 1.6, visibility: 1 }; // left ankle
    const metrics = landmarksToPoseMetrics(lm);
    expect(metrics.elbowAngle).toBeCloseTo(90, 0);
    expect(metrics.hipBelowKnee).toBe(false);
    expect(metrics.visible).toBe(true);
  });

  it('scales battle damage with combo and form quality', () => {
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'clean' })).toBe(17);
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'weak-form' })).toBe(4);
  });
});

describe('10km GPS run tracking', () => {
  it('calculates distance between GPS points in kilometers', () => {
    const km = calculateDistanceKm(
      { latitude: 45.4215, longitude: -75.6972 },
      { latitude: 45.4315, longitude: -75.6972 },
    );
    expect(km).toBeGreaterThan(1.10);
    expect(km).toBeLessThan(1.13);
  });

  it('ignores inaccurate or unrealistic GPS jumps', () => {
    const tracker = { distanceKm: 0, lastPoint: { latitude: 45, longitude: -75, timestamp: 0 } };
    const inaccurate = updateRunTracker(tracker, { latitude: 45.01, longitude: -75, accuracy: 250, timestamp: 60_000 });
    expect(inaccurate.distanceKm).toBe(0);

    const jump = updateRunTracker(tracker, { latitude: 46, longitude: -75, accuracy: 12, timestamp: 1_000 });
    expect(jump.distanceKm).toBe(0);
  });

  it('accumulates valid GPS movement toward 10km', () => {
    let tracker = { distanceKm: 0, lastPoint: null };
    tracker = updateRunTracker(tracker, { latitude: 45, longitude: -75, accuracy: 10, timestamp: 0 });
    tracker = updateRunTracker(tracker, { latitude: 45.009, longitude: -75, accuracy: 8, timestamp: 8 * 60_000 });
    expect(tracker.distanceKm).toBeGreaterThan(0.99);
    expect(tracker.progress).toBe(10);
  });
});
