import { RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OrientationGuard() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const narrow = window.innerWidth < 680;
      setIsPortraitMobile(portrait && narrow);
      if (!portrait) {
        setDismissed(false);
      }
    };

    evaluate();
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);
    return () => {
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('orientationchange', evaluate);
    };
  }, []);

  if (!isPortraitMobile || dismissed) return null;

  return (
    <div className="orientation-guard" role="dialog" aria-modal="true" aria-label="Rotate device">
      <div className="rotate-icon-badge" aria-hidden="true">
        <RotateCw size={30} />
      </div>
      <h2 className="modal-title">Rotate to Landscape</h2>
      <p style={{ margin: 0, maxWidth: 300, fontSize: 13.5, color: 'var(--ink-secondary)' }}>
        Sunnyside Life Sim is crafted for horizontal mobile play so you get a wide panoramic view
        of your 3D home.
      </p>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setDismissed(true)}
      >
        Play in Portrait Anyway
      </button>
    </div>
  );
}
