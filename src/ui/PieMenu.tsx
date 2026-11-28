import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { NeighborHouseId, UpgradeId } from '../types/game';
import { ActionIcon } from './ActionIcon';

export function PieMenu() {
  const pieMenu = useGameStore((s) => s.pieMenu);
  const closePieMenu = useGameStore((s) => s.closePieMenu);
  const enqueueWalk = useGameStore((s) => s.enqueueWalk);
  const enqueueObjectInteraction = useGameStore((s) => s.enqueueObjectInteraction);
  const enqueueSelfInteraction = useGameStore((s) => s.enqueueSelfInteraction);
  const enqueueKnockOnHouse = useGameStore((s) => s.enqueueKnockOnHouse);
  const enqueueNpcInteraction = useGameStore((s) => s.enqueueNpcInteraction);
  const sendVisitorHome = useGameStore((s) => s.sendVisitorHome);
  const enqueueCleanObject = useGameStore((s) => s.enqueueCleanObject);
  const enqueueRepairObject = useGameStore((s) => s.enqueueRepairObject);
  const enqueueUpgradeObject = useGameStore((s) => s.enqueueUpgradeObject);
  const enqueueCleanMess = useGameStore((s) => s.enqueueCleanMess);
  const enqueuePayBillsAtMailbox = useGameStore((s) => s.enqueuePayBillsAtMailbox);
  const callRepairTech = useGameStore((s) => s.callRepairTech);
  const buyUpgradeParts = useGameStore((s) => s.buyUpgradeParts);
  const openPhone = useGameStore((s) => s.openPhone);

  useEffect(() => {
    if (!pieMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePieMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pieMenu, closePieMenu]);

  if (!pieMenu) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 844;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 390;

  const marginX = Math.min(165, vw * 0.42);
  const marginY = Math.min(98, vh * 0.34);

  const clampedX = Math.max(marginX, Math.min(vw - marginX, pieMenu.screenX));
  const clampedY = Math.max(marginY, Math.min(vh - marginY, pieMenu.screenY));

  const count = pieMenu.options.length;
  const radiusX = count <= 2 ? 104 : 118;
  const radiusY = count <= 2 ? 54 : 72;

  const handleOptionClick = (optId: string) => {
    if (optId === 'walk_here') {
      enqueueWalk(pieMenu.tile);
      return;
    }
    if (optId.startsWith('self:')) {
      enqueueSelfInteraction(optId.replace('self:', ''));
      return;
    }
    if (optId.startsWith('knock:')) {
      const houseId = optId.replace('knock:', '') as NeighborHouseId;
      enqueueKnockOnHouse(houseId);
      return;
    }
    if (optId.startsWith('npc:')) {
      const [, contactId, actionId] = optId.split(':');
      if (contactId && actionId) {
        enqueueNpcInteraction(contactId, actionId);
      }
      return;
    }
    if (optId.startsWith('npc_send_home:')) {
      const contactId = optId.replace('npc_send_home:', '');
      sendVisitorHome(contactId);
      closePieMenu();
      return;
    }
    if (optId.startsWith('clean_obj:')) {
      enqueueCleanObject(optId.replace('clean_obj:', ''));
      return;
    }
    if (optId.startsWith('repair_obj:')) {
      enqueueRepairObject(optId.replace('repair_obj:', ''));
      return;
    }
    if (optId.startsWith('upgrade_obj:')) {
      const [, objectId, upgradeId] = optId.split(':');
      if (objectId && upgradeId) {
        enqueueUpgradeObject(objectId, upgradeId as UpgradeId);
      }
      return;
    }
    if (optId.startsWith('clean_mess:')) {
      enqueueCleanMess(optId.replace('clean_mess:', ''));
      return;
    }
    if (optId === 'service:repair_tech') {
      callRepairTech();
      return;
    }
    if (optId === 'mailbox:pay_bills') {
      enqueuePayBillsAtMailbox();
      return;
    }
    if (optId === 'mailbox:open_home') {
      closePieMenu();
      openPhone('household');
      return;
    }
    if (optId === 'mailbox:buy_parts') {
      buyUpgradeParts();
      return;
    }
    if (pieMenu.objectId) {
      enqueueObjectInteraction(pieMenu.objectId, optId);
    }
  };

  return (
    <>
      <div
        className="pie-backdrop"
        onClick={closePieMenu}
        aria-hidden="true"
      />
      <div
        id="sims-pie-menu"
        className="pie-anchor"
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        role="menu"
        aria-label={`Interactions for ${pieMenu.title}`}
      >
        <div className="pie-hub">
          <div className="pie-hub-title">{pieMenu.title}</div>
          {pieMenu.subtitle && <div className="pie-hub-sub">{pieMenu.subtitle}</div>}
        </div>

        {pieMenu.options.map((opt, idx) => {
          // Spread petals cleanly left/right/top-bottom in a Sims-style radial halo
          let angle: number;
          if (count === 1) {
            angle = -Math.PI / 2;
          } else if (count === 2) {
            angle = idx === 0 ? -Math.PI * 0.78 : -Math.PI * 0.22;
          } else {
            angle = -Math.PI / 2 + (idx * Math.PI * 2) / count;
          }

          const ox = Math.cos(angle) * radiusX;
          const oy = Math.sin(angle) * radiusY;

          return (
            <button
              key={opt.id}
              type="button"
              role="menuitem"
              className="pie-petal"
              disabled={opt.disabled}
              title={opt.reason}
              style={{
                transform: `translate(calc(-50% + ${ox.toFixed(1)}px), calc(-50% + ${oy.toFixed(1)}px))`,
              }}
              onClick={() => handleOptionClick(opt.id)}
            >
              <ActionIcon name={opt.icon} size={14} />
              <span>{opt.label}</span>
              {opt.cost ? <span className="pie-petal-cost">§{opt.cost}</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
