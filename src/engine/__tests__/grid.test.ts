import { describe, expect, it } from 'vitest';
import { CATALOG_BY_ID } from '../../data/catalog';
import { STARTER_OBJECTS, STARTER_WALLS } from '../../data/starterLot';
import {
  getBestInteractionSlot,
  getEffectiveFootprint,
  getOccupiedTiles,
  isPlacementValid,
} from '../grid';

describe('spatial grid & Build/Buy validation', () => {
  it('computes rotated effective footprints and occupied tiles accurately', () => {
    expect(getEffectiveFootprint([2, 1], 0)).toEqual([2, 1]);
    expect(getEffectiveFootprint([2, 1], 90)).toEqual([1, 2]);
    expect(getEffectiveFootprint([2, 1], 180)).toEqual([2, 1]);
    expect(getEffectiveFootprint([2, 1], 270)).toEqual([1, 2]);

    const tiles = getOccupiedTiles(4, 7, [2, 1], 90);
    expect(tiles).toEqual([
      { x: 4, z: 7 },
      { x: 4, z: 8 },
    ]);
  });

  it('validates that every pre-placed starter object fits cleanly without collisions', () => {
    for (const obj of STARTER_OBJECTS) {
      const item = CATALOG_BY_ID[obj.catalogId];
      expect(item).toBeDefined();
      const valid = isPlacementValid(
        item,
        obj.tileX,
        obj.tileZ,
        obj.rotation,
        STARTER_OBJECTS,
        STARTER_WALLS,
        { excludeInstanceId: obj.instanceId, simTile: { x: 6, z: 7 } },
      );
      expect(valid, `Starter object ${obj.instanceId} (${obj.catalogId}) should be valid`).toBe(true);
    }
  });

  it('rejects out-of-bounds placement, overlapping furniture, and wall-straddling footprints', () => {
    const sofa = CATALOG_BY_ID.plush_sofa;
    // Out of bounds
    expect(isPlacementValid(sofa, 15, 7, 0, STARTER_OBJECTS, STARTER_WALLS)).toBe(false);
    // Overlaps existing sofa at (4,7)-(5,7)
    expect(isPlacementValid(sofa, 4, 7, 0, STARTER_OBJECTS, STARTER_WALLS)).toBe(false);
    // Straddles interior wall at x=9 (occupies x=8 and x=9)
    expect(isPlacementValid(sofa, 8, 5, 0, STARTER_OBJECTS, STARTER_WALLS)).toBe(false);
    // Valid open tile in yard
    expect(isPlacementValid(sofa, 1, 1, 0, STARTER_OBJECTS, STARTER_WALLS)).toBe(true);
  });

  it('resolves an unobstructed interaction slot for every interactive starter object', () => {
    for (const obj of STARTER_OBJECTS) {
      const item = CATALOG_BY_ID[obj.catalogId];
      if (!item || item.interactions.length === 0) continue;
      const slot = getBestInteractionSlot(obj, item, STARTER_OBJECTS, STARTER_WALLS, { x: 6, z: 7 });
      expect(slot, `Expected valid interaction slot for ${obj.instanceId}`).not.toBeNull();
    }
  });
});
