import { FastForward, Pause, Play } from 'lucide-react';
import { EMOTION_META, formatSimTime } from '../engine/simulation';
import { useGameStore } from '../store/gameStore';
import type { SimSpeed } from '../types/game';

const SPEEDS: Array<{ value: SimSpeed; label: string }> = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1x' },
  { value: 3, label: '3x' },
  { value: 8, label: '8x' },
];

export function SimControlCluster() {
  const mode = useGameStore((s) => s.mode);
  const sim = useGameStore((s) => s.sim);
  const funds = useGameStore((s) => s.funds);
  const clock = useGameStore((s) => s.clock);
  const speed = useGameStore((s) => s.speed);

  const setSpeed = useGameStore((s) => s.setSpeed);
  const focusCameraOnSim = useGameStore((s) => s.focusCameraOnSim);

  if (mode !== 'live') return null;

  const emotion = EMOTION_META[sim.emotion];

  return (
    <section className="sim-cluster hud-interactive" aria-label="Sim portrait and time controls">
      <button
        id="btn-focus-sim"
        type="button"
        className="sim-portrait-card glass-pill"
        onClick={focusCameraOnSim}
        title="Center camera on Maya"
      >
        <div
          className="sim-avatar"
          style={{
            background: `linear-gradient(155deg, ${emotion.bgTint}, rgba(255,255,255,0.8))`,
            border: `2px solid ${emotion.color}`,
          }}
        >
          {/* Stylized SVG portrait matching Maya's 3D appearance */}
          <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
            <circle cx="24" cy="42" r="14" fill={sim.appearance.topColor} />
            <circle cx="24" cy="11" r="6" fill={sim.appearance.hairColor} />
            <circle cx="24" cy="22" r="10.5" fill={sim.appearance.skinColor} />
            <path
              d="M13.5 21 C13.5 13, 34.5 13, 34.5 21 C31 17.5, 17 17.5, 13.5 21 Z"
              fill={sim.appearance.hairColor}
            />
            <circle cx="20.5" cy="22.5" r="1.4" fill="#1f2428" />
            <circle cx="27.5" cy="22.5" r="1.4" fill="#1f2428" />
            <path
              d={
                sim.emotion === 'uncomfortable' || sim.emotion === 'tense' || sim.emotion === 'exhausted'
                  ? 'M20.5 27.5 Q24 25.5 27.5 27.5'
                  : 'M20.5 26.2 Q24 29 27.5 26.2'
              }
              fill="none"
              stroke="#7a4c3e"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="sim-meta">
          <div className="sim-name-row">
            <span className="sim-name">{sim.name}</span>
            <span
              className="emotion-badge"
              style={{ background: emotion.bgTint, color: emotion.color }}
            >
              {emotion.label}
            </span>
          </div>
          <div className="sim-funds-row">
            <span className="funds-value">§{funds.toLocaleString()}</span>
          </div>
        </div>
      </button>

      <div className="time-speed-card glass-pill">
        <div className="clock-row">
          <span className="clock-day">Day {clock.day}</span>
          <span className="clock-time">{formatSimTime(clock.hour, clock.minute)}</span>
        </div>
        <div className="speed-row" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              id={`btn-speed-${s.value}`}
              type="button"
              className={`speed-btn ${speed === s.value ? 'active' : ''}`}
              onClick={() => setSpeed(s.value)}
              aria-label={`Set speed ${s.label}`}
            >
              {s.value === 0 ? (
                <Pause size={13} />
              ) : s.value === 1 ? (
                <Play size={13} />
              ) : s.value === 3 ? (
                <FastForward size={13} />
              ) : (
                '8x'
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
