import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ActionQueue } from './ActionQueue';
import { BuildBuyDock } from './BuildBuyDock';
import { NeedsPanel } from './NeedsPanel';
import { OrientationGuard } from './OrientationGuard';
import { PhoneDrawer } from './PhoneDrawer';
import { PieMenu } from './PieMenu';
import { SettingsModal } from './SettingsModal';
import { SimControlCluster } from './SimControlCluster';
import { TopBar } from './TopBar';
import { WardrobePanel } from './WardrobePanel';
import { WorkShiftHUD } from './WorkShiftHUD';

export function HUD() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);

  return (
    <div className="hud-layer">
      {!wardrobeOpen && (
        <>
          <TopBar onOpenSettings={() => setSettingsOpen(true)} />
          <ActionQueue />
          <WorkShiftHUD />
          <PhoneDrawer />
          <SimControlCluster />
          <NeedsPanel />
          <BuildBuyDock />
          <PieMenu />
        </>
      )}
      <WardrobePanel />
      <OrientationGuard />
      {settingsOpen && !wardrobeOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
