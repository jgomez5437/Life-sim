import { CATALOG_BY_ID } from '../data/catalog';
import { LOT_SIZE } from '../data/starterLot';
import type { CatalogItem, PlacedObject, RotationDeg, TileCoord, WallSegment } from '../types/game';

export const TILE_SIZE = 1;

export function tileToWorld(tileX: number, tileZ: number): { x: number; z: number } {
  return {
    x: tileX - LOT_SIZE / 2 + 0.5,
    z: tileZ - LOT_SIZE / 2 + 0.5,
  };
}

export function worldToTile(worldX: number, worldZ: number): TileCoord {
  return {
    x: Math.floor(worldX + LOT_SIZE / 2),
    z: Math.floor(worldZ + LOT_SIZE / 2),
  };
}

export function isInLotBounds(tileX: number, tileZ: number): boolean {
  return tileX >= 0 && tileX < LOT_SIZE && tileZ >= 0 && tileZ < LOT_SIZE;
}

export function getEffectiveFootprint(
  footprint: [number, number],
  rotation: RotationDeg,
): [number, number] {
  const [w, d] = footprint;
  return rotation === 90 || rotation === 270 ? [d, w] : [w, d];
}

export function getOccupiedTiles(
  tileX: number,
  tileZ: number,
  footprint: [number, number],
  rotation: RotationDeg,
): TileCoord[] {
  const [effW, effD] = getEffectiveFootprint(footprint, rotation);
  const tiles: TileCoord[] = [];
  for (let dx = 0; dx < effW; dx++) {
    for (let dz = 0; dz < effD; dz++) {
      tiles.push({ x: tileX + dx, z: tileZ + dz });
    }
  }
  return tiles;
}

export function getObjectWorldCenter(
  tileX: number,
  tileZ: number,
  footprint: [number, number],
  rotation: RotationDeg,
): { x: number; z: number } {
  const [effW, effD] = getEffectiveFootprint(footprint, rotation);
  return {
    x: tileX + effW / 2 - LOT_SIZE / 2,
    z: tileZ + effD / 2 - LOT_SIZE / 2,
  };
}

export function rotateLocalVector(
  dx: number,
  dz: number,
  rotation: RotationDeg,
): { rx: number; rz: number } {
  switch (rotation) {
    case 0:
      return { rx: dx, rz: dz };
    case 90:
      return { rx: dz, rz: -dx };
    case 180:
      return { rx: -dx, rz: -dz };
    case 270:
      return { rx: -dz, rz: dx };
  }
}

export interface WallLookup {
  horizontalBlocked: Set<string>;
  verticalBlocked: Set<string>;
}

export function buildWallLookup(walls: WallSegment[]): WallLookup {
  const horizontalBlocked = new Set<string>();
  const verticalBlocked = new Set<string>();

  for (const wall of walls) {
    if (wall.kind === 'door') continue;
    const key = `${wall.x},${wall.z}`;
    if (wall.orientation === 'horizontal') {
      horizontalBlocked.add(key);
    } else {
      verticalBlocked.add(key);
    }
  }

  return { horizontalBlocked, verticalBlocked };
}

/**
 * Checks whether a solid/window wall sits directly between two orthogonally adjacent tiles.
 */
export function isWallBetween(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  wallLookup: WallLookup,
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;

  if (dx === 1) {
    return wallLookup.verticalBlocked.has(`${x2},${z1}`);
  }
  if (dx === -1) {
    return wallLookup.verticalBlocked.has(`${x1},${z1}`);
  }
  if (dz === 1) {
    return wallLookup.horizontalBlocked.has(`${x1},${z2}`);
  }
  if (dz === -1) {
    return wallLookup.horizontalBlocked.has(`${x1},${z1}`);
  }
  return false;
}

export function buildBlockedTileSet(
  placedObjects: PlacedObject[],
  excludeInstanceId?: string,
): Set<string> {
  const blocked = new Set<string>();
  for (const obj of placedObjects) {
    if (obj.instanceId === excludeInstanceId) continue;
    const item = CATALOG_BY_ID[obj.catalogId];
    if (!item || item.walkable) continue;
    const tiles = getOccupiedTiles(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
    for (const tile of tiles) {
      blocked.add(`${tile.x},${tile.z}`);
    }
  }
  return blocked;
}

export function isPlacementValid(
  item: CatalogItem,
  tileX: number,
  tileZ: number,
  rotation: RotationDeg,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  options?: {
    excludeInstanceId?: string;
    simTile?: TileCoord;
  },
): boolean {
  const tiles = getOccupiedTiles(tileX, tileZ, item.footprint, rotation);

  // 1. Bounds check
  for (const tile of tiles) {
    if (!isInLotBounds(tile.x, tile.z)) return false;
  }

  // 2. Prevent straddling any wall (solid, window, or door) across a multi-tile footprint
  const allWallEdges = {
    horizontalBlocked: new Set<string>(),
    verticalBlocked: new Set<string>(),
  };
  for (const wall of walls) {
    const key = `${wall.x},${wall.z}`;
    if (wall.orientation === 'horizontal') {
      allWallEdges.horizontalBlocked.add(key);
    } else {
      allWallEdges.verticalBlocked.add(key);
    }
  }

  const tileKeySet = new Set(tiles.map((t) => `${t.x},${t.z}`));
  for (const t of tiles) {
    if (tileKeySet.has(`${t.x + 1},${t.z}`) && isWallBetween(t.x, t.z, t.x + 1, t.z, allWallEdges)) {
      return false;
    }
    if (tileKeySet.has(`${t.x},${t.z + 1}`) && isWallBetween(t.x, t.z, t.x, t.z + 1, allWallEdges)) {
      return false;
    }
  }

  // 3. Walkable items (rugs) cannot overlap other walkable items, but can sit beneath furniture
  if (item.walkable) {
    for (const obj of placedObjects) {
      if (obj.instanceId === options?.excludeInstanceId) continue;
      const other = CATALOG_BY_ID[obj.catalogId];
      if (!other || !other.walkable) continue;
      const otherTiles = getOccupiedTiles(obj.tileX, obj.tileZ, other.footprint, obj.rotation);
      for (const ot of otherTiles) {
        if (tileKeySet.has(`${ot.x},${ot.z}`)) return false;
      }
    }
    return true;
  }

  // 4. Non-walkable furniture cannot overlap other non-walkable furniture
  const blocked = buildBlockedTileSet(placedObjects, options?.excludeInstanceId);
  for (const t of tiles) {
    if (blocked.has(`${t.x},${t.z}`)) return false;
  }

  // 5. Avoid dropping furniture directly onto the active Sim
  if (options?.simTile && tileKeySet.has(`${options.simTile.x},${options.simTile.z}`)) {
    return false;
  }

  return true;
}

export interface InteractionSlotResult {
  tile: TileCoord;
  facingAngle: number;
}

/**
 * Finds the best unobstructed tile from which a Sim can interact with a placed object.
 */
export function getBestInteractionSlot(
  obj: PlacedObject,
  item: CatalogItem,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  simTile: TileCoord,
): InteractionSlotResult | null {
  const [effW, effD] = getEffectiveFootprint(item.footprint, obj.rotation);
  const centerTileX = obj.tileX + effW / 2;
  const centerTileZ = obj.tileZ + effD / 2;
  const objWorld = getObjectWorldCenter(obj.tileX, obj.tileZ, item.footprint, obj.rotation);

  if (item.walkable) {
    return {
      tile: { x: obj.tileX, z: obj.tileZ },
      facingAngle: (obj.rotation * Math.PI) / 180,
    };
  }

  const blocked = buildBlockedTileSet(placedObjects);
  const wallLookup = buildWallLookup(walls);
  const occupied = getOccupiedTiles(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
  const occupiedSet = new Set(occupied.map((t) => `${t.x},${t.z}`));

  const isValidSlot = (candidate: TileCoord): boolean => {
    if (!isInLotBounds(candidate.x, candidate.z)) return false;
    const key = `${candidate.x},${candidate.z}`;
    if (blocked.has(key)) return false;

    // Ensure at least one orthogonally adjacent tile of the object is reachable without crossing a wall
    for (const occ of occupied) {
      const manhattan = Math.abs(occ.x - candidate.x) + Math.abs(occ.z - candidate.z);
      if (manhattan === 1 && !isWallBetween(candidate.x, candidate.z, occ.x, occ.z, wallLookup)) {
        return true;
      }
    }
    return false;
  };

  // 1. Try primary preferred interactionOffset first
  const { rx, rz } = rotateLocalVector(item.interactionOffset[0], item.interactionOffset[1], obj.rotation);
  const preferred: TileCoord = {
    x: Math.floor(centerTileX + rx - 0.0001),
    z: Math.floor(centerTileZ + rz - 0.0001),
  };

  if (isValidSlot(preferred)) {
    const slotWorld = tileToWorld(preferred.x, preferred.z);
    const facingAngle = Math.atan2(objWorld.x - slotWorld.x, objWorld.z - slotWorld.z);
    return { tile: preferred, facingAngle };
  }

  // 2. Fallback: find closest valid perimeter tile around the object footprint
  const candidates: TileCoord[] = [];
  const seen = new Set<string>();
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const occ of occupied) {
    for (const [dx, dz] of dirs) {
      const nx = occ.x + dx;
      const nz = occ.z + dz;
      const key = `${nx},${nz}`;
      if (occupiedSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      const cand = { x: nx, z: nz };
      if (isValidSlot(cand)) {
        candidates.push(cand);
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const distA = Math.hypot(a.x - simTile.x, a.z - simTile.z);
    const distB = Math.hypot(b.x - simTile.x, b.z - simTile.z);
    return distA - distB;
  });

  const best = candidates[0];
  const slotWorld = tileToWorld(best.x, best.z);
  const facingAngle = Math.atan2(objWorld.x - slotWorld.x, objWorld.z - slotWorld.z);
  return { tile: best, facingAngle };
}
