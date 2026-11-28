import { BellRing, Check, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export function DoorbellBanner() {
  const mode = useGameStore((s) => s.mode);
  const doorbellPrompt = useGameStore((s) => s.doorbellPrompt);
  const contacts = useGameStore((s) => s.contacts);
  const respondToDoorbell = useGameStore((s) => s.respondToDoorbell);

  if (mode !== 'live' || !doorbellPrompt) return null;

  const visitor = contacts.find((c) => c.id === doorbellPrompt.contactId);
  if (!visitor) return null;

  return (
    <div
      id="doorbell-banner"
      className="doorbell-banner hud-interactive"
      role="dialog"
      aria-label={`${visitor.name} is at the front door`}
    >
      <div className="doorbell-avatar" style={{ background: visitor.avatarColor }}>
        {visitor.name
          .split(' ')
          .map((n) => n[0])
          .join('')}
      </div>
      <div className="doorbell-copy">
        <div className="doorbell-kicker">
          <BellRing size={12} />
          <span>Front Doorbell</span>
        </div>
        <div className="doorbell-title">{visitor.name} is at your door!</div>
      </div>
      <div className="doorbell-actions">
        <button
          id="btn-doorbell-invite"
          type="button"
          className="doorbell-btn primary"
          onClick={() => respondToDoorbell(true)}
        >
          <Check size={13} />
          <span>Invite In</span>
        </button>
        <button
          id="btn-doorbell-decline"
          type="button"
          className="doorbell-btn secondary"
          onClick={() => respondToDoorbell(false)}
        >
          <X size={13} />
          <span>Later</span>
        </button>
      </div>
    </div>
  );
}
