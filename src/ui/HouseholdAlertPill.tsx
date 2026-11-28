import { Droplets, Mail, ZapOff } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export function HouseholdAlertPill() {
  const mode = useGameStore((s) => s.mode);
  const bills = useGameStore((s) => s.bills);
  const doorbellPrompt = useGameStore((s) => s.doorbellPrompt);
  const openPhone = useGameStore((s) => s.openPhone);

  if (mode !== 'live' || bills.amountDue <= 0 || doorbellPrompt) return null;

  const isShutoff = bills.powerShutoff || bills.waterShutoff;
  const label = bills.waterShutoff
    ? `Power & Water Off · Pay §${bills.amountDue}`
    : bills.powerShutoff
      ? `Power Shut Off · Pay §${bills.amountDue}`
      : `Bill Due: §${bills.amountDue}`;

  return (
    <button
      id="btn-household-alert"
      type="button"
      className={`household-alert-pill hud-interactive ${isShutoff ? 'urgent' : ''}`}
      onClick={() => openPhone('household')}
      title="Open Home & Bills on Maya's Smartphone"
    >
      {bills.waterShutoff ? (
        <Droplets size={13} />
      ) : bills.powerShutoff ? (
        <ZapOff size={13} />
      ) : (
        <Mail size={13} />
      )}
      <span>{label}</span>
    </button>
  );
}
