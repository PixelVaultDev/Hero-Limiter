import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  ClipboardList,
  Dumbbell,
  Flame,
  Home,
  Lock,
  MapPin,
  Menu,
  Package,
  Play,
  Shield,
  Skull,
  Swords,
  User,
  Zap,
} from 'lucide-react';
import {
  calculateBattleDamage,
  calculateMissionProgress,
  getHeroRank,
  countRepTransition,
  landmarksToPoseMetrics,
  updateRunTracker,
} from './trainingLogic.js';

const missions = [
  { key: 'pushups', label: 'Pushups', target: 100, valueLabel: '42 / 100', icon: 'pushup' },
  { key: 'situps', label: 'Situps', target: 100, valueLabel: '35 / 100', icon: 'situp' },
  { key: 'squats', label: 'Squats', target: 100, valueLabel: '60 / 100', icon: 'squat' },
  { key: 'runKm', label: 'Run', target: 10, valueLabel: '2.4 / 10 km', icon: 'run' },
];

const initialStats = {
  pushups: 0,
  situps: 0,
  squats: 0,
  runKm: 0,
  xp: 0,
  combo: 0,
  streak: 0,
  enemyHp: 100,
};

function App() {
  const [stats, setStats] = useState(initialStats);
  const [activeMission, setActiveMission] = useState('pushups');
  const [hitBurst, setHitBurst] = useState(0);
  const progress = useMemo(() => calculateMissionProgress(stats), [stats]);
  const rank = useMemo(() => getHeroRank(stats.xp), [stats.xp]);

  function addRep(exercise = activeMission, quality = 'clean') {
    const damage = calculateBattleDamage({ base: 7, combo: stats.combo, quality });
    setStats((current) => ({
      ...current,
      [exercise]: exercise === 'runKm' ? +(current.runKm + 0.25).toFixed(2) : current[exercise] + 1,
      combo: quality === 'clean' ? current.combo + 1 : current.combo,
      xp: quality === 'clean' ? current.xp + 9 : current.xp + 1,
      enemyHp: Math.max(0, current.enemyHp - damage),
    }));
    setHitBurst((value) => value + 1);
  }

  function setRunDistance(distanceKm) {
    setStats((current) => ({
      ...current,
      runKm: +distanceKm.toFixed(2),
      xp: Math.max(current.xp, Math.round(distanceKm * 60)),
    }));
  }

  function resetBattle() {
    setStats((current) => ({ ...current, combo: 0, enemyHp: 100 }));
  }

  return (
    <main className="game-shell">
      <div className="phone-canvas">
        <TopStatus />
        <HeroHeader />
        <HeroProfile stats={stats} rank={rank} />

        <section className="mid-grid">
          <DailyMissions missions={missions} stats={stats} progress={progress} activeMission={activeMission} setActiveMission={setActiveMission} />
          <MonsterBattle stats={stats} hitBurst={hitBurst} resetBattle={resetBattle} />
        </section>

        <LiveWorkoutPanel activeMission={activeMission} onRep={addRep} onRunDistance={setRunDistance} stats={stats} />

        <ComboPanel combo={stats.combo} />
        <CityMap />
        <BottomNav onStart={() => addRep()} />
      </div>
    </main>
  );
}

function TopStatus() {
  return (
    <div className="top-status">
      <span>9:41</span>
      <span className="phone-icons">▮▮▮  WiFi  ▰</span>
    </div>
  );
}

function HeroHeader() {
  return (
    <header className="game-header">
      <button className="icon-btn" aria-label="Menu"><Menu /></button>
      <Logo />
      <button className="icon-btn bell" aria-label="Notifications"><Bell /><i>3</i></button>
    </header>
  );
}

function Logo() {
  return <div className="logo-text"><span>Hero</span> Limiter</div>;
}

function HeroProfile({ stats, rank }) {
  return (
    <section className="hero-profile panel-cut">
      <div className="city-skyline" />
      <motion.div className="hero-energy" animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2.2 }} />
      <OriginalHero />

      <div className="class-badge">
        <strong>C</strong>
        <span>Class</span>
      </div>

      <div className="profile-copy">
        <h1>{rank.rank} <small>• Day {stats.streak}</small></h1>
        <p>Keep training. The city counts on you.</p>
        <div className="xp-row"><em>XP</em><strong>{stats.xp.toLocaleString()} / 3,600</strong></div>
        <div className="xp-bar"><span style={{ width: `${Math.min(100, Math.round((stats.xp / 3600) * 100))}%` }} /></div>
      </div>

      <div className="level-ring">
        <span>Lv.</span>
        <strong>12</strong>
      </div>

      <div className="streak-shield">
        <span>Streak</span>
        <strong>{stats.streak}</strong>
        <em>Days</em>
        <Flame fill="currentColor" />
      </div>
    </section>
  );
}

function OriginalHero() {
  return (
    <svg className="original-hero" viewBox="0 0 310 410" aria-label="Original silhouetted hero with scarf" role="img">
      <defs>
        <linearGradient id="scarf" x1="0" x2="1"><stop stopColor="#ff241f" /><stop offset="1" stopColor="#5a0708" /></linearGradient>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /><feDisplacementMap in="SourceGraphic" scale="1" /></filter>
      </defs>
      <path d="M142 119 C83 119 51 163 37 247 C78 224 110 232 140 257 C178 288 230 285 280 235 C247 156 205 119 142 119Z" fill="url(#scarf)" opacity="0.95" filter="url(#rough)" />
      <path d="M178 120 C220 122 250 136 299 176 C251 166 224 177 196 197Z" fill="url(#scarf)" opacity="0.92" />
      <path d="M128 92 C123 67 139 43 166 38 C189 34 210 48 216 71 C196 71 185 79 176 95 C164 89 149 89 128 92Z" fill="#050507" stroke="#f6d338" strokeWidth="3" />
      <path d="M118 129 C151 99 205 111 216 158 L239 283 C248 332 219 366 171 367 C125 368 91 334 99 286Z" fill="#070707" stroke="#181818" strokeWidth="5" />
      <path d="M109 148 C75 172 61 217 67 279" stroke="#0a0a0d" strokeWidth="34" strokeLinecap="round" />
      <path d="M220 155 C250 187 260 233 248 291" stroke="#0a0a0d" strokeWidth="33" strokeLinecap="round" />
      <path d="M138 360 L120 405 M196 358 L215 405" stroke="#08080b" strokeWidth="34" strokeLinecap="round" />
      <path d="M224 153 C246 162 267 174 292 197" stroke="#8a0d12" strokeWidth="16" strokeLinecap="round" />
      <path d="M95 132 C126 112 155 106 206 119" stroke="#ff3026" strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}

function DailyMissions({ missions, stats, progress, activeMission, setActiveMission }) {
  return (
    <section className="daily-panel comic-panel">
      <PanelTitle title="Daily Missions" accent={<Zap fill="currentColor" />} right="13:18:42" />
      <div className="mission-stack">
        {missions.map((mission) => (
          <button
            key={mission.key}
            className={`mission-card ${activeMission === mission.key ? 'active' : ''}`}
            onClick={() => setActiveMission(mission.key)}
          >
            <WorkoutIcon type={mission.icon} />
            <span>{mission.label}</span>
            <strong>{mission.key === 'runKm' ? `${stats.runKm} / 10 km` : `${stats[mission.key]} / 100`}</strong>
            <i><b style={{ width: `${progress[mission.key]}%` }} /></i>
          </button>
        ))}
      </div>
    </section>
  );
}

function MonsterBattle({ stats, hitBurst, resetBattle }) {
  return (
    <section className="battle-panel comic-panel">
      <div className="ribbon-title"><Swords /> Monster Battle</div>
      <h2>Crab Mutant</h2>
      <div className="enemy-hp-label"><span>HP</span> {stats.enemyHp}%</div>
      <div className="enemy-hp"><motion.span animate={{ width: `${stats.enemyHp}%` }} /></div>
      <CrabMutant />
      <button className="intel-btn" onClick={resetBattle}><ClipboardList /> Enemy Intel</button>
      <AnimatePresence>
        {hitBurst > 0 && (
          <motion.div
            key={hitBurst}
            className="smash-burst"
            initial={{ scale: 0.55, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: -7, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            SMASH!
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CrabMutant() {
  return (
    <svg className="crab" viewBox="0 0 390 260" aria-label="Original crab mutant monster" role="img">
      <defs>
        <radialGradient id="shell"><stop stopColor="#d84b35" /><stop offset="1" stopColor="#56100d" /></radialGradient>
      </defs>
      <path d="M122 146 C111 89 151 44 214 45 C285 47 331 91 326 158 C279 132 199 122 122 146Z" fill="url(#shell)" stroke="#210807" strokeWidth="7" />
      <circle cx="198" cy="92" r="12" fill="#f2d0c4" /><circle cx="255" cy="91" r="12" fill="#f2d0c4" />
      <circle cx="201" cy="94" r="5" fill="#111" /><circle cx="252" cy="94" r="5" fill="#111" />
      <path d="M127 151 C62 149 26 184 12 235 C70 223 112 204 151 173Z" fill="#9d2019" stroke="#210807" strokeWidth="8" />
      <path d="M315 151 C366 148 385 175 379 230 C338 218 304 194 286 170Z" fill="#9d2019" stroke="#210807" strokeWidth="8" />
      <path d="M167 151 L128 230 M205 145 L193 238 M247 148 L278 232" stroke="#66120f" strokeWidth="17" strokeLinecap="round" />
      <path d="M152 70 C177 59 230 61 284 82" stroke="#ff7a4a" strokeWidth="6" opacity="0.45" />
    </svg>
  );
}

function LiveWorkoutPanel({ activeMission, onRep, onRunDistance, stats }) {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const watchRef = useRef(null);
  const repStateRef = useRef({ phase: 'top', reps: 0, quality: 'ready' });
  const runTrackerRef = useRef({ distanceKm: 0, lastPoint: null });
  const [exercise, setExercise] = useState('pushup');
  const [cameraStatus, setCameraStatus] = useState('Camera off');
  const [poseQuality, setPoseQuality] = useState('Place full body in frame');
  const [runStatus, setRunStatus] = useState('GPS off');

  async function startCamera() {
    if (!['pushup', 'squat'].includes(exercise)) {
      setPoseQuality('Camera counting is for pushups and squats first.');
      return;
    }
    try {
      setCameraStatus('Loading pose model...');
      const vision = await import('@mediapipe/tasks-vision');
      const resolver = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
      detectorRef.current = await vision.PoseLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      repStateRef.current = { phase: 'top', reps: stats[exercise] ?? 0, quality: 'ready' };
      setCameraStatus('Camera tracking');
      detectLoop();
    } catch (error) {
      setCameraStatus('Camera blocked');
      setPoseQuality(error?.message || 'Allow camera access to test pose counting.');
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStatus('Camera off');
  }

  function detectLoop() {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    const result = detector.detectForVideo(video, performance.now());
    const landmarks = result?.landmarks?.[0];
    if (landmarks) {
      const metrics = landmarksToPoseMetrics(landmarks);
      const previousReps = repStateRef.current.reps;
      const next = countRepTransition(exercise, repStateRef.current, metrics);
      repStateRef.current = next;
      setPoseQuality(next.quality === 'not-visible' ? 'Move back — full body not visible' : `${exercise}: ${next.phase} • ${next.quality}`);
      if (next.reps > previousReps) onRep(exercise, 'clean');
    } else {
      setPoseQuality('No body detected — step back into frame');
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }

  function startRun() {
    if (!navigator.geolocation) {
      setRunStatus('GPS not supported on this device');
      return;
    }
    runTrackerRef.current = { distanceKm: 0, lastPoint: null };
    onRunDistance(0);
    setRunStatus('GPS starting...');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        runTrackerRef.current = updateRunTracker(runTrackerRef.current, point);
        onRunDistance(runTrackerRef.current.distanceKm);
        setRunStatus(`${runTrackerRef.current.distanceKm.toFixed(2)} / 10.00 km • ${runTrackerRef.current.quality}`);
      },
      (error) => setRunStatus(error.message || 'Location permission blocked'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  }

  function stopRun() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setRunStatus('GPS paused');
  }

  useEffect(() => () => {
    stopCamera();
    stopRun();
  }, []);

  const missionValue = activeMission === 'runKm' ? `${stats.runKm.toFixed(2)} km` : `${stats[activeMission]} reps`;

  return (
    <section className="live-panel panel-cut">
      <div className="live-copy">
        <h2>Live Test Mode</h2>
        <p>Free browser test: camera counts clean pushups/squats, GPS tracks the 10km run. Everything starts at zero.</p>
        <strong>{activeMission.toUpperCase()}: {missionValue}</strong>
      </div>
      <div className="camera-box">
        <video ref={videoRef} muted playsInline />
        <span>{cameraStatus}</span>
        <em>{poseQuality}</em>
      </div>
      <div className="tracker-controls">
        <select value={exercise} onChange={(event) => setExercise(event.target.value)}>
          <option value="pushup">Pushup camera counter</option>
          <option value="squat">Squat camera counter</option>
        </select>
        <button onClick={startCamera}>Start Camera</button>
        <button onClick={stopCamera}>Stop Camera</button>
        <button onClick={startRun}>Start 10km GPS</button>
        <button onClick={stopRun}>Pause GPS</button>
        <small>{runStatus}</small>
      </div>
    </section>
  );
}

function ComboPanel({ combo }) {
  return (
    <section className="combo-panel panel-cut">
      <div className="fist-burst"><Dumbbell /></div>
      <div className="combo-copy"><h2>Combo Meter</h2><strong>x {combo}</strong><span>Keep it up!</span></div>
      <div className="combo-path">
        {[5, 10, 15, 20, 25].map((mark) => <div key={mark} className={combo >= mark ? 'lit' : ''}><i /> <span>{mark}</span></div>)}
      </div>
      <div className="reward-card"><span>Next Reward</span><Package /><strong>x1</strong><em>At combo 25</em></div>
    </section>
  );
}

function CityMap() {
  return (
    <section className="city-panel panel-cut">
      <h2><MapPin fill="currentColor" /> City Defense Map</h2>
      <div className="route-map">
        <div className="district clear"><Check /><strong>West District</strong><span>Clear</span></div>
        <div className="route-line" />
        <div className="district active"><Shield /><strong>Downtown</strong><span>87%</span></div>
        <div className="route-line red" />
        <div className="district locked"><Skull /><strong>Harbor Zone</strong><span><Lock size={13} /> Locked</span></div>
      </div>
      <button className="view-world">View World ›</button>
    </section>
  );
}

function BottomNav({ onStart }) {
  const items = [
    { label: 'Home', icon: <Home />, active: true },
    { label: 'Missions', icon: <ClipboardList /> },
    { label: 'Hero Gear', icon: <Shield /> },
    { label: 'Profile', icon: <User /> },
  ];
  return (
    <nav className="bottom-nav">
      {items.slice(0, 2).map((item) => <NavItem key={item.label} {...item} />)}
      <button className="start-orb" onClick={onStart}><span><Play fill="currentColor" /></span><strong>Start Mission</strong></button>
      {items.slice(2).map((item) => <NavItem key={item.label} {...item} />)}
    </nav>
  );
}

function NavItem({ label, icon, active }) {
  return <button className={`nav-item ${active ? 'active' : ''}`}>{icon}<span>{label}</span></button>;
}

function PanelTitle({ title, accent, right }) {
  return <div className="panel-title"><h2>{title}{accent}</h2>{right && <span>{right}</span>}</div>;
}

function WorkoutIcon({ type }) {
  return (
    <span className={`workout-icon ${type}`}>
      {type === 'run' ? <span /> : type === 'squat' ? <span /> : type === 'situp' ? <span /> : <span />}
    </span>
  );
}

export default App;
