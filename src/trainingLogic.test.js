import { describe, expect, it } from 'vitest';
import {
  calculateMissionProgress,
  getHeroRank,
  countRepTransition,
  calculateBattleDamage,
  calculateDistanceKm,
  createStepTracker,
  updateStepTracker,
  landmarksToPoseMetrics,
} from './trainingLogic.js';

describe('hero progression logic', () => {
  it('calculates daily mission progress as a percentage capped at 100', () => {
    const progress = calculateMissionProgress({ pushups: 120, situps: 50, squats: 75, steps: 2500 });
    expect(progress).toEqual({ pushups: 100, situps: 50, squats: 75, steps: 25, total: 63 });
  });

  it('starts missions from zero for a fresh workout session', () => {
    const progress = calculateMissionProgress({ pushups: 0, situps: 0, squats: 0, steps: 0 });
    expect(progress).toEqual({ pushups: 0, situps: 0, squats: 0, steps: 0, total: 0 });
  });

  it('maps XP to hero ranks with clear next-rank targets', () => {
    expect(getHeroRank(0)).toMatchObject({ rank: 'Civilian', nextRank: 'C-Class Hero', progress: 0 });
    expect(getHeroRank(450)).toMatchObject({ rank: 'C-Class Hero', nextRank: 'B-Class Hero', progress: 70 });
    expect(getHeroRank(2100)).toMatchObject({ rank: 'S-Class Hero', nextRank: 'Limiter Breaker', progress: 20 });
  });
});

describe('rep transition logic', () => {
  it('counts one pushup after stable top-bottom-top movement', () => {
    let state = { phase: 'top', reps: 0 };
    state = countRepTransition('pushup', state, { elbowAngle: 72, hipDrop: 0.04, poseConfidence: 0.9 });
    expect(state.reps).toBe(0);
    state = countRepTransition('pushup', state, { elbowAngle: 72, hipDrop: 0.04, poseConfidence: 0.9 });
    expect(state.phase).toBe('bottom');
    state = countRepTransition('pushup', state, { elbowAngle: 166, hipDrop: 0.03, poseConfidence: 0.9 });
    expect(state.reps).toBe(0);
    state = countRepTransition('pushup', state, { elbowAngle: 166, hipDrop: 0.03, poseConfidence: 0.9 });
    expect(state).toMatchObject({ phase: 'top', reps: 1, quality: 'clean' });
  });

  it('counts a real-world pushup when arm angles are less than perfect side-view angles', () => {
    let state = { phase: 'top', reps: 0 };
    for (let i = 0; i < 2; i += 1) state = countRepTransition('pushup', state, { elbowAngle: 118, hipDrop: 0.05, poseConfidence: 0.82 });
    expect(state).toMatchObject({ phase: 'bottom', reps: 0 });
    for (let i = 0; i < 2; i += 1) state = countRepTransition('pushup', state, { elbowAngle: 145, hipDrop: 0.04, poseConfidence: 0.82 });
    expect(state).toMatchObject({ phase: 'top', reps: 1, quality: 'clean' });
  });

  it('rejects a pushup with sagging hips as a weak rep', () => {
    let state = { phase: 'top', reps: 0 };
    for (let i = 0; i < 3; i += 1) state = countRepTransition('pushup', state, { elbowAngle: 70, hipDrop: 0.24, poseConfidence: 0.9 });
    for (let i = 0; i < 3; i += 1) state = countRepTransition('pushup', state, { elbowAngle: 165, hipDrop: 0.22, poseConfidence: 0.9 });
    expect(state).toMatchObject({ phase: 'top', reps: 0, quality: 'weak-form' });
  });

  it('counts one squat when hips reach depth then return standing', () => {
    let state = { phase: 'top', reps: 4 };
    for (let i = 0; i < 3; i += 1) state = countRepTransition('squat', state, { kneeAngle: 82, hipBelowKnee: true, poseConfidence: 0.9 });
    for (let i = 0; i < 3; i += 1) state = countRepTransition('squat', state, { kneeAngle: 171, hipBelowKnee: false, poseConfidence: 0.9 });
    expect(state).toMatchObject({ phase: 'top', reps: 5, quality: 'clean' });
  });

  it('counts a real-world squat when hips get near knee height without perfect camera depth', () => {
    let state = { phase: 'top', reps: 0 };
    for (let i = 0; i < 2; i += 1) state = countRepTransition('squat', state, { kneeAngle: 122, hipBelowKnee: false, hipKneeGap: 0.12, poseConfidence: 0.82 });
    expect(state).toMatchObject({ phase: 'bottom', reps: 0 });
    for (let i = 0; i < 2; i += 1) state = countRepTransition('squat', state, { kneeAngle: 152, hipBelowKnee: false, hipKneeGap: 0.48, poseConfidence: 0.82 });
    expect(state).toMatchObject({ phase: 'top', reps: 1, quality: 'clean' });
  });

  it('does not count jogging-in-place knee lifts as squats', () => {
    let state = { phase: 'top', reps: 0 };
    for (let i = 0; i < 3; i += 1) state = countRepTransition('squat', state, { kneeAngle: 82, hipBelowKnee: false, hipKneeGap: 0.55, poseConfidence: 0.9 });
    for (let i = 0; i < 3; i += 1) state = countRepTransition('squat', state, { kneeAngle: 171, hipBelowKnee: false, hipKneeGap: 0.55, poseConfidence: 0.9 });
    expect(state).toMatchObject({ phase: 'top', reps: 0 });
  });

  it('counts one situp when user lies back then sits up', () => {
    let state = { phase: 'top', reps: 0 };
    for (let i = 0; i < 3; i += 1) state = countRepTransition('situp', state, { torsoAngle: 152, poseConfidence: 0.9 });
    for (let i = 0; i < 3; i += 1) state = countRepTransition('situp', state, { torsoAngle: 88, poseConfidence: 0.9 });
    expect(state).toMatchObject({ phase: 'top', reps: 1, quality: 'clean' });
  });

  it('converts pose landmarks into pushup/squat/situp metrics', () => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 1 }));
    lm[11] = { x: 0, y: 0, visibility: 1 }; // left shoulder
    lm[13] = { x: 1, y: 0, visibility: 1 }; // left elbow
    lm[15] = { x: 1, y: 1, visibility: 1 }; // left wrist
    lm[23] = { x: 0, y: 0.7, visibility: 1 }; // left hip
    lm[25] = { x: 0, y: 1.1, visibility: 1 }; // left knee
    lm[27] = { x: 0, y: 1.6, visibility: 1 }; // left ankle
    const metrics = landmarksToPoseMetrics(lm);
    expect(metrics.elbowAngle).toBeCloseTo(90, 0);
    expect(metrics.torsoAngle).toBeGreaterThan(150);
    expect(metrics.hipBelowKnee).toBe(false);
    expect(metrics.visible).toBe(true);
  });

  it('ignores a single noisy pushup-like frame', () => {
    let state = { phase: 'top', reps: 0 };
    state = countRepTransition('pushup', state, { elbowAngle: 72, hipDrop: 0.04, poseConfidence: 0.9 });
    state = countRepTransition('pushup', state, { elbowAngle: 166, hipDrop: 0.03, poseConfidence: 0.9 });
    expect(state.reps).toBe(0);
  });

  it('does not require feet to be visible for pushup tracking', () => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    lm[11] = { x: 0, y: 0, visibility: 0.4 };
    lm[13] = { x: 1, y: 0, visibility: 0.4 };
    lm[15] = { x: 1, y: 1, visibility: 0.4 };
    lm[23] = { x: 0, y: 0.45, visibility: 0.4 };
    lm[25] = { x: 0, y: 0.8, visibility: 0 };
    lm[27] = { x: 0, y: 1.1, visibility: 0 };
    expect(landmarksToPoseMetrics(lm, 'pushup').visible).toBe(true);
    expect(landmarksToPoseMetrics(lm, 'squat').visible).toBe(false);
  });

  it('converts pose landmarks into forgiving squat depth metrics', () => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    lm[23] = { x: 0, y: 0.62, visibility: 0.4 };
    lm[24] = { x: 0.12, y: 0.62, visibility: 0.4 };
    lm[25] = { x: 0, y: 0.72, visibility: 0.4 };
    lm[26] = { x: 0.12, y: 0.72, visibility: 0.4 };
    lm[27] = { x: 0.02, y: 1, visibility: 0.4 };
    lm[28] = { x: 0.14, y: 1, visibility: 0.4 };
    const metrics = landmarksToPoseMetrics(lm, 'squat');
    expect(metrics.visible).toBe(true);
    expect(metrics.hipKneeGap).toBeCloseTo(0.1, 1);
  });

  it('scales battle damage with combo and form quality', () => {
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'clean' })).toBe(17);
    expect(calculateBattleDamage({ base: 10, combo: 7, quality: 'weak-form' })).toBe(4);
  });
});

describe('10k step tracking', () => {
  it('tracks 10k steps as the fourth daily mission', () => {
    const progress = calculateMissionProgress({ pushups: 0, situps: 0, squats: 0, steps: 1000 });
    expect(progress.steps).toBe(10);
    expect(progress.total).toBe(3);
  });

  it('counts only after a real walking cadence is established', () => {
    let tracker = createStepTracker();
    const walkingSamples = [
      [0, 9.8],
      [420, 11.25],
      [620, 9.82],
      [840, 11.3],
      [1040, 9.78],
      [1260, 11.22],
      [1460, 9.82],
      [1680, 11.28],
    ];

    for (const [timestamp, z] of walkingSamples) {
      tracker = updateStepTracker(tracker, { timestamp, accelerationIncludingGravity: { x: 0.25, y: 0.12, z } });
    }

    expect(tracker.steps).toBe(4);
    expect(tracker.quality).toBe('step-counted');
  });

  it('continues counting a normal walking rhythm after the first four steps', () => {
    let tracker = createStepTracker();
    const walkingSamples = Array.from({ length: 24 }, (_, index) => [
      index * 220,
      index % 2 === 0 ? 9.9 : 11.15,
    ]);

    for (const [timestamp, z] of walkingSamples) {
      tracker = updateStepTracker(tracker, { timestamp, accelerationIncludingGravity: { x: 0.25, y: 0.12, z } });
    }

    expect(tracker.steps).toBeGreaterThanOrEqual(10);
    expect(tracker.quality).toBe('step-counted');
  });

  it('rejects erratic phone shaking instead of counting it as walking', () => {
    let tracker = createStepTracker();
    const shakeSamples = [
      [0, { x: 0, y: 0, z: 9.8 }],
      [180, { x: 4.4, y: -5.1, z: 13.9 }],
      [260, { x: -6.2, y: 4.8, z: 6.4 }],
      [430, { x: 5.9, y: -4.6, z: 14.5 }],
      [510, { x: -5.8, y: 5.2, z: 6.1 }],
      [690, { x: 6.6, y: -5.4, z: 15.1 }],
      [760, { x: -6.4, y: 5.1, z: 5.9 }],
      [940, { x: 5.7, y: -4.9, z: 14.7 }],
    ];

    for (const [timestamp, accelerationIncludingGravity] of shakeSamples) {
      tracker = updateStepTracker(tracker, { timestamp, accelerationIncludingGravity });
    }

    expect(tracker.steps).toBe(0);
    expect(tracker.quality).toBe('step-shake-rejected');
  });

  it('does not count the first isolated motion peak after the tracker has been open for several seconds', () => {
    let tracker = createStepTracker();
    tracker = updateStepTracker(tracker, { timestamp: 5000, accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 } });
    tracker = updateStepTracker(tracker, { timestamp: 5380, accelerationIncludingGravity: { x: 0, y: 0, z: 12.2 } });
    expect(tracker.steps).toBe(0);
    expect(tracker.quality).toBe('step-seeking-cadence');
  });

  it('caps step progress at the 10k daily target', () => {
    const tracker = {
      ...createStepTracker(9999),
      smoothMagnitude: 9.8,
      previousMagnitude: 9.8,
      lastPeakAt: 0,
      candidateStepTimes: [0, 420, 840, 1260],
      walkLocked: true,
      armed: true,
    };
    const updated = updateStepTracker(tracker, { timestamp: 500, accelerationIncludingGravity: { x: 0, y: 0, z: 12.2 } });
    expect(updated.steps).toBe(10000);
    expect(updated.progress).toBe(100);
  });

  it('still exposes GPS distance helper for future distance estimates', () => {
    const km = calculateDistanceKm(
      { latitude: 45.4215, longitude: -75.6972 },
      { latitude: 45.4315, longitude: -75.6972 },
    );
    expect(km).toBeGreaterThan(1.10);
    expect(km).toBeLessThan(1.13);
  });
});
