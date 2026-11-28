import { Briefcase, FastForward, Pause, Play, Smartphone } from 'lucide-react';
import { PHONE_CASES_BY_ID } from '../data/phoneData';
import { getDayShortName } from '../engine/careers';
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
  const phoneOpen = useGameStore((s) => s.phoneOpen);
  const phoneCaseId = useGameStore((s) => s.phoneCaseId);
  const phoneHasBadge = useGameStore((s) => s.phoneHasBadge);
  const shiftPrompt = useGameStore((s) => s.shiftPrompt);
  const billsDue = useGameStore((s) => s.bills.amountDue);

  const setSpeed = useGameStore((s) => s.setSpeed);
  const focusCameraOnSim = useGameStore((s) => s.focusCameraOnSim);
  const togglePhone = useGameStore((s) => s.togglePhone);

  if (mode !== 'live') return null;

  const emotion = EMOTION_META[sim.emotion];
  const phoneCase = PHONE_CASES_BY_ID[phoneCaseId] ?? PHONE_CASES_BY_ID.coastal_mint;
  const showBadge = !phoneOpen && (phoneHasBadge || Boolean(shiftPrompt) || billsDue > 0);

  return (
    <section className="sim-cluster hud-interactive" aria-label="Sim portrait, phone, and time controls">
      <button
        id="btn-open-phone"
        type="button"
        className={`phone-dock-btn glass-pill ${phoneOpen ? 'active' : ''}`}
        onClick={togglePhone}
        title="Open Maya's Smartphone"
        aria-label="Open Smartphone"
        aria-expanded={phoneOpen}
        style={{
          borderColor: phoneOpen ? phoneCase.accentColor : undefined,
        }}
      >
        <span
          className="phone-dock-bezel"
          style={{
            background: phoneCase.frameColor,
            boxShadow: `0 2px 8px ${phoneCase.frameColor}55`,
          }}
        >
          <Smartphone size={17} color="#ffffff" />
        </span>
        <span className="phone-dock-label">Phone</span>
        {showBadge && <span className="phone-badge-dot" aria-label="New notification" />}
      </button>

      <button
        id="btn-focus-sim"
        type="button"
        className="sim-portrait-card glass-pill"
        onClick={focusCameraOnSim}
        title={sim.awayAtWork ? 'Maya is currently at work' : 'Center camera on Maya'}
      >
        <div
          className={`sim-avatar ${sim.awayAtWork ? 'away-at-work' : ''}`}
          style={{
            background: `linear-gradient(155deg, ${emotion.bgTint}, rgba(255,255,255,0.8))`,
            border: `2px solid ${emotion.color}`,
          }}
        >
          {/* Stylized SVG portrait matching Maya's live 3D hairstyle, eye color, and outfit */}
          <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
            <circle cx="24" cy="43" r="14" fill={sim.appearance.topColor} />
            {sim.appearance.hairStyle === 'waves' && (
              <path
                d="M11 22 C11 11, 37 11, 37 22 L38.5 36 C35 37.5, 32.5 36, 32 31 L16 31 C15.5 36, 13 37.5, 9.5 36 Z"
                fill={sim.appearance.hairColor}
              />
            )}
            {sim.appearance.hairStyle === 'bob' && (
              <path
                d="M11.5 22 C11.5 11.5, 36.5 11.5, 36.5 22 L37 30.5 C34.5 31.8, 32 31, 32 28 L16 28 C16 31, 13.5 31.8, 11 30.5 Z"
                fill={sim.appearance.hairColor}
              />
            )}
            {sim.appearance.hairStyle === 'bun' && (
              <circle cx="24" cy="10.5" r="6" fill={sim.appearance.hairColor} />
            )}
            <circle cx="24" cy="23" r="10.5" fill={sim.appearance.skinColor} />
            <path
              d={
                sim.appearance.hairStyle === 'pixie'
                  ? 'M13.5 21.5 C13.5 12, 34.5 12, 34.5 21.5 C31.5 16.8, 17.5 17.2, 13.5 21.5 Z'
                  : 'M13.5 22 C13.5 13, 34.5 13, 34.5 22 C31 18, 17 18, 13.5 22 Z'
              }
              fill={sim.appearance.hairColor}
            />
            <circle cx="20.2" cy="23.4" r="2" fill="#fbfaf8" />
            <circle cx="27.8" cy="23.4" r="2" fill="#fbfaf8" />
            <circle cx="20.2" cy="23.4" r="1.25" fill={sim.appearance.eyeColor} />
            <circle cx="27.8" cy="23.4" r="1.25" fill={sim.appearance.eyeColor} />
            <circle cx="20.7" cy="22.8" r="0.45" fill="#ffffff" />
            <circle cx="28.3" cy="22.8" r="0.45" fill="#ffffff" />
            <path
              d={
                sim.emotion === 'uncomfortable' || sim.emotion === 'tense' || sim.emotion === 'exhausted'
                  ? 'M20.5 28.6 Q24 26.5 27.5 28.6'
                  : 'M20.5 27.2 Q24 30 27.5 27.2'
              }
              fill="none"
              stroke="#7a4c3e"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {sim.awayAtWork && (
            <span className="avatar-work-pill" title="At Work">
              <Briefcase size={10} />
            </span>
          )}
        </div>

        <div className="sim-meta">
          <div className="sim-name-row">
            <span className="sim-name">{sim.name}</span>
            {sim.awayAtWork ? (
              <span className="emotion-badge work-status-badge">At Work</span>
            ) : (
              <span
                className="emotion-badge"
                style={{ background: emotion.bgTint, color: emotion.color }}
              >
                {emotion.label}
              </span>
            )}
          </div>
          <div className="sim-funds-row">
            <span className="funds-value">§{funds.toLocaleString()}</span>
          </div>
        </div>
      </button>

      <div className="time-speed-card glass-pill">
        <div className="clock-row">
          <span className="clock-day">
            Day {clock.day} · {getDayShortName(clock.day)}
          </span>
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
