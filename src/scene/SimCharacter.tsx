import { useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';
import { SELF_INTERACTIONS } from '../data/catalog';
import { ALL_NEIGHBOR_OBJECTS } from '../data/neighborhood';
import { PHONE_CASES_BY_ID } from '../data/phoneData';
import { simRuntime } from '../engine/simRuntime';
import { getPlumbobColor } from '../engine/simulation';
import { useGameStore } from '../store/gameStore';
import { SimRigMesh } from './SimRigMesh';
import { shouldIgnoreTap } from './pointerGuard';

export function SimCharacter() {
  const { camera, size } = useThree();
  const sim = useGameStore((s) => s.sim);
  const mode = useGameStore((s) => s.mode);
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);
  const phoneCaseId = useGameStore((s) => s.phoneCaseId);
  const placedObjects = useGameStore((s) => s.placedObjects);
  const openPieMenu = useGameStore((s) => s.openPieMenu);

  const phoneCaseColor = PHONE_CASES_BY_ID[phoneCaseId]?.meshColor ?? '#299c77';
  const plumbobColor = getPlumbobColor(sim.needs, sim.emotion);
  const allObjects = useMemo(
    () => [...placedObjects, ...ALL_NEIGHBOR_OBJECTS],
    [placedObjects],
  );

  const getRuntime = useCallback(() => simRuntime, []);

  const handleSimTap = useCallback(
    (e: ThreeEvent<MouseEvent>, worldPos: THREE.Vector3) => {
      if (shouldIgnoreTap() || mode !== 'live' || wardrobeOpen || sim.awayAtWork) return;
      e.stopPropagation();

      const projected = worldPos.clone().project(camera);
      const screenX = (projected.x * 0.5 + 0.5) * size.width;
      const screenY = (-projected.y * 0.5 + 0.5) * size.height;

      openPieMenu({
        kind: 'sim',
        title: sim.name,
        subtitle: sim.traits.join(' • '),
        screenX,
        screenY,
        worldPos: [worldPos.x, worldPos.y, worldPos.z],
        tile: { x: sim.tileX, z: sim.tileZ },
        options: SELF_INTERACTIONS.slice(0, 3).map((inter) => ({
          id: `self:${inter.id}`,
          label: inter.label,
          icon: inter.icon,
          cost: inter.cost,
        })),
      });
    },
    [camera, mode, openPieMenu, sim.awayAtWork, sim.name, sim.tileX, sim.tileZ, sim.traits, size.height, size.width, wardrobeOpen],
  );

  return (
    <SimRigMesh
      appearance={sim.appearance}
      pose={sim.pose}
      emotion={sim.emotion}
      activeObjectId={sim.activeObjectId}
      activeProp={sim.activeProp}
      phoneCaseColor={phoneCaseColor}
      allObjects={allObjects}
      getRuntime={getRuntime}
      visible={!sim.awayAtWork}
      wardrobePose={wardrobeOpen}
      plumbobColor={plumbobColor}
      speechBubbleIcon={sim.speechBubble?.icon ?? null}
      onTap={handleSimTap}
    />
  );
}
