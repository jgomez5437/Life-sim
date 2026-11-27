import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { NEED_KEYS, NEED_LABELS } from '../engine/simulation';
import { useGameStore } from '../store/gameStore';

function getNeedColor(value: number): string {
  if (value >= 60) return '#22b871';
  if (value >= 30) return '#f2a124';
  return '#e65545';
}

export function NeedsPanel() {
  const mode = useGameStore((s) => s.mode);
  const needs = useGameStore((s) => s.sim.needs);
  const enqueueBestForNeed = useGameStore((s) => s.enqueueBestForNeed);
  const [expanded, setExpanded] = useState(false);

  if (mode !== 'live') return null;

  const lowestValue = Math.min(...NEED_KEYS.map((k) => needs[k]));

  return (
    <section className="needs-anchor hud-interactive" aria-label="Sim Needs">
      {expanded && (
        <div className="needs-drawer glass-pill" id="needs-drawer">
          <div className="needs-drawer-header">
            <span className="needs-drawer-title">Needs</span>
            <span className="needs-drawer-hint">Tap any bar to auto-solve</span>
          </div>

          {NEED_KEYS.map((key) => {
            const val = Math.round(needs[key]);
            const barColor = getNeedColor(val);
            return (
              <button
                key={key}
                id={`btn-need-${key}`}
                type="button"
                className="need-row-btn"
                onClick={() => enqueueBestForNeed(key)}
                title={`Auto-restore ${NEED_LABELS[key]}`}
              >
                <span className="need-row-label">{NEED_LABELS[key]}</span>
                <div className="need-bar-track">
                  <div
                    className="need-bar-fill"
                    style={{ width: `${val}%`, background: barColor }}
                  />
                </div>
                <span className="need-row-val">{val}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        id="btn-needs-toggle"
        type="button"
        className="needs-collapsed-btn glass-pill"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="needs-drawer"
      >
        <div className="needs-mini-bars" aria-hidden="true">
          {NEED_KEYS.map((key) => (
            <div key={key} className="need-mini-track">
              <div
                className="need-mini-fill"
                style={{
                  height: `${Math.max(10, Math.round(needs[key]))}%`,
                  background: getNeedColor(needs[key]),
                }}
              />
            </div>
          ))}
        </div>
        <div className="needs-collapsed-label">
          <span className="needs-title-sm">Needs</span>
          <span className="needs-sub-sm">
            {lowestValue < 28 ? 'Low Alert!' : expanded ? 'Collapse' : 'Tap to expand'}
          </span>
        </div>
        {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
    </section>
  );
}
