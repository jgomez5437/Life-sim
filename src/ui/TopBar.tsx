import {
  Brain,
  Diamond,
  Hammer,
  Home,
  Layers,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

const WALL_MODE_LABELS = {
  cutaway: 'Cutaway',
  down: 'Walls Down',
  up: 'Walls Up',
};

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const mode = useGameStore((s) => s.mode);
  const wallMode = useGameStore((s) => s.wallMode);
  const freeWill = useGameStore((s) => s.freeWill);
  const feedbacks = useGameStore((s) => s.feedbacks);

  const setMode = useGameStore((s) => s.setMode);
  const cycleWallMode = useGameStore((s) => s.cycleWallMode);
  const toggleFreeWill = useGameStore((s) => s.toggleFreeWill);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        orientation.lock?.('landscape').catch(() => {});
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen unavailable in embedded iframe or unsupported iOS Safari
    }
  };

  return (
    <>
      <header className="top-bar">
        <div className="brand-pill glass-pill hud-interactive">
          <div className="brand-gem" aria-hidden="true">
            <Diamond size={13} fill="currentColor" />
          </div>
          <div>
            <h1 className="brand-title">Sunnyside</h1>
            <div className="brand-sub">Cypress Starter Lot</div>
          </div>
        </div>

        <nav className="top-controls hud-interactive" aria-label="Game controls">
          <div className="mode-switch glass-pill" role="tablist" aria-label="Game mode">
            <button
              id="btn-mode-live"
              type="button"
              role="tab"
              aria-selected={mode === 'live'}
              className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
              onClick={() => setMode('live')}
            >
              <Home size={14} />
              <span>Live</span>
            </button>
            <button
              id="btn-mode-build"
              type="button"
              role="tab"
              aria-selected={mode === 'build'}
              className={`mode-btn ${mode === 'build' ? 'active' : ''}`}
              onClick={() => setMode('build')}
            >
              <Hammer size={14} />
              <span>Build &amp; Buy</span>
            </button>
          </div>

          <button
            id="btn-wall-mode"
            type="button"
            className="icon-pill-btn glass-pill"
            onClick={cycleWallMode}
            title={`Wall View: ${WALL_MODE_LABELS[wallMode]}`}
            aria-label={`Wall View: ${WALL_MODE_LABELS[wallMode]}`}
          >
            <Layers size={15} />
            <span>{WALL_MODE_LABELS[wallMode]}</span>
          </button>

          {mode === 'live' && (
            <button
              id="btn-free-will"
              type="button"
              className={`icon-pill-btn glass-pill ${freeWill ? 'active-accent' : ''}`}
              onClick={toggleFreeWill}
              title={freeWill ? 'Free Will: On' : 'Free Will: Off'}
              aria-label={freeWill ? 'Disable Free Will' : 'Enable Free Will'}
            >
              <Brain size={15} />
            </button>
          )}

          <button
            id="btn-fullscreen"
            type="button"
            className="icon-pill-btn glass-pill"
            onClick={handleFullscreen}
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            id="btn-settings"
            type="button"
            className="icon-pill-btn glass-pill"
            onClick={onOpenSettings}
            title="Controls & Lot Menu"
            aria-label="Controls and Lot Menu"
          >
            <SlidersHorizontal size={15} />
          </button>
        </nav>
      </header>

      {feedbacks.length > 0 && (
        <div className="feedback-stack" aria-live="polite">
          {feedbacks.map((fb) => (
            <div key={fb.id} className={`feedback-toast ${fb.tone}`}>
              {fb.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
