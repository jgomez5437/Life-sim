import { X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ActionIcon } from './ActionIcon';

const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ActionQueue() {
  const mode = useGameStore((s) => s.mode);
  const actionQueue = useGameStore((s) => s.actionQueue);
  const cancelAction = useGameStore((s) => s.cancelAction);

  if (mode !== 'live' || actionQueue.length === 0) return null;

  return (
    <aside className="action-queue hud-interactive" aria-label="Sim Action Queue">
      {actionQueue.map((action, index) => {
        const isFront = index === 0;
        const progress =
          isFront && action.phase === 'performing' && action.durationSimMinutes > 0
            ? Math.min(1, action.elapsedSimMinutes / action.durationSimMinutes)
            : 0;
        const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);

        return (
          <div
            key={action.id}
            className={`queue-card glass-pill ${isFront ? 'active-action' : ''}`}
          >
            <div className="queue-ring-wrap">
              <svg className="queue-ring-svg" width="34" height="34" viewBox="0 0 34 34">
                <circle
                  cx="17"
                  cy="17"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(30, 142, 110, 0.16)"
                  strokeWidth="3"
                />
                {isFront && (
                  <circle
                    cx="17"
                    cy="17"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="#1e9e6d"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={action.phase === 'routing' ? RING_CIRCUMFERENCE * 0.72 : strokeOffset}
                  />
                )}
              </svg>
              <div className="queue-icon-core">
                <ActionIcon name={action.icon} size={13} />
              </div>
            </div>

            <div className="queue-text">
              <span className="queue-label">{action.label}</span>
              <span className="queue-phase">
                {isFront
                  ? action.phase === 'routing'
                    ? 'Walking...'
                    : `${Math.round(progress * 100)}%`
                  : 'Queued'}
              </span>
            </div>

            <button
              type="button"
              className="queue-cancel-btn"
              onClick={() => cancelAction(action.id)}
              aria-label={`Cancel ${action.label}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </aside>
  );
}
