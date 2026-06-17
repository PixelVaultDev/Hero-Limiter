# Hero Protocol by LifeOfJohnHa

A cinematic anime-inspired fitness app prototype where workouts become daily hero protocols with clean rep tracking, voice count, step tracking, XP, and rank progression.

## MVP in this repo

- Premium mobile-first dashboard UI
- Daily mission tracker starts from zero: pushups, situps, squats, 10k steps
- Browser camera pushup/squat/situp rep counter using MediaPipe Pose Landmarker
- Voice count toggle for reps using browser speech synthesis
- Motion-based 10k step tracker using browser `devicemotion` events
- Manual fallback buttons for reps and steps
- Tested rank, mission progress, rep-transition, pose-metric, battle-damage, GPS-distance helper, and step-counting logic

## Why not use official One Punch Man branding?

The app is inspired by the general training/anime progression idea, but uses original naming, UI, and art to avoid copyrighted characters, names, and logos.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

## Tracking notes

- Camera tracking needs HTTPS and works best when the needed joints are visible.
- Step tracking uses phone motion sensors, so it needs a supported mobile browser, permission on iOS, and the page open while walking.
- Manual fallback is kept for poor lighting, blocked sensors, or desktop testing.
