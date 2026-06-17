export const DAILY_TARGETS = {
  pushups: 100,
  situps: 100,
  squats: 100,
  runKm: 10,
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

export function calculateMissionProgress(values) {
  const pushups = pct(values.pushups ?? 0, DAILY_TARGETS.pushups);
  const situps = pct(values.situps ?? 0, DAILY_TARGETS.situps);
  const squats = pct(values.squats ?? 0, DAILY_TARGETS.squats);
  const runKm = pct(values.runKm ?? 0, DAILY_TARGETS.runKm);
  return {
    pushups,
    situps,
    squats,
    runKm,
    total: Math.round((pushups + situps + squats + runKm) / 4),
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
  if (exercise === 'pushup') return countPushup(state, pose);
  if (exercise === 'squat') return countSquat(state, pose);
  return { ...state, quality: 'unsupported' };
}

function countPushup(state, pose) {
  const bottom = pose.elbowAngle <= 90;
  const top = pose.elbowAngle >= 155;
  const weakForm = pose.hipDrop > 0.18;

  if (state.phase === 'top' && bottom) {
    return { ...state, phase: 'bottom', quality: weakForm ? 'weak-form' : 'loaded' };
  }

  if (state.phase === 'bottom' && top) {
    if (state.quality === 'weak-form' || weakForm) {
      return { phase: 'top', reps: state.reps, quality: 'weak-form' };
    }
    return { phase: 'top', reps: state.reps + 1, quality: 'clean' };
  }

  return { ...state, quality: weakForm ? 'weak-form' : state.quality ?? 'tracking' };
}

function countSquat(state, pose) {
  const bottom = pose.hipBelowKnee || pose.kneeAngle <= 95;
  const top = pose.kneeAngle >= 160 && !pose.hipBelowKnee;

  if (state.phase === 'top' && bottom) {
    return { ...state, phase: 'bottom', quality: 'loaded' };
  }

  if (state.phase === 'bottom' && top) {
    return { phase: 'top', reps: state.reps + 1, quality: 'clean' };
  }

  return { ...state, quality: state.quality ?? 'tracking' };
}

export function calculateBattleDamage({ base = 10, combo = 0, quality = 'clean' }) {
  if (quality === 'weak-form') return Math.max(1, Math.round(base * 0.4));
  const comboBonus = Math.min(18, combo);
  return Math.round(base + comboBonus);
}
