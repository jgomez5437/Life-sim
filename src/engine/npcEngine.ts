import { CATALOG_BY_ID } from '../data/catalog';
import {
  MAYA_WELCOME_TILE,
  NEIGHBOR_HOUSES,
  NEIGHBOR_HOUSES_BY_ID,
  SIDEWALK_STROLL_TILES,
  isTileInRect,
} from '../data/neighborhood';
import type {
  AnimationPose,
  HeldPropType,
  NeighborHouseId,
  NpcContact,
  NpcWorldState,
  PlacedObject,
  TileCoord,
  WallSegment,
} from '../types/game';
import { getBestInteractionSlot } from './grid';
import { findPath } from './pathfinding';

/** Default cozy interior spawn tiles inside each neighbor's home. */
const NPC_HOME_SPAWN_TILES: Record<string, TileCoord> = {
  npc_nora: { x: -10, z: 8 },
  npc_leo: { x: -11, z: 5 },
  npc_priya: { x: 22, z: 8 },
  npc_marcus: { x: 22, z: 5 },
  npc_camille: { x: 6, z: 26 },
};

export function createInitialNpcWorldStates(contacts: NpcContact[]): NpcWorldState[] {
  return contacts.map((contact, idx) => {
    const house = NEIGHBOR_HOUSES_BY_ID[contact.homeHouseId] ?? NEIGHBOR_HOUSES[0];
    const spawn = NPC_HOME_SPAWN_TILES[contact.id] ?? house.greetTile;
    return {
      contactId: contact.id,
      homeHouseId: house.id,
      tileX: spawn.x,
      tileZ: spawn.z,
      facingAngle: idx % 2 === 0 ? 0 : Math.PI * 0.25,
      pose: 'idle',
      activeObjectId: null,
      activeProp: null,
      visitingMaya: false,
      knockingAtMayaDoor: false,
      talkingWithMaya: false,
      path: [],
      pathIndex: 0,
      pendingGoal: 'idle',
      busyUntilSimMinute: 0,
      speechBubble: null,
    };
  });
}

/**
 * Returns wall IDs for all neighbor front doors Maya has NOT yet been invited into.
 */
export function getLockedDoorWallIdsForMaya(unlockedHouseIds: NeighborHouseId[]): Set<string> {
  const unlockedSet = new Set(unlockedHouseIds);
  const locked = new Set<string>();
  for (const house of NEIGHBOR_HOUSES) {
    if (!unlockedSet.has(house.id)) {
      locked.add(house.frontDoorWallId);
    }
  }
  return locked;
}

/**
 * Residents can freely enter/exit their own house and Maya's front door, while respecting other locked houses.
 */
export function getLockedDoorWallIdsForNpc(npc: NpcWorldState): Set<string> {
  const locked = new Set<string>();
  for (const house of NEIGHBOR_HOUSES) {
    if (house.id !== npc.homeHouseId) {
      locked.add(house.frontDoorWallId);
    }
  }
  return locked;
}

/**
 * NPCs inside a closed-roof neighbor house stay culled until that house is unlocked or they step outside.
 */
export function isNpcVisibleInWorld(
  npc: NpcWorldState,
  unlockedHouseIds: NeighborHouseId[],
): boolean {
  const homeHouse = NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId];
  if (!homeHouse) return true;
  if (unlockedHouseIds.includes(homeHouse.id)) return true;
  return !isTileInRect({ x: npc.tileX, z: npc.tileZ }, homeHouse.houseRect);
}

export interface NpcAutonomyPlan {
  path: TileCoord[];
  pendingGoal: NpcWorldState['pendingGoal'];
  pendingObjectId?: string | null;
  pendingPose?: AnimationPose;
  pendingProp?: HeldPropType | null;
  pendingFacingAngle?: number;
  durationMinutes: number;
}

/**
 * Picks a cozy next wander or furniture activity for an idle NPC.
 */
export function pickNextNpcAutonomyPlan(
  npc: NpcWorldState,
  allObjects: PlacedObject[],
  allWalls: WallSegment[],
  mayaObjects: PlacedObject[],
  hour: number,
  seed: number,
): NpcAutonomyPlan | null {
  const startTile = { x: npc.tileX, z: npc.tileZ };
  const lockedForNpc = getLockedDoorWallIdsForNpc(npc);

  // If visiting Maya's home late at night (after 10:30 PM), head back home
  if (npc.visitingMaya && (hour >= 22 || hour < 6)) {
    const homeSpawn = NPC_HOME_SPAWN_TILES[npc.contactId] ?? NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId].greetTile;
    const path = findPath(startTile, homeSpawn, allObjects, allWalls, lockedForNpc);
    if (path && path.length > 0) {
      return {
        path,
        pendingGoal: 'return_home',
        durationMinutes: 15,
      };
    }
  }

  // If visiting Maya's home, mingle in Maya's living/kitchen area or sit on Maya's sofa
  if (npc.visitingMaya) {
    const guestObjects = mayaObjects.filter((o) => {
      const cat = CATALOG_BY_ID[o.catalogId];
      return (
        cat &&
        (cat.proceduralType === 'sofa' ||
          cat.proceduralType === 'tv_stand' ||
          cat.proceduralType === 'bookshelf' ||
          cat.proceduralType === 'coffee_station')
      );
    });
    if (guestObjects.length > 0 && seed % 3 !== 0) {
      const obj = guestObjects[Math.abs(seed) % guestObjects.length];
      const item = CATALOG_BY_ID[obj.catalogId];
      const inter = item.interactions[0];
      const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedForNpc);
      if (slot && inter) {
        const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedForNpc);
        if (path) {
          return {
            path,
            pendingGoal: 'use_object',
            pendingObjectId: obj.instanceId,
            pendingPose: inter.animationPose,
            pendingProp: inter.heldProp ?? null,
            pendingFacingAngle: slot.facingAngle,
            durationMinutes: 24,
          };
        }
      }
    }

    const mingleSpots: TileCoord[] = [
      MAYA_WELCOME_TILE,
      { x: 6, z: 7 },
      { x: 7, z: 6 },
      { x: 5, z: 8 },
    ];
    const target = mingleSpots[Math.abs(seed) % mingleSpots.length];
    const path = findPath(startTile, target, allObjects, allWalls, lockedForNpc);
    if (path && path.length > 0) {
      return {
        path,
        pendingGoal: 'idle',
        durationMinutes: 18,
      };
    }
    return null;
  }

  // Daytime chance (~30%) to stroll along the sunlit sidewalk or Coastal Pocket Park!
  const isDaytime = hour >= 8 && hour <= 20;
  if (isDaytime && Math.abs(seed) % 10 < 3) {
    const strollTile = SIDEWALK_STROLL_TILES[Math.abs(seed * 3) % SIDEWALK_STROLL_TILES.length];
    const path = findPath(startTile, strollTile, allObjects, allWalls, lockedForNpc);
    if (path && path.length > 0) {
      return {
        path,
        pendingGoal: 'idle',
        durationMinutes: 22,
      };
    }
  }

  // Otherwise use a cozy piece of furniture inside their own home
  const house = NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId];
  if (!house) return null;

  const usable = house.objects.filter((o) => {
    const item = CATALOG_BY_ID[o.catalogId];
    return item && item.interactions.length > 0 && !item.walkable;
  });
  if (usable.length > 0) {
    const obj = usable[Math.abs(seed) % usable.length];
    const item = CATALOG_BY_ID[obj.catalogId];
    const inter = item.interactions[0];
    const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedForNpc);
    if (slot && inter) {
      const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedForNpc);
      if (path) {
        return {
          path,
          pendingGoal: 'use_object',
          pendingObjectId: obj.instanceId,
          pendingPose: inter.animationPose,
          pendingProp: inter.heldProp ?? null,
          pendingFacingAngle: slot.facingAngle,
          durationMinutes: 28,
        };
      }
    }
  }

  return null;
}
