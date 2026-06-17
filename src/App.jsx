import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Camera,
  Flame,
  Gauge,
  Medal,
  Play,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  calculateBattleDamage,
  calculateMissionProgress,
  getHeroRank,
} from './trainingLogic.js';

const missions = [
  { key: 'pushups', label: 'Pushups', target: 100, unit: 'reps', color: '#ffcf45' },
  { key: 'situps', label: 'Situps', target: 100, unit: 'reps', color: '#ff6a3d' },
  { key: 'squats', label: 'Squats', target: 100, unit: 'reps', color: '#ff366d' },
  { key: 'runKm', label: 'Run', target: 10, unit: 'km', color: '#8f7cff' },
];

const initialStats = {
  pushups: 42,
  situps: 35,
  squats: 60,
  runKm: 2.4,
  xp: 735,
  combo: 18,
  streak: 12,
  enemyHp: 38,
};

const cityZones = ['Dojo', 'Harbor', 'Metro', 'HQ', 'Ruins'];

function App() {
  const [stats, setStats] = useState(initialStats);
  const [activeMission, setActiveMission] = useState('pushups');
  const [hitBurst, setHitBurst] = useState(0);
  const progress = useMemo(() => calculateMissionProgress(stats), [stats]);
  const rank = useMemo(() => getHeroRank(stats.xp), [stats.xp]);
  const active = missions.find((mission) => mission.key === activeMission);
  const seriousMeter = Math.min(100, Math.round((stats.combo / 30) * 100));

  function addRep() {
    const damage = calculateBattleDamage({ base: 7, combo: stats.combo, quality: 'clean' });
    setStats((current) => ({
      ...current,
      [activeMission]: activeMission === 'runKm' ? +(current.runKm + 0.25).toFixed(2) : current[activeMission] + 1,
      combo: current.combo + 1,
      xp: current.xp + 9,
      enemyHp: Math.max(0, current.enemyHp - damage),
    }));
    setHitBurst((value) => value + 1);
  }

  function resetBattle() {
    setStats((current) => ({ ...current, combo: 0, enemyHp: 100 }));
  }

  return (
    <main className="app-shell">
      <DecorativeBackground />

      <nav className="nav-bar">
        <div className="brand-lockup">
          <span className="brand-mark"><Shield size={18} /></span>
          <span>Hero Limiter</span>
        </div>
        <div className="nav-actions">
          <span className="status-pill"><span className="live-dot" /> AI pose beta</span>
          <button className="small-button">Join waitlist</button>
        </div>
      </nav>

      <section className="hero-grid">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="eyebrow"><Sparkles size={16} /> Anime fitness battle system</div>
          <h1>Break your limiter one mission at a time.</h1>
          <p>
            A professional, game-like workout app where pushups, squats, situps, and runs become
            animated battles, rank-ups, streaks, and form-tracked hero missions.
          </p>
          <div className="hero-actions">
            <button className="primary-cta"><Play size={18} fill="currentColor" /> Start Mission</button>
            <button className="secondary-cta"><Camera size={18} /> Try pose counter</button>
          </div>
        </motion.div>

        <motion.div
          className="phone-stage"
          initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.85, delay: 0.1 }}
        >
          <PhoneMockup
            stats={stats}
            progress={progress}
            rank={rank}
            active={active}
            activeMission={activeMission}
            setActiveMission={setActiveMission}
            addRep={addRep}
            resetBattle={resetBattle}
            seriousMeter={seriousMeter}
            hitBurst={hitBurst}
          />
        </motion.div>
      </section>

      <section className="feature-strip">
        <Feature icon={<Swords />} title="Monster battles" text="Every clean rep lands a hit. Bad form becomes a weak hit instead of fake progress." />
        <Feature icon={<Camera />} title="Pose AI ready" text="Designed for MediaPipe-style camera tracking with manual fallback for MVP testing." />
        <Feature icon={<Trophy />} title="Hero ranks" text="Civilian to Limiter Breaker with XP, streaks, badges, and boss raids." />
      </section>
    </main>
  );
}

function PhoneMockup({ stats, progress, rank, active, activeMission, setActiveMission, addRep, resetBattle, seriousMeter, hitBurst }) {
  return (
    <div className="phone-frame">
      <div className="phone-screen">
        <header className="app-header">
          <div>
            <span className="muted-label">Rank</span>
            <h2>{rank.rank}</h2>
          </div>
          <div className="streak-badge"><Flame size={16} fill="currentColor" /> Day {stats.streak}</div>
        </header>

        <section className="rank-card">
          <div className="rank-progress">
            <div className="ring" style={{ '--ring': `${rank.progress}%` }}>
              <Medal size={30} />
            </div>
            <div>
              <p>{rank.nextRank}</p>
              <strong>{rank.xpToNext} XP to next rank</strong>
            </div>
          </div>
          <div className="xp-track"><span style={{ width: `${rank.progress}%` }} /></div>
        </section>

        <section className="avatar-battle-card">
          <SpeedLines />
          <div className="avatar-wrap">
            <motion.div className="aura" animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }} transition={{ repeat: Infinity, duration: 2.4 }} />
            <HeroAvatar />
          </div>
          <div className="enemy-card">
            <span>Crab Mutant</span>
            <strong>HP {stats.enemyHp}%</strong>
            <div className="enemy-hp"><motion.span animate={{ width: `${stats.enemyHp}%` }} /></div>
          </div>
          <AnimatePresence>
            {hitBurst > 0 && (
              <motion.div
                key={hitBurst}
                className="hit-pop"
                initial={{ opacity: 0, scale: 0.45, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 2 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.35 }}
              >
                CRITICAL HIT
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="mission-card">
          <div className="section-heading">
            <div><span className="muted-label">Daily mission</span><h3>100 Training Protocol</h3></div>
            <span className="total-progress">{progress.total}%</span>
          </div>
          <div className="mission-list">
            {missions.map((mission) => {
              const value = stats[mission.key];
              const pct = progress[mission.key];
              return (
                <button
                  key={mission.key}
                  className={`mission-row ${activeMission === mission.key ? 'selected' : ''}`}
                  onClick={() => setActiveMission(mission.key)}
                >
                  <span>{mission.label}</span>
                  <strong>{value}/{mission.target} {mission.unit}</strong>
                  <i style={{ width: `${pct}%`, background: mission.color }} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="combat-console">
          <div className="metric"><Gauge size={16} /> Combo <strong>{stats.combo}x</strong></div>
          <div className="serious-meter"><span style={{ width: `${seriousMeter}%` }} /></div>
          <button className="mission-button" onClick={addRep}><Zap size={18} fill="currentColor" /> Add {active.label === 'Run' ? '0.25km' : 'clean rep'}</button>
          <button className="reset-button" onClick={resetBattle}>Reset boss</button>
        </section>

        <section className="city-map">
          <div className="section-heading compact"><span>City Defense Map</span><Activity size={16} /></div>
          <div className="map-grid">
            {cityZones.map((zone, index) => <span key={zone} className={index === 2 ? 'alert' : ''}>{zone}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroAvatar() {
  return (
    <svg className="hero-avatar" viewBox="0 0 220 260" role="img" aria-label="Original hero avatar silhouette">
      <defs>
        <linearGradient id="cape" x1="0" x2="1"><stop stopColor="#ffcb3d" /><stop offset="1" stopColor="#ff365d" /></linearGradient>
        <linearGradient id="body" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fff2b3" /><stop offset="1" stopColor="#e3ac40" /></linearGradient>
      </defs>
      <path d="M108 72 C66 78 40 115 32 186 C58 171 85 166 112 179 C141 193 170 190 194 168 C184 108 153 75 108 72Z" fill="url(#cape)" opacity="0.78" />
      <circle cx="112" cy="54" r="30" fill="#ffe8a1" />
      <path d="M77 109 C80 84 98 73 121 78 C144 83 157 101 153 132 L148 192 C146 222 127 238 104 234 C81 231 67 211 72 181Z" fill="url(#body)" />
      <path d="M74 123 C45 135 37 161 48 189" stroke="#ffe8a1" strokeWidth="19" strokeLinecap="round" />
      <path d="M151 122 C181 132 190 158 180 187" stroke="#ffe8a1" strokeWidth="19" strokeLinecap="round" />
      <path d="M92 229 L84 252 M124 230 L135 252" stroke="#ffe8a1" strokeWidth="18" strokeLinecap="round" />
      <path d="M88 54 C102 64 123 64 138 52" stroke="#090711" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function SpeedLines() {
  return <div className="speed-lines" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <span key={i} />)}</div>;
}

function DecorativeBackground() {
  return (
    <div className="decorative-bg" aria-hidden="true">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="grid-glow" />
    </div>
  );
}

function Feature({ icon, title, text }) {
  return <article className="feature-card"><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}

export default App;
