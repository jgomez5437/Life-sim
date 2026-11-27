import { useState } from 'react';
import { ActionQueue } from './ActionQueue';
import { BuildBuyDock } from './BuildBuyDock';
import { NeedsPanel } from './NeedsPanel';
import { OrientationGuard } from './OrientationGuard';
import { PieMenu } from './PieMenu';
import { SettingsModal } from './SettingsModal';
import { SimControlCluster } from './SimControlCluster';
import { TopBar } from './TopBar';

export function HUD() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="hud-layer">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <ActionQueue />
      <SimControlCluster />
      <NeedsPanel />
      <BuildBuyDock />
      <PieMenu />
      <OrientationGuard />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
