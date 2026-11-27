import { describe, expect, it } from 'vitest';
import { CATALOG_BY_ID } from '../../data/catalog';
import { STARTER_OBJECTS, STARTER_WALLS } from '../../data/starterLot';
import { buildWallLookup, getBestInteractionSlot, isWallBetween } from '../grid';
import { findPath } from '../pathfinding';

describe('8-directional A* pathfinding', () => {
  it('routes Maya cleanly from the living room through doorways into the bedroom and bathroom', () => {
    const start = { x: 6, z: 7 };

    // Route into bedroom next to bed (10, 4)
    const bedPath = findPath(start, { x: 10, z: 4 }, STARTER_OBJECTS, STARTER_WALLS);
    expect(bedPath).not.toBeNull();
    expect(bedPath!.length).toBeGreaterThan(3);
    // Must cross bedroom doorway (8,6) -> (9,6)
    expect(bedPath!.some((t) => t.x === 9 && t.z === 6)).toBe(true);

    // Route into bathroom in front of toilet (11, 10)
    const bathPath = findPath(start, { x: 11, z: 10 }, STARTER_OBJECTS, STARTER_WALLS);
    expect(bathPath).not.toBeNull();
    expect(bathPath!.some((t) => t.x === 9 && t.z === 9)).toBe(true);

    // Route out the front door onto the patio (6, 12)
    const patioPath = findPath(start, { x: 6, z: 12 }, STARTER_OBJECTS, STARTER_WALLS);
    expect(patioPath).not.toBeNull();
    expect(patioPath!.some((t) => t.x === 6 && t.z === 11)).toBe(true);
  });

  it('never passes through solid walls or cuts diagonal wall corners', () => {
    const wallLookup = buildWallLookup(STARTER_WALLS);
    // Path from bedroom (10, 6) to bathroom (10, 9) must go out bedroom door and through bathroom door
    const path = findPath({ x: 10, z: 6 }, { x: 10, z: 9 }, STARTER_OBJECTS, STARTER_WALLS);
    expect(path).not.toBeNull();

    const fullSteps = [{ x: 10, z: 6 }, ...path!];
    for (let i = 1; i < fullSteps.length; i++) {
      const a = fullSteps[i - 1];
      const b = fullSteps[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.abs(dx) + Math.abs(dz) === 1) {
        expect(isWallBetween(a.x, a.z, b.x, b.z, wallLookup)).toBe(false);
      } else {
        // Verify neither corner edge is a wall
        expect(isWallBetween(a.x, a.z, a.x + dx, a.z, wallLookup)).toBe(false);
        expect(isWallBetween(a.x, a.z, a.x, a.z + dz, wallLookup)).toBe(false);
      }
    }
  });

  it('can reach every interactive furniture piece on the starter lot from Maya start tile', () => {
    const start = { x: 6, z: 7 };
    for (const obj of STARTER_OBJECTS) {
      const item = CATALOG_BY_ID[obj.catalogId];
      if (!item || item.interactions.length === 0) continue;
      const slot = getBestInteractionSlot(obj, item, STARTER_OBJECTS, STARTER_WALLS, start);
      expect(slot).not.toBeNull();
      const path = findPath(start, slot!.tile, STARTER_OBJECTS, STARTER_WALLS);
      expect(path, `Maya should reach ${obj.instanceId}`).not.toBeNull();
    }
  });

  it('returns null when destination tile is occupied by non-walkable furniture', () => {
    const blockedResult = findPath({ x: 6, z: 7 }, { x: 3, z: 3 }, STARTER_OBJECTS, STARTER_WALLS);
    expect(blockedResult).toBeNull();
  });
});
