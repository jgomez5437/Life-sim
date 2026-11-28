import type { NpcWorldState } from '../types/game';
import { tileToWorld } from './grid';

export interface NpcRuntimeEntry {
  worldX: number;
  worldZ: number;
  facingAngle: number;
  walkCycle: number;
  isMoving: boolean;
}

/**
 * High-frequency mutable NPC movement state updated at 60 FPS inside R3F's useFrame without triggering React re-renders.
 */
export const npcRuntimeMap: Record<string, NpcRuntimeEntry> = {};

export function ensureNpcRuntime(npc: NpcWorldState): NpcRuntimeEntry {
  let entry = npcRuntimeMap[npc.contactId];
  if (!entry) {
    const world = tileToWorld(npc.tileX, npc.tileZ);
    entry = {
      worldX: world.x,
      worldZ: world.z,
      facingAngle: npc.facingAngle,
      walkCycle: 0,
      isMoving: false,
    };
    npcRuntimeMap[npc.contactId] = entry;
  }
  return entry;
}

export function syncNpcRuntimeToTile(
  contactId: string,
  tileX: number,
  tileZ: number,
  facingAngle = 0,
): void {
  const world = tileToWorld(tileX, tileZ);
  npcRuntimeMap[contactId] = {
    worldX: world.x,
    worldZ: world.z,
    facingAngle,
    walkCycle: 0,
    isMoving: false,
  };
}

export function syncAllNpcsRuntime(npcs: NpcWorldState[]): void {
  for (const npc of npcs) {
    syncNpcRuntimeToTile(npc.contactId, npc.tileX, npc.tileZ, npc.facingAngle);
  }
}
