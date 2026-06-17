import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, MapPin, Pause, Play, RefreshCw, Route, ScanLine, Timer, VideoOff } from 'lucide-react';
import {
  DAILY_TARGETS,
  calculateMissionProgress,
  countRepTransition,
  landmarksToPoseMetrics,
  updateRunTracker,
} from './trainingLogic.js';

const initialStats = {
  pushups: 0,
  squats: 0,
  situps: 0,
  runKm: 0,
};

const exercises = [
  { key: 'pushups', tracker: 'pushup', label: 'Push ups', short: 'Push', target: 100, unit: 'reps' },
  { key: 'squats', tracker: 'squat', label: 'Body squats', short: 'Squat', target: 100, unit: 'reps' },
  { key: 'situps', tracker: 'situp', label: 'Sit ups', short: 'Sit', target: 100, unit: 'reps' },
  { key: 'runKm', tracker: 'run', label: 'Walk / run', short: 'Run', target: 10, unit: 'km' },
];

function App() {
  const [stats, setStats] = useState(initialStats);
  const [activeExercise, setActiveExercise] = useState('pushup');
  const [pulseKey, setPulseKey] = useState(0);
  const progress = useMemo(() => calculateMissionProgress(stats), [stats]);
  const activeMission = exercises.find((item) => item.tracker === activeExercise) ?? exercises[0];
  const completed = exercises.filter((exercise) => progress[exercise.key] >= 100).length;

  function addRep(tracker) {
    const mission = exercises.find((item) => item.tracker === tracker);
    if (!mission || mission.key === 'runKm') return;
    setStats((current) => ({
      ...current,
      [mission.key]: Math.min(mission.target, current[mission.key] + 1),
    }));
    setPulseKey((value) => value + 1);
  }

  function setRunDistance(distanceKm) {
    setStats((current) => ({
      ...current,
      runKm: Math.min(DAILY_TARGETS.runKm, +distanceKm.toFixed(2)),
    }));
  }

  function resetAll() {
    setStats(initialStats);
    setPulseKey((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <section className="app-card">
        <header className="hero-bar">
          <div>
            <span className="eyebrow">Daily training</span>
            <h1>Limiter Mission</h1>
            <p>Simple tracker for 100 push ups, 100 squats, 100 sit ups, and a 10km walk/run.</p>
          </div>
          <button className="ghost-button" onClick={resetAll} type="button">
            <RefreshCw size={18} /> Reset
          </button>
        </header>

        <section className="progress-orb" aria-label="Total mission progress">
          <div className="orb-ring" style={{ '--progress': `${progress.total}%` }}>
            <div className="orb-inner" key={pulseKey}>
              <strong>{progress.total}%</strong>
              <span>{completed}/4 complete</span>
            </div>
          </div>
          <div className="today-copy">
            <h2>Start from zero. Finish the day.</h2>
            <p>Use the camera for reps and GPS for distance. Manual fallback buttons are included for testing and bad camera angles.</p>
          </div>
        </section>

        <MissionList stats={stats} progress={progress} activeExercise={activeExercise} setActiveExercise={setActiveExercise} />

        <LiveTracker
          activeExercise={activeExercise}
          setActiveExercise={setActiveExercise}
          activeMission={activeMission}
          stats={stats}
          onRep={addRep}
          onRunDistance={setRunDistance}
        />
      </section>
    </main>
  );
}

function MissionList({ stats, progress, activeExercise, setActiveExercise }) {
  return (
    <section className="mission-list" aria-label="Mission checklist">
      {exercises.map((exercise) => {
        const value = exercise.key === 'runKm' ? stats.runKm.toFixed(2) : stats[exercise.key];
        const done = progress[exercise.key] >= 100;
        return (
          <button
            className={`mission-row ${activeExercise === exercise.tracker ? 'active' : ''}`}
            key={exercise.key}
            type="button"
            onClick={() => setActiveExercise(exercise.tracker)}
          >
            <div className="mission-icon">{done ? <CheckCircle2 size={22} /> : <span>{exercise.short}</span>}</div>
            <div className="mission-main">
              <span>{exercise.label}</span>
              <i><b style={{ width: `${progress[exercise.key]}%` }} /></i>
            </div>
            <strong>{value}<small> / {exercise.target}{exercise.key === 'runKm' ? ' km' : ''}</small></strong>
          </button>
        );
      })}
    </section>
  );
}

function LiveTracker({ activeExercise, setActiveExercise, activeMission, stats, onRep, onRunDistance }) {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const watchRef = useRef(null);
  const repStateRef = useRef({ phase: 'top', reps: 0, quality: 'ready' });
  const runTrackerRef = useRef({ distanceKm: 0, lastPoint: null });
  const [cameraStatus, setCameraStatus] = useState('Camera off');
  const [poseStatus, setPoseStatus] = useState('Choose an exercise and start camera.');
  const [runStatus, setRunStatus] = useState('GPS off');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isGpsOn, setIsGpsOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('user');

  const activeValue = activeMission.key === 'runKm' ? `${stats.runKm.toFixed(2)} km` : `${stats[activeMission.key]} reps`;

  async function startCamera() {
    if (activeExercise === 'run') {
      setPoseStatus('Pick push ups, squats, or sit ups for camera tracking.');
      return;
    }

    try {
      setCameraStatus('Loading pose model…');
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

      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      repStateRef.current = { phase: 'top', reps: stats[activeMission.key] ?? 0, quality: 'ready' };
      setCameraStatus('Camera tracking');
      setPoseStatus('Move through one full rep.');
      setIsCameraOn(true);
      detectLoop();
    } catch (error) {
      setCameraStatus('Camera blocked');
      setPoseStatus(error?.message || 'Allow camera permission to test rep counting.');
      setIsCameraOn(false);
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStatus('Camera off');
    setIsCameraOn(false);
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
      const metrics = landmarksToPoseMetrics(landmarks, activeExercise);
      const previousReps = repStateRef.current.reps;
      const next = countRepTransition(activeExercise, repStateRef.current, metrics);
      repStateRef.current = next;
      setPoseStatus(formatPoseStatus(activeExercise, next));
      if (next.reps > previousReps) onRep(activeExercise);
    } else {
      setPoseStatus('No body detected. Step back into frame.');
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  function startRun() {
    if (!navigator.geolocation) {
      setRunStatus('GPS not supported on this device.');
      return;
    }
    setActiveExercise('run');
    runTrackerRef.current = { distanceKm: 0, lastPoint: null };
    onRunDistance(0);
    setRunStatus('GPS starting…');
    setIsGpsOn(true);
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
        setRunStatus(`${runTrackerRef.current.distanceKm.toFixed(2)} / 10.00 km • ${readableGpsQuality(runTrackerRef.current.quality)}`);
      },
      (error) => {
        setRunStatus(error.message || 'Location permission blocked.');
        setIsGpsOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  }

  function stopRun() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setRunStatus('GPS paused');
    setIsGpsOn(false);
  }

  function manualAdd() {
    if (activeExercise === 'run') {
      onRunDistance(Math.min(10, stats.runKm + 0.1));
      return;
    }
    onRep(activeExercise);
    repStateRef.current = { ...repStateRef.current, reps: repStateRef.current.reps + 1 };
  }

  useEffect(() => () => {
    stopCamera();
    stopRun();
  }, []);

  useEffect(() => {
    if (activeExercise !== 'run') {
      const mission = exercises.find((item) => item.tracker === activeExercise);
      repStateRef.current = { phase: 'top', reps: stats[mission.key] ?? 0, quality: 'ready' };
    }
  }, [activeExercise]);

  return (
    <section className="tracker-card">
      <div className="tracker-heading">
        <div>
          <span className="eyebrow">Live tracker</span>
          <h2>{activeMission.label}</h2>
        </div>
        <strong>{activeValue}</strong>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Choose tracker mode">
        {exercises.map((exercise) => (
          <button
            className={activeExercise === exercise.tracker ? 'active' : ''}
            key={exercise.key}
            type="button"
            onClick={() => setActiveExercise(exercise.tracker)}
          >
            {exercise.short}
          </button>
        ))}
      </div>

      <div className="camera-tools">
        <label>
          Camera
          <select value={cameraFacing} onChange={(event) => setCameraFacing(event.target.value)} disabled={isCameraOn}>
            <option value="user">Selfie camera</option>
            <option value="environment">Rear / wider view</option>
          </select>
        </label>
      </div>

      <div className="camera-stage">
        <video ref={videoRef} muted playsInline />
        <div className="scan-overlay"><ScanLine size={24} /></div>
        <div className="camera-label"><Camera size={16} /> {cameraStatus}</div>
      </div>

      <p className="tracker-status">{activeExercise === 'run' ? runStatus : poseStatus}</p>

      <div className="action-grid">
        <button className="primary-action" onClick={startCamera} type="button" disabled={activeExercise === 'run'}>
          <Camera size={18} /> {isCameraOn ? 'Tracking' : 'Start camera'}
        </button>
        <button onClick={stopCamera} type="button">
          <VideoOff size={18} /> Stop camera
        </button>
        <button className="primary-action run" onClick={startRun} type="button">
          <Route size={18} /> {isGpsOn ? 'GPS active' : 'Start GPS'}
        </button>
        <button onClick={stopRun} type="button">
          <Pause size={18} /> Pause GPS
        </button>
      </div>

      <button className="manual-button" onClick={manualAdd} type="button">
        <Play size={18} /> Manual add {activeExercise === 'run' ? '+0.1 km' : '+1 rep'}
      </button>

      <div className="hint-strip">
        <Timer size={16} /> Camera and GPS require HTTPS. Test on the GitHub Pages link from your phone.
      </div>
      <div className="hint-strip muted">
        <MapPin size={16} /> For best GPS accuracy, test outside and allow precise location.
      </div>
    </section>
  );
}

function formatPoseStatus(exercise, state) {
  if (state.quality === 'not-visible') return visibilityHint(exercise);
  if (state.quality === 'weak-form') return 'Form check: keep your body straighter before counting.';
  if (state.quality === 'clean') return `${labelForExercise(exercise)} counted. Nice.`;
  if (state.phase === 'bottom') return 'Good depth. Return to the top.';
  return 'Tracking movement…';
}

function visibilityHint(exercise) {
  if (exercise === 'pushup') return 'Show shoulders, elbows, wrists, and hips. Side view works best.';
  if (exercise === 'squat') return 'Show hips, knees, and feet. Rear camera usually helps.';
  if (exercise === 'situp') return 'Show shoulders, hips, and knees from the side.';
  return 'Step into frame.';
}

function labelForExercise(exercise) {
  if (exercise === 'pushup') return 'Push up';
  if (exercise === 'squat') return 'Squat';
  if (exercise === 'situp') return 'Sit up';
  return 'Rep';
}

function readableGpsQuality(quality) {
  if (quality === 'gps-ready') return 'ready';
  if (quality === 'gps-weak') return 'weak signal';
  if (quality === 'gps-jump-filtered') return 'jump ignored';
  return 'tracking';
}

export default App;
