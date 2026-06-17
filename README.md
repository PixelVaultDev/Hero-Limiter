# Hero Limiter

A cinematic anime-inspired fitness app prototype where workouts become hero missions, monster battles, combo streaks, XP, and rank progression.

## MVP in this repo

- Premium mobile-first landing/dashboard UI
- Animated phone mockup with original hero avatar artwork
- Daily mission tracker starts from zero: pushups, situps, squats, 10km run
- Monster battle health, combo meter, Serious Meter, hit animations
- Manual rep counting MVP button
- Browser camera pushup/squat rep counter using MediaPipe Pose Landmarker
- GPS 10km run tracker using the browser Geolocation API
- Tested rank, mission progress, rep-transition, pose-metric, battle-damage, and GPS-distance logic

## Why not use official One Punch Man branding?

The app is inspired by the general training/anime progression idea, but uses original naming, UI, and art to avoid copyrighted characters, names, and logos.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

## Future camera counting direction

Use MediaPipe Pose landmarks:

- Pushups: shoulder, elbow, wrist, hip alignment; count top → bottom → top transitions.
- Squats: hip, knee, ankle depth; count standing → depth → standing transitions.
- Bad form creates weak hits instead of counting fake progress.

The tested `src/trainingLogic.js` functions are the first layer for this behavior.
