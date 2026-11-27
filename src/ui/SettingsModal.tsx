import { RotateCcw, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const resetStarterLot = useGameStore((s) => s.resetStarterLot);

  const handleReset = () => {
    resetStarterLot();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-modal-title" className="modal-title">
            Controls &amp; Lot Menu
          </h2>
          <button type="button" className="queue-cancel-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <ul className="guide-list">
          <li>
            <strong>Pan Camera:</strong> Drag with 1 finger (or left-click drag on desktop).
          </li>
          <li>
            <strong>Zoom &amp; Orbit:</strong> Pinch and twist with 2 fingers (or scroll wheel &amp;
            right-drag on desktop).
          </li>
          <li>
            <strong>Live Mode:</strong> Tap any furniture, floor tile, or Maya to open the Sims
            Radial Pie Menu. Tap any Need bar to auto-solve it!
          </li>
          <li>
            <strong>Build &amp; Buy:</strong> Pick items from the bottom dock or tap existing
            furniture to move, rotate 90°, or sell for 80% Simoleons.
          </li>
          <li>
            <strong>Auto-Save:</strong> Your home, funds, clock, and Maya&apos;s needs save
            automatically on this device.
          </li>
        </ul>

        <div className="modal-actions">
          <button
            id="btn-reset-lot"
            type="button"
            className="btn-danger"
            onClick={handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCcw size={14} />
            <span>Reset Starter Lot</span>
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Resume Playing
          </button>
        </div>
      </div>
    </div>
  );
}
