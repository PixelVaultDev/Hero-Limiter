import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Camera,
  CheckCircle2,
  Flame,
  Footprints,
  Gauge,
  Pause,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  VideoOff,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  DAILY_TARGETS,
  calculateMissionProgress,
  countRepTransition,
  createStepTracker,
  landmarksToPoseMetrics,
  updateStepTracker,
} from './trainingLogic.js';

const initialStats = {
  pushups: 0,
  squats: 0,
  situps: 0,
  steps: 0,
};

const exercises = [
  { key: 'pushups', tracker: 'pushup', label: 'Push ups', short: 'Push', target: 100, unit: 'reps', icon: Zap },
  { key: 'squats', tracker: 'squat', label: 'Body squats', short: 'Squat', target: 100, unit: 'reps', icon: ShieldCheck },
  { key: 'situps', tracker: 'situp', label: 'Sit ups', short: 'Sit', target: 100, unit: 'reps', icon: Activity },
  { key: 'steps', tracker: 'steps', label: '10k steps', short: 'Steps', target: 10000, unit: 'steps', icon: Footprints },
];

function App() {
  const [stats, setStats] = useState(initialStats);
  const [activeExercise, setActiveExercise] = useState('pushup');
  const [pulseKey, setPulseKey] = useState(0);
  const progress = useMemo(() => calculateMissionProgress(stats), [stats]);
  const activeMission = exercises.find((item) => item.tracker === activeExercise) ?? exercises[0];
  const completed = exercises.filter((exercise) => progress[exercise.key] >= 100).length;
  const totalReps = stats.pushups + stats.squats + stats.situps;
  const protocolLevel = getProtocolLevel(progress.total);

  function addRep(tracker) {
    const mission = exercises.find((item) => item.tracker === tracker);
    if (!mission || mission.key === 'steps') return;
    setStats((current) => ({
      ...current,
      [mission.key]: Math.min(mission.target, current[mission.key] + 1),
    }));
    setPulseKey((value) => value + 1);
  }

  function setStepCount(steps) {
    setStats((current) => ({
      ...current,
      steps: Math.min(DAILY_TARGETS.steps, Math.max(0, Math.round(steps))),
    }));
  }

  function resetAll() {
    setStats(initialStats);
    setPulseKey((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section className="app-card">
        <header className="hero-bar">
          <div className="brand-block">
            <span className="brand-pill"><Sparkles size={14} /> by LifeOfJohnHa</span>
            <h1>Hero Protocol</h1>
            <p>Interactive daily training OS for 100 push ups, 100 squats, 100 sit ups, and 10k steps.</p>
          </div>
          <button className="ghost-button" onClick={resetAll} type="button">
            <RefreshCw size={18} /> Reset
          </button>
        </header>

        <section className="command-deck" aria-label="Hero Protocol progress overview">
          <div className="progress-orb">
            <motion.div
              className="orb-ring"
              animate={{ rotate: pulseKey ? [0, 2, -2, 0] : 0 }}
              transition={{ duration: 0.32 }}
              style={{ '--progress': `${progress.total}%` }}
            >
              <div className="orb-inner" key={pulseKey}>
                <strong>{progress.total}%</strong>
                <span>{completed}/4 done</span>
              </div>
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.div
                key={pulseKey}
                className="impact-burst"
                initial={{ opacity: 0, scale: 0.72, y: 8 }}
                animate={{ opacity: [0, 1, 0], scale: [0.72, 1.04, 1.22], y: [8, 0, -10] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55 }}
              >
                +POWER
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="protocol-panel">
            <span className="eyebrow"><Gauge size={14} /> Protocol status</span>
            <h2>{protocolLevel.title}</h2>
            <p>{protocolLevel.copy}</p>
            <div className="stat-chips">
              <span><Flame size={14} /> {totalReps} reps</span>
              <span><Footprints size={14} /> {stats.steps.toLocaleString()} steps</span>
              <span><Trophy size={14} /> Rank {protocolLevel.rank}</span>
            </div>
          </div>
        </section>

        <MissionList stats={stats} progress={progress} activeExercise={activeExercise} setActiveExercise={setActiveExercise} />

        <LiveTracker
          activeExercise={activeExercise}
          setActiveExercise={setActiveExercise}
          activeMission={activeMission}
          stats={stats}
          onRep={addRep}
          onStepCount={setStepCount}
        />
      </section>
    </main>
  );
}

function MissionList({ stats, progress, activeExercise, setActiveExercise }) {
  return (
    <section className="mission-list" aria-label="Mission checklist">
      {exercises.map((exercise, index) => {
        const value = exercise.key === 'steps' ? stats.steps.toLocaleString() : stats[exercise.key];
        const done = progress[exercise.key] >= 100;
        const Icon = exercise.icon;
        return (
          <motion.button
            className={`mission-row ${activeExercise === exercise.tracker ? 'active' : ''}`}
            key={exercise.key}
            type="button"
            onClick={() => setActiveExercise(exercise.tracker)}
            whileTap={{ scale: 0.985 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <div className="mission-icon">{done ? <CheckCircle2 size={22} /> : <Icon size={20} />}</div>
            <div className="mission-main">
              <span>{exercise.label}</span>
              <i><b style={{ width: `${progress[exercise.key]}%` }} /></i>
            </div>
            <strong>{value}<small> / {exercise.target.toLocaleString()}{exercise.key === 'steps' ? ' steps' : ''}</small></strong>
          </motion.button>
        );
      })}
    </section>
  );
}

function LiveTracker({ activeExercise, setActiveExercise, activeMission, stats, onRep, onStepCount }) {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const motionListenerRef = useRef(null);
  const repStateRef = useRef({ phase: 'top', reps: 0, quality: 'ready' });
  const stepTrackerRef = useRef(createStepTracker());
  const activeExerciseRef = useRef(activeExercise);
  const activeMissionRef = useRef(activeMission);
  const statsRef = useRef(stats);
  const voiceEnabledRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState('Camera off');
  const [poseStatus, setPoseStatus] = useState('Choose an exercise and start camera.');
  const [stepStatus, setStepStatus] = useState('Step tracker off');
  const [voiceStatus, setVoiceStatus] = useState('Voice count off');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStepTrackingOn, setIsStepTrackingOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('user');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [counterPulseKey, setCounterPulseKey] = useState(0);
  const [repFeedback, setRepFeedback] = useState('Ready for clean reps.');

  const activeRawCount = stats[activeMission.key];
  const activeValue = activeMission.key === 'steps' ? `${stats.steps.toLocaleString()} steps` : `${stats[activeMission.key]} reps`;
  const activeProgress = Math.min(100, Math.round((activeRawCount / activeMission.target) * 100));
  const kineticUnit = activeMission.key === 'steps' ? 'steps' : 'reps';
  const kineticHit = '+1';
  const kineticLabel = activeMission.key === 'steps' ? 'Step engine' : 'Rep counter';
  const comboLabel = activeRawCount === 0
    ? 'Ready to track'
    : activeMission.key === 'steps'
      ? `${activeProgress}% route energy`
      : `${Math.min(activeRawCount, 20)} hit combo`;
  const setupGuide = getSetupGuide(activeExercise);

  async function startCamera() {
    if (activeExercise === 'steps') {
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

  function toggleVoice() {
    if (!('speechSynthesis' in window)) {
      voiceEnabledRef.current = false;
      setVoiceEnabled(false);
      setVoiceStatus('Voice not supported on this browser');
      return;
    }
    const next = !voiceEnabledRef.current;
    voiceEnabledRef.current = next;
    setVoiceEnabled(next);
    if (next) {
      speakText('Voice count on');
      setVoiceStatus('Voice count on');
    } else {
      window.speechSynthesis.cancel();
      setVoiceStatus('Voice count off');
    }
  }

  function triggerCounterPulse() {
    setCounterPulseKey((value) => value + 1);
  }

  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.08;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  function speakRepCount(count, exercise = activeExerciseRef.current) {
    if (!voiceEnabledRef.current || exercise === 'steps') return;
    speakText(String(count));
    setVoiceStatus(`Counted ${count} out loud`);
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
    const currentExercise = activeExerciseRef.current;
    if (landmarks && currentExercise !== 'steps') {
      const metrics = landmarksToPoseMetrics(landmarks, currentExercise);
      const previousReps = repStateRef.current.reps;
      const next = countRepTransition(currentExercise, repStateRef.current, metrics);
      repStateRef.current = next;
      setPoseStatus(formatPoseStatus(currentExercise, next));
      if (next.reps > previousReps) {
        setRepFeedback(`${labelForExercise(currentExercise)} counted. Nice.`);
        triggerCounterPulse();
        onRep(currentExercise);
        speakRepCount(next.reps, currentExercise);
      }
    } else if (!landmarks) {
      setPoseStatus('No body detected. Step back into frame.');
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  async function startStepTracking() {
    setActiveExercise('steps');

    if (!('DeviceMotionEvent' in window)) {
      setStepStatus('Motion step tracking is not supported on this browser.');
      return;
    }

    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          setStepStatus('Motion permission blocked. Steps can only be counted with phone motion.');
          return;
        }
      }

      stopStepTracking(false);
      stepTrackerRef.current = createStepTracker(stats.steps);
      const onMotion = (event) => {
        stepTrackerRef.current = updateStepTracker(stepTrackerRef.current, {
          accelerationIncludingGravity: event.accelerationIncludingGravity,
          acceleration: event.acceleration,
          timestamp: event.timeStamp || Date.now(),
        });
        const nextSteps = stepTrackerRef.current.steps;
        onStepCount(nextSteps);
        setStepStatus(`${nextSteps.toLocaleString()} / 10,000 steps • ${readableStepQuality(stepTrackerRef.current.quality)}`);
      };
      motionListenerRef.current = onMotion;
      window.addEventListener('devicemotion', onMotion);
      setStepStatus('Step tracker active. Keep your phone in your hand or pocket.');
      setIsStepTrackingOn(true);
    } catch (error) {
      setStepStatus(error?.message || 'Could not start motion step tracking.');
      setIsStepTrackingOn(false);
    }
  }

  function stopStepTracking(updateStatus = true) {
    if (motionListenerRef.current) {
      window.removeEventListener('devicemotion', motionListenerRef.current);
    }
    motionListenerRef.current = null;
    if (updateStatus) setStepStatus('Step tracker paused');
    setIsStepTrackingOn(false);
  }


  useEffect(() => () => {
    stopCamera();
    stopStepTracking(false);
  }, []);

  useEffect(() => {
    activeExerciseRef.current = activeExercise;
    activeMissionRef.current = activeMission;
    statsRef.current = stats;
  }, [activeExercise, activeMission, stats]);

  useEffect(() => {
    if (activeExercise !== 'steps') {
      const mission = exercises.find((item) => item.tracker === activeExercise);
      activeExerciseRef.current = activeExercise;
      activeMissionRef.current = mission;
      repStateRef.current = { phase: 'top', reps: stats[mission.key] ?? 0, quality: 'ready' };
      if (isCameraOn) setPoseStatus(`Switched to ${mission.label}. Move through one full rep.`);
      setRepFeedback('Ready for clean reps.');
    }
  }, [activeExercise]);

  return (
    <section className="tracker-card">
      <div className="tracker-heading">
        <div>
          <span className="eyebrow"><ScanLine size={14} /> Live protocol</span>
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

      {activeExercise !== 'steps' && (
        <motion.p
          className={counterPulseKey > 0 ? 'rep-feedback counted' : 'rep-feedback'}
          key={`${activeExercise}-${repFeedback}-${counterPulseKey}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          aria-live="polite"
        >
          <CheckCircle2 size={16} /> {repFeedback}
        </motion.p>
      )}

      <div className={`camera-stage ${isCameraOn ? 'is-live' : ''}`}>
        <video ref={videoRef} muted playsInline />
        <div className="scan-overlay"><ScanLine size={24} /></div>
        <div className={isCameraOn ? 'camera-guide hidden' : 'camera-guide'} aria-hidden={isCameraOn}>
          <div className="pose-silhouette">
            <span className="pose-head" />
            <span className="pose-body" />
            <span className="pose-arm left" />
            <span className="pose-arm right" />
            <span className="pose-leg left" />
            <span className="pose-leg right" />
          </div>
          <div>
            <strong>{setupGuide.title}</strong>
            <p>{setupGuide.copy}</p>
            <div className="guide-chips">
              {setupGuide.chips.map((chip) => <span key={chip}>{chip}</span>)}
            </div>
          </div>
        </div>
        <div className="corner-mark top-left" />
        <div className="corner-mark top-right" />
        <div className="corner-mark bottom-left" />
        <div className="corner-mark bottom-right" />
        <div className="camera-label">
          {activeExercise === 'steps' ? <Footprints size={16} /> : <Camera size={16} />}
          {activeExercise === 'steps' ? 'Motion mode' : cameraStatus}
        </div>
        <div className="voice-panel camera-voice-panel">
          <button className={voiceEnabled ? 'voice-toggle active' : 'voice-toggle'} onClick={toggleVoice} type="button">
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {voiceEnabled ? 'Voice on' : 'Voice off'}
          </button>
          <span>{voiceStatus}</span>
        </div>
      </div>

      <div className="camera-action-row" aria-label={activeExercise === 'steps' ? 'Step controls' : 'Camera controls'}>
        {activeExercise === 'steps' ? (
          <>
            <button className="primary-action run" onClick={startStepTracking} type="button">
              <Footprints size={16} /> {isStepTrackingOn ? 'Steps active' : 'Start steps'}
            </button>
            <button onClick={stopStepTracking} type="button" disabled={!isStepTrackingOn}>
              <Pause size={16} /> Pause steps
            </button>
          </>
        ) : (
          <>
            <button className="primary-action" onClick={startCamera} type="button">
              <Camera size={16} /> {isCameraOn ? 'Tracking' : 'Start camera'}
            </button>
            <button onClick={stopCamera} type="button" disabled={!isCameraOn}>
              <VideoOff size={16} /> Pause camera
            </button>
          </>
        )}
      </div>

      <motion.div
        className="kinetic-counter"
        role="status"
        aria-live="polite"
        animate={{ boxShadow: counterPulseKey ? ['0 0 0 rgba(255,216,77,0)', '0 0 54px rgba(255,216,77,.26)', '0 0 0 rgba(255,216,77,0)'] : undefined }}
        transition={{ duration: 0.5 }}
        style={{ '--counter-progress': `${activeProgress}%` }}
        aria-label={`${activeMission.label} count: ${activeRawCount.toLocaleString()} ${kineticUnit}`}
      >
        <span className="counter-aura" aria-hidden="true" />
        <span className="counter-topline">
          <span>{kineticLabel}</span>
          <b>{comboLabel}</b>
        </span>
        <span className="counter-mainline">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.strong
              key={`${activeExercise}-${activeRawCount}`}
              initial={{ y: 26, opacity: 0, scale: 0.78, rotate: -3 }}
              animate={{ y: 0, opacity: 1, scale: [1.18, 1], rotate: 0 }}
              exit={{ y: -20, opacity: 0, scale: 0.86, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 430, damping: 22 }}
            >
              {activeRawCount.toLocaleString()}
            </motion.strong>
          </AnimatePresence>
          <em>{kineticUnit}</em>
        </span>
        <span className="counter-progress-track"><i /></span>
        <AnimatePresence>
          {counterPulseKey > 0 && (
            <motion.span
              key={counterPulseKey}
              className="counter-hit"
              initial={{ opacity: 0, y: 16, scale: 0.65, rotate: -8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [16, -10, -28, -44], scale: [0.65, 1.15, 1, 0.9], rotate: [-8, 4, -2, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.78, ease: 'easeOut' }}
            >
              {kineticHit}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="tracker-status">{activeExercise === 'steps' ? stepStatus : poseStatus}</p>

      {activeExercise !== 'steps' && (
        <div className="camera-tools">
          <label>
            Camera lens
            <select value={cameraFacing} onChange={(event) => setCameraFacing(event.target.value)} disabled={isCameraOn}>
              <option value="user">Selfie camera</option>
              <option value="environment">Rear / wider view</option>
            </select>
          </label>
        </div>
      )}

      <div className="hint-strip">
        <Timer size={16} /> Camera and motion steps require HTTPS. Side view helps reps; rear/wide helps squats.
      </div>
    </section>
  );
}

function getSetupGuide(exercise) {
  if (exercise === 'steps') {
    return {
      title: 'Step mode uses your phone motion',
      copy: 'Tap Start steps, allow motion access, then keep the phone in your hand or pocket while walking.',
      chips: ['Phone stays awake', 'Hand or pocket', 'HTTPS required'],
    };
  }
  if (exercise === 'squat') {
    return {
      title: 'Set the phone low and wide',
      copy: 'Use rear camera if possible. Keep hips, knees, and feet visible for the cleanest squat counts.',
      chips: ['Rear camera', 'Full legs visible', 'Bright room'],
    };
  }
  if (exercise === 'situp') {
    return {
      title: 'Side view for clean sit ups',
      copy: 'Use a side view so your shoulders, hips, and knees stay in frame.',
      chips: ['Side view', 'Whole torso visible'],
    };
  }
  return {
    title: 'Side view for clean push ups',
    copy: 'Use a side view. Keep shoulders, elbows, wrists, and hips inside the frame.',
    chips: ['Side view', 'Whole body line visible'],
  };
}

function getProtocolLevel(total) {
  if (total >= 100) return { title: 'Protocol complete', rank: 'S', copy: 'Daily mission cleared. Recovery, hydrate, and come back tomorrow.' };
  if (total >= 75) return { title: 'Breakthrough phase', rank: 'A', copy: 'You are close. Finish the last block and lock the protocol.' };
  if (total >= 40) return { title: 'Power rising', rank: 'B', copy: 'Momentum is building. Keep stacking clean reps and steps.' };
  if (total > 0) return { title: 'Activation phase', rank: 'C', copy: 'The system is online. Every rep pushes the meter forward.' };
  return { title: 'Protocol ready', rank: 'D', copy: 'Start from zero. Pick a mission and activate camera or step tracking.' };
}

function formatPoseStatus(exercise, state) {
  if (state.quality === 'not-visible') return visibilityHint(exercise);
  if (state.quality === 'weak-form') return 'Form check: keep your body straighter before counting.';
  if (state.quality === 'pushup-go-lower') return 'Push up tracking: bend lower so elbows clearly close.';
  if (state.quality === 'pushup-return-to-top') return 'Push up tracking: good depth. Push back near the top.';
  if (state.quality === 'pushup-get-horizontal') return 'Push up tracking: get into a floor push-up side view first.';
  if (state.quality === 'squat-go-lower') {
    const drop = Number.isFinite(state.squatHipDrop) ? ` Hip drop: ${Math.max(0, Math.round(state.squatHipDrop * 100))}%.` : '';
    return `Squat tracking: lower hips, then stand tall.${drop}`;
  }
  if (state.quality === 'squat-stand-up') {
    const drop = Number.isFinite(state.squatHipDrop) ? ` Hip drop: ${Math.max(0, Math.round(state.squatHipDrop * 100))}%.` : '';
    return `Squat tracking: good depth. Stand tall to count.${drop}`;
  }
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

function readableStepQuality(quality) {
  if (quality === 'step-counted') return 'walking counted';
  if (quality === 'step-seeking-cadence') return 'checking for real walking';
  if (quality === 'step-shake-rejected') return 'shake ignored';
  if (quality === 'step-no-motion') return 'waiting for phone motion';
  if (quality === 'step-waiting') return 'walk to start counting';
  return 'tracking motion';
}

export default App;
