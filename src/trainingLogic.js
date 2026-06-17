export const DAILY_TARGETS = {
  pushups: 100,
  situps: 100,
  squats: 100,
  steps: 10000,
};

export const RANKS = [
  { rank: 'Civilian', min: 0, next: 100 },
  { rank: 'C-Class Hero', min: 100, next: 600 },
  { rank: 'B-Class Hero', min: 600, next: 1200 },
  { rank: 'A-Class Hero', min: 1200, next: 2000 },
  { rank: 'S-Class Hero', min: 2000, next: 2500 },
  { rank: 'Limiter Breaker', min: 2500, next: 2500 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pct = (value, target) => Math.round(clamp((value / target) * 100, 0, 100));
const STABLE_REP_FRAMES = 3;
const STEP_PEAK_THRESHOLD = 0.85;
const STEP_RESET_THRESHOLD = 0.18;
const MAX_SHAKE_PULSE = 3.2;
const MIN_WALK_STEP_INTERVAL_MS = 330;
const MAX_WALK_STEP_INTERVAL_MS = 950;
const WALK_LOCK_SEQUENCE = 4;
const MAX_CADENCE_VARIATION = 0.28;

export function calculateMissionProgress(values) {
  const pushups = pct(values.pushups ?? 0, DAILY_TARGETS.pushups);
  const situps = pct(values.situps ?? 0, DAILY_TARGETS.situps);
  const squats = pct(values.squats ?? 0, DAILY_TARGETS.squats);
  const steps = pct(values.steps ?? 0, DAILY_TARGETS.steps);
  return {
    pushups,
    situps,
    squats,
    steps,
    total: Math.round((pushups + situps + squats + steps) / 4),
  };
}

export function getHeroRank(xp) {
  const current = [...RANKS].reverse().find((rank) => xp >= rank.min) ?? RANKS[0];
  const next = RANKS.find((rank) => rank.min === current.next);
  if (!next) {
    return { rank: current.rank, nextRank: 'Max Rank', progress: 100, xpToNext: 0 };
  }
  const span = next.min - current.min;
  const progress = Math.round(clamp(((xp - current.min) / span) * 100, 0, 100));
  return {
    rank: current.rank,
    nextRank: next.rank,
    progress,
    xpToNext: Math.max(0, next.min - xp),
  };
}

export function countRepTransition(exercise, state, pose) {
  if (pose?.visible === false) return resetCandidate(state, 'not-visible');
  if (pose?.poseConfidence < 0.55) return resetCandidate(state, 'low-confidence');
  if (exercise === 'pushup') return countPushup(state, pose);
  if (exercise === 'squat') return countSquat(state, pose);
  if (exercise === 'situp') return countSitup(state, pose);
  return { ...state, quality: 'unsupported' };
}

function resetCandidate(state, quality) {
  return { ...state, candidate: null, candidateFrames: 0, quality };
}

function stableTransition(state, targetPhase, quality, { addRep = false, weakForm = false } = {}) {
  const candidateFrames = state.candidate === targetPhase ? (state.candidateFrames ?? 0) + 1 : 1;
  if (candidateFrames < STABLE_REP_FRAMES) {
    return { ...state, candidate: targetPhase, candidateFrames, quality: quality === 'clean' ? 'stabilizing' : quality };
  }

  if (weakForm) {
    return { phase: targetPhase, reps: state.reps, quality: 'weak-form', candidate: null, candidateFrames: 0 };
  }

  return {
    phase: targetPhase,
    reps: state.reps + (addRep ? 1 : 0),
    quality,
    candidate: null,
    candidateFrames: 0,
  };
}

function countPushup(state, pose) {
  const bottom = pose.elbowAngle <= 90;
  const top = pose.elbowAngle >= 155;
  const weakForm = pose.hipDrop > 0.18;

  if (state.phase === 'top' && bottom) {
    return stableTransition(state, 'bottom', weakForm ? 'weak-form' : 'loaded');
  }

  if (state.phase === 'bottom' && top) {
    return stableTransition(state, 'top', 'clean', {
      addRep: true,
      weakForm: state.quality === 'weak-form' || weakForm,
    });
  }

  return resetCandidate(state, weakForm ? 'weak-form' : state.quality ?? 'tracking');
}

function countSquat(state, pose) {
  const bottom = pose.hipBelowKnee && pose.kneeAngle <= 105;
  const top = pose.kneeAngle >= 160 && !pose.hipBelowKnee;

  if (state.phase === 'top' && bottom) {
    return stableTransition(state, 'bottom', 'loaded');
  }

  if (state.phase === 'bottom' && top) {
    return stableTransition(state, 'top', 'clean', { addRep: true });
  }

  return resetCandidate(state, state.quality ?? 'tracking');
}

function countSitup(state, pose) {
  const lyingBack = pose.torsoAngle >= 135;
  const seatedUp = pose.torsoAngle <= 105;

  if (state.phase === 'top' && lyingBack) {
    return stableTransition(state, 'bottom', 'loaded');
  }

  if (state.phase === 'bottom' && seatedUp) {
    return stableTransition(state, 'top', 'clean', { addRep: true });
  }

  return resetCandidate(state, state.quality ?? 'tracking');
}

export function calculateBattleDamage({ base = 10, combo = 0, quality = 'clean' }) {
  if (quality === 'weak-form') return Math.max(1, Math.round(base * 0.4));
  const comboBonus = Math.min(18, combo);
  return Math.round(base + comboBonus);
}

export function angleBetween(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magA = Math.hypot(ab.x, ab.y);
  const magC = Math.hypot(cb.x, cb.y);
  if (!magA || !magC) return 180;
  const cosine = clamp(dot / (magA * magC), -1, 1);
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

function averagePoint(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function getVisible(landmarks, leftIndex, rightIndex) {
  const left = landmarks?.[leftIndex];
  const right = landmarks?.[rightIndex];
  const best = [left, right].filter(Boolean).sort((a, b) => (b.visibility ?? 1) - (a.visibility ?? 1))[0];
  return best ?? { x: 0, y: 0, visibility: 0 };
}

function isVisible(point, threshold = 0.35) {
  return (point?.visibility ?? 1) > threshold;
}

function exercisePoints(exercise, points) {
  const { shoulder, elbow, wrist, hip, knee, ankle } = points;
  if (exercise === 'pushup') return [shoulder, elbow, wrist, hip];
  if (exercise === 'situp') return [shoulder, hip, knee];
  if (exercise === 'squat') return [hip, knee, ankle];
  return [shoulder, elbow, wrist, hip, knee, ankle];
}

function poseSpan(points) {
  const xs = points.map((point) => point.x ?? 0);
  const ys = points.map((point) => point.y ?? 0);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function poseConfidence(points) {
  return points.reduce((sum, point) => sum + (point.visibility ?? 1), 0) / points.length;
}

function exerciseVisibility(exercise, points) {
  const requiredPoints = exercisePoints(exercise, points);
  return requiredPoints.every((point) => isVisible(point, 0.5)) && poseSpan(requiredPoints) >= 0.12;
}

export function landmarksToPoseMetrics(landmarks = [], exercise = 'all') {
  const shoulder = getVisible(landmarks, 11, 12);
  const elbow = getVisible(landmarks, 13, 14);
  const wrist = getVisible(landmarks, 15, 16);
  const hip = getVisible(landmarks, 23, 24);
  const knee = getVisible(landmarks, 25, 26);
  const ankle = getVisible(landmarks, 27, 28);
  const shoulderMid = averagePoint(landmarks[11], landmarks[12]) ?? shoulder;
  const hipMid = averagePoint(landmarks[23], landmarks[24]) ?? hip;
  const kneeMid = averagePoint(landmarks[25], landmarks[26]) ?? knee;

  const points = { shoulder, elbow, wrist, hip, knee, ankle };
  const requiredPoints = exercisePoints(exercise, points);
  const visible = exerciseVisibility(exercise, points);
  const confidence = poseConfidence(requiredPoints);
  const elbowAngle = angleBetween(shoulder, elbow, wrist);
  const kneeAngle = angleBetween(hip, knee, ankle);
  const torsoAngle = angleBetween(shoulderMid, hipMid, kneeMid);
  const hipBelowKnee = hipMid.y > kneeMid.y;
  const torsoSlope = Math.abs((hipMid.y ?? hip.y) - (shoulderMid.y ?? shoulder.y));
  const hipDrop = Math.max(0, torsoSlope - 0.35);

  return { elbowAngle, kneeAngle, torsoAngle, hipBelowKnee, hipDrop, visible, poseConfidence: confidence };
}

export function createStepTracker(initialSteps = 0) {
  return {
    steps: clamp(Math.round(initialSteps), 0, DAILY_TARGETS.steps),
    smoothMagnitude: null,
    previousMagnitude: null,
    lastPeakAt: null,
    lastStepAt: 0,
    candidateStepTimes: [],
    walkLocked: false,
    armed: true,
    progress: pct(initialSteps, DAILY_TARGETS.steps),
    quality: 'step-ready',
  };
}

function hasStableWalkingCadence(times) {
  if (times.length < WALK_LOCK_SEQUENCE) return false;
  const intervals = times.slice(1).map((time, index) => time - times[index]);
  if (intervals.some((interval) => interval < MIN_WALK_STEP_INTERVAL_MS || interval > MAX_WALK_STEP_INTERVAL_MS)) return false;

  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  return intervals.every((interval) => Math.abs(interval - average) / average <= MAX_CADENCE_VARIATION);
}

function resetWalkingCandidates(tracker, quality, smoothMagnitude, magnitude, pulse) {
  return {
    ...tracker,
    smoothMagnitude,
    previousMagnitude: magnitude,
    candidateStepTimes: [],
    walkLocked: false,
    armed: pulse <= STEP_RESET_THRESHOLD ? true : false,
    progress: pct(tracker.steps ?? 0, DAILY_TARGETS.steps),
    quality,
    pulse,
  };
}

export function updateStepTracker(tracker, sample) {
  const safeTracker = tracker ?? createStepTracker();
  const acceleration = sample?.accelerationIncludingGravity ?? sample?.acceleration;
  const timestamp = sample?.timestamp ?? Date.now();

  if (!acceleration || !Number.isFinite(acceleration.x) || !Number.isFinite(acceleration.y) || !Number.isFinite(acceleration.z)) {
    return { ...safeTracker, quality: 'step-no-motion' };
  }

  const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  const previousSmooth = safeTracker.smoothMagnitude ?? magnitude;
  const smoothMagnitude = previousSmooth * 0.86 + magnitude * 0.14;
  const pulse = magnitude - smoothMagnitude;
  const previousMagnitude = safeTracker.previousMagnitude ?? magnitude;
  const magnitudeJump = Math.abs(magnitude - previousMagnitude);
  const stepInterval = safeTracker.lastPeakAt ? timestamp - safeTracker.lastPeakAt : null;
  const armed = pulse <= STEP_RESET_THRESHOLD ? true : safeTracker.armed;

  if (pulse > MAX_SHAKE_PULSE || magnitudeJump > MAX_SHAKE_PULSE * 1.6) {
    return resetWalkingCandidates(safeTracker, 'step-shake-rejected', smoothMagnitude, magnitude, pulse);
  }

  const isPeak = armed && pulse >= STEP_PEAK_THRESHOLD;
  if (!isPeak) {
    const waitingTooLong = safeTracker.lastPeakAt && timestamp - safeTracker.lastPeakAt > MAX_WALK_STEP_INTERVAL_MS;
    return {
      ...safeTracker,
      smoothMagnitude,
      previousMagnitude: magnitude,
      candidateStepTimes: waitingTooLong ? [] : safeTracker.candidateStepTimes ?? [],
      walkLocked: waitingTooLong ? false : safeTracker.walkLocked ?? false,
      armed,
      progress: pct(safeTracker.steps ?? 0, DAILY_TARGETS.steps),
      quality: waitingTooLong ? 'step-waiting' : 'step-tracking',
      pulse,
    };
  }

  if (stepInterval !== null && (stepInterval < MIN_WALK_STEP_INTERVAL_MS || stepInterval > MAX_WALK_STEP_INTERVAL_MS)) {
    return resetWalkingCandidates(safeTracker, 'step-shake-rejected', smoothMagnitude, magnitude, pulse);
  }

  const candidateStepTimes = [...(safeTracker.candidateStepTimes ?? []), timestamp].slice(-WALK_LOCK_SEQUENCE);
  const wasLocked = safeTracker.walkLocked ?? false;
  const cadenceLocked = wasLocked || hasStableWalkingCadence(candidateStepTimes);
  const stepsToAdd = wasLocked ? 1 : cadenceLocked ? candidateStepTimes.length : 0;

  if (stepsToAdd > 0) {
    const steps = Math.min(DAILY_TARGETS.steps, (safeTracker.steps ?? 0) + stepsToAdd);
    return {
      ...safeTracker,
      steps,
      smoothMagnitude,
      previousMagnitude: magnitude,
      lastPeakAt: timestamp,
      lastStepAt: timestamp,
      candidateStepTimes,
      walkLocked: true,
      armed: false,
      progress: pct(steps, DAILY_TARGETS.steps),
      quality: 'step-counted',
      pulse,
    };
  }

  return {
    ...safeTracker,
    smoothMagnitude,
    previousMagnitude: magnitude,
    lastPeakAt: timestamp,
    candidateStepTimes,
    walkLocked: false,
    armed: false,
    progress: pct(safeTracker.steps ?? 0, DAILY_TARGETS.steps),
    quality: 'step-seeking-cadence',
    pulse,
  };
}

export function calculateDistanceKm(a, b) {
  if (!a || !b) return 0;
  const radiusKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
