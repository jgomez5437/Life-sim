import { useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';
import { ALL_NEIGHBOR_OBJECTS } from '../data/neighborhood';
import { FACE_TO_FACE_SOCIAL_ACTIONS } from '../data/phoneData';
import { isNpcVisibleInWorld } from '../engine/npcEngine';
import { ensureNpcRuntime } from '../engine/npcRuntime';
import { RELATIONSHIP_TIER_META, getRelationshipTier } from '../engine/social';
import { useGameStore } from '../store/gameStore';
import type { NpcContact, NpcWorldState, PlacedObject } from '../types/game';
import { SimRigMesh } from './SimRigMesh';
import { shouldIgnoreTap } from './pointerGuard';

function SingleNpcAvatar({
  npc,
  contact,
  visible,
  allObjects,
}: {
  npc: NpcWorldState;
  contact: NpcContact;
  visible: boolean;
  allObjects: PlacedObject[];
}) {
  const { camera, size } = useThree();
  const mode = useGameStore((s) => s.mode);
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);
  const openPieMenu = useGameStore((s) => s.openPieMenu);

  const getRuntime = useCallback(() => ensureNpcRuntime(npc), [npc]);

  const handleNpcTap = useCallback(
    (e: ThreeEvent<MouseEvent>, worldPos: THREE.Vector3) => {
      if (shouldIgnoreTap() || mode !== 'live' || wardrobeOpen) return;
      e.stopPropagation();

      if (useGameStore.getState().sim.awayAtWork) {
        useGameStore.getState().addFeedback('Maya is at work right now!', 'info');
        return;
      }

      const projected = worldPos.clone().project(camera);
      const screenX = (projected.x * 0.5 + 0.5) * size.width;
      const screenY = (-projected.y * 0.5 + 0.5) * size.height;
      const tier = RELATIONSHIP_TIER_META[getRelationshipTier(contact.relationship)].label;

      const options = FACE_TO_FACE_SOCIAL_ACTIONS.map((act) => ({
        id: `npc:${contact.id}:${act.id}`,
        label: act.label,
        icon: act.icon,
      }));

      if (npc.visitingMaya) {
        options.push({
          id: `npc_send_home:${contact.id}`,
          label: 'Send Home',
          icon: 'footprints',
        });
      }

      openPieMenu({
        kind: 'npc',
        title: contact.name,
        subtitle: `${contact.role} • ${tier}`,
        screenX,
        screenY,
        worldPos: [worldPos.x, worldPos.y, worldPos.z],
        npcId: contact.id,
        tile: { x: npc.tileX, z: npc.tileZ },
        options,
      });
    },
    [
      camera,
      contact.id,
      contact.name,
      contact.relationship,
      contact.role,
      mode,
      npc.tileX,
      npc.tileZ,
      npc.visitingMaya,
      openPieMenu,
      size.height,
      size.width,
      wardrobeOpen,
    ],
  );

  return (
    <SimRigMesh
      appearance={contact.appearance}
      pose={npc.pose}
      emotion={npc.talkingWithMaya ? 'happy' : 'fine'}
      activeObjectId={npc.activeObjectId}
      activeProp={npc.activeProp}
      allObjects={allObjects}
      getRuntime={getRuntime}
      visible={visible}
      speechBubbleIcon={npc.speechBubble?.icon ?? null}
      onTap={handleNpcTap}
    />
  );
}

export function NpcCharacters() {
  const npcs = useGameStore((s) => s.npcs);
  const contacts = useGameStore((s) => s.contacts);
  const unlockedHouseIds = useGameStore((s) => s.unlockedHouseIds);
  const placedObjects = useGameStore((s) => s.placedObjects);

  const allObjects = useMemo(
    () => [...placedObjects, ...ALL_NEIGHBOR_OBJECTS],
    [placedObjects],
  );

  return (
    <group>
      {npcs.map((npc) => {
        const contact = contacts.find((c) => c.id === npc.contactId);
        if (!contact) return null;
        const visible = isNpcVisibleInWorld(npc, unlockedHouseIds);
        return (
          <SingleNpcAvatar
            key={npc.contactId}
            npc={npc}
            contact={contact}
            visible={visible}
            allObjects={allObjects}
          />
        );
      })}
    </group>
  );
}
