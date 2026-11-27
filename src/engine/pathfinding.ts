import type { PlacedObject, TileCoord, WallSegment } from '../types/game';
import {
  buildBlockedTileSet,
  buildWallLookup,
  isInLotBounds,
  isWallBetween,
} from './grid';

interface PathNode {
  x: number;
  z: number;
  g: number;
  f: number;
  parent: PathNode | null;
}

const DIRECTIONS: Array<[dx: number, dz: number, cost: number]> = [
  [0, 1, 1],
  [0, -1, 1],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

function octileHeuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

/**
 * 8-directional A* pathfinder across the 16x16 lot with wall-edge checks and corner-cut prevention.
 * Returns the sequence of tiles to traverse (excluding `start`, including `goal`), or `null` if unreachable.
 */
export function findPath(
  start: TileCoord,
  goal: TileCoord,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
): TileCoord[] | null {
  if (!isInLotBounds(start.x, start.z) || !isInLotBounds(goal.x, goal.z)) {
    return null;
  }

  if (start.x === goal.x && start.z === goal.z) {
    return [];
  }

  const blocked = buildBlockedTileSet(placedObjects);
  const goalKey = `${goal.x},${goal.z}`;
  if (blocked.has(goalKey)) {
    return null;
  }

  const wallLookup = buildWallLookup(walls);
  const startKey = `${start.x},${start.z}`;

  const openList: PathNode[] = [
    {
      x: start.x,
      z: start.z,
      g: 0,
      f: octileHeuristic(start.x, start.z, goal.x, goal.z),
      parent: null,
    },
  ];
  const gScore = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();

  while (openList.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) {
        bestIdx = i;
      }
    }

    const current = openList.splice(bestIdx, 1)[0];
    const currentKey = `${current.x},${current.z}`;

    if (current.x === goal.x && current.z === goal.z) {
      const path: TileCoord[] = [];
      let cursor: PathNode | null = current;
      while (cursor && cursor.parent) {
        path.push({ x: cursor.x, z: cursor.z });
        cursor = cursor.parent;
      }
      path.reverse();
      return path;
    }

    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const [dx, dz, stepCost] of DIRECTIONS) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      if (!isInLotBounds(nx, nz)) continue;

      const neighborKey = `${nx},${nz}`;
      if (closed.has(neighborKey) || blocked.has(neighborKey)) continue;

      if (dx === 0 || dz === 0) {
        if (isWallBetween(current.x, current.z, nx, nz, wallLookup)) continue;
      } else {
        // Strict corner-cut prevention for diagonal moves
        const ortho1Key = `${current.x + dx},${current.z}`;
        const ortho2Key = `${current.x},${current.z + dz}`;
        if (blocked.has(ortho1Key) || blocked.has(ortho2Key)) continue;

        if (
          isWallBetween(current.x, current.z, current.x + dx, current.z, wallLookup) ||
          isWallBetween(current.x, current.z, current.x, current.z + dz, wallLookup) ||
          isWallBetween(current.x + dx, current.z, nx, nz, wallLookup) ||
          isWallBetween(current.x, current.z + dz, nx, nz, wallLookup)
        ) {
          continue;
        }
      }

      const tentativeG = current.g + stepCost;
      const prevBest = gScore.get(neighborKey);
      if (prevBest === undefined || tentativeG < prevBest) {
        gScore.set(neighborKey, tentativeG);
        openList.push({
          x: nx,
          z: nz,
          g: tentativeG,
          f: tentativeG + octileHeuristic(nx, nz, goal.x, goal.z),
          parent: current,
        });
      }
    }
  }

  return null;
}
