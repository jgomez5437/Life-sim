import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const resetStarterLot = useGameStore((s) => s.resetStarterLot);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality);

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
            Controls &amp; Graphics
          </h2>
          <button type="button" className="queue-cancel-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-head">
            <Sparkles size={14} />
            <span>Graphics Quality</span>
          </div>
          <div className="quality-segment" role="group" aria-label="Graphics Quality">
            <button
              id="btn-quality-high"
              type="button"
              className={`quality-option ${graphicsQuality === 'high' ? 'active' : ''}`}
              onClick={() => setGraphicsQuality('high')}
            >
              <span className="quality-name">High Fidelity</span>
              <span className="quality-desc">2048px shadows, crisp DPR, drifting clouds</span>
            </button>
            <button
              id="btn-quality-balanced"
              type="button"
              className={`quality-option ${graphicsQuality === 'balanced' ? 'active' : ''}`}
              onClick={() => setGraphicsQuality('balanced')}
            >
              <span className="quality-name">Balanced Mobile</span>
              <span className="quality-desc">1024px shadows, battery-friendly DPR</span>
            </button>
          </div>
        </div>

        <ul className="guide-list">
          <li>
            <strong>Style Maya In-World:</strong> Tap the Bedroom Dresser, Brass Arch Mirror, or
            Bathroom Vanity to open the 3D Wardrobe Studio and change hair, eyes &amp; outfits.
          </li>
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
            <strong>Neighborhood &amp; Neighbors:</strong> Pan across Sunnyside Lane to visit 3
            neighbor houses! Tap a roof or front door to <em>Knock on Door</em>, be invited inside,
            and chat face-to-face with Leo, Nora, Priya, Marcus &amp; Camille.
          </li>
          <li>
            <strong>Smartphone &amp; Careers:</strong> Tap the Phone button beside Maya’s portrait
            to invite neighbors over, visit their homes, check Social Bunny, apply for 5 careers,
            work from home, order Zoomers delivery, or swap phone cases.
          </li>
          <li>
            <strong>Build &amp; Buy:</strong> Pick items from the bottom dock or tap existing
            furniture to move, rotate 90°, or sell for 80% Simoleons.
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
