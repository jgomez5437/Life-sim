import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG_BY_ID } from '../../data/catalog';
import {
  ALL_NEIGHBOR_OBJECTS,
  ALL_NEIGHBOR_WALLS,
  MAYA_FRONT_DOOR_OUTSIDE,
  NEIGHBOR_HOUSES,
  NEIGHBOR_HOUSES_BY_ID,
} from '../../data/neighborhood';
import { STARTER_OBJECTS, STARTER_WALLS } from '../../data/starterLot';
import {
  buildWallLookup,
  getBestInteractionSlot,
  getOccupiedTiles,
  isPlacementValid,
  isWallBetween,
} from '../grid';
import {
  getLockedDoorWallIdsForMaya,
  getLockedDoorWallIdsForNpc,
  isNpcVisibleInWorld,
} from '../npcEngine';
import { findPath } from '../pathfinding';
import { getRomanceTier } from '../social';
import { useGameStore } from '../../store/gameStore';

describe('neighborhood geometry, pathfinding, and door locks', () => {
  it('places every neighbor house object without overlaps or wall-straddling and with reachable interaction slots', () => {
    const allWalls = [...STARTER_WALLS, ...ALL_NEIGHBOR_WALLS];
    const allObjects = [...STARTER_OBJECTS, ...ALL_NEIGHBOR_OBJECTS];
    const wallLookup = buildWallLookup(allWalls);

    for (const house of NEIGHBOR_HOUSES) {
      const solidTileSet = new Set<string>();

      for (const obj of house.objects) {
        const item = CATALOG_BY_ID[obj.catalogId];
        expect(item, `Missing catalog item ${obj.catalogId}`).toBeDefined();

        const tiles = getOccupiedTiles(obj.tileX, obj.tileZ, item.footprint, obj.rotation);

        // Must stay inside houseRect
        for (const t of tiles) {
          expect(t.x).toBeGreaterThanOrEqual(house.houseRect.x1);
          expect(t.x).toBeLessThanOrEqual(house.houseRect.x2);
          expect(t.z).toBeGreaterThanOrEqual(house.houseRect.z1);
          expect(t.z).toBeLessThanOrEqual(house.houseRect.z2);

          if (!item.walkable) {
            const key = `${t.x},${t.z}`;
            expect(solidTileSet.has(key), `Overlap at ${key} in ${house.id} (${obj.instanceId})`).toBe(
              false,
            );
            solidTileSet.add(key);
          }
        }

        // Must not straddle an interior wall
        for (let i = 0; i < tiles.length; i++) {
          for (let j = i + 1; j < tiles.length; j++) {
            const a = tiles[i];
            const b = tiles[j];
            if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1) {
              expect(
                isWallBetween(a.x, a.z, b.x, b.z, wallLookup),
                `Object ${obj.instanceId} straddles wall between (${a.x},${a.z}) and (${b.x},${b.z})`,
              ).toBe(false);
            }
          }
        }

        // Every interactive neighbor object should be reachable from greetTile once unlocked
        if (item.interactions.length > 0) {
          const slot = getBestInteractionSlot(
            obj,
            item,
            allObjects,
            allWalls,
            house.greetTile,
            new Set(),
          );
          expect(slot, `No interaction slot for ${obj.instanceId}`).not.toBeNull();
          if (slot) {
            const path = findPath(
              house.greetTile,
              slot.tile,
              allObjects,
              allWalls,
              new Set(),
            );
            expect(
              path,
              `Unreachable neighbor object ${obj.instanceId} from ${house.id} greetTile`,
            ).not.toBeNull();
          }
        }
      }
    }
  });

  it('blocks Maya from entering locked neighbor houses while letting residents walk out onto the sidewalk', () => {
    const allWalls = [...STARTER_WALLS, ...ALL_NEIGHBOR_WALLS];
    const allObjects = [...STARTER_OBJECTS, ...ALL_NEIGHBOR_OBJECTS];
    const mayaStart = { x: 6, z: 9 };

    const sagewood = NEIGHBOR_HOUSES_BY_ID.sagewood_cottage;
    const lockedForMaya = getLockedDoorWallIdsForMaya([]);

    // Maya CANNOT enter Sagewood before knocking
    const blockedPath = findPath(
      mayaStart,
      sagewood.greetTile,
      allObjects,
      allWalls,
      lockedForMaya,
    );
    expect(blockedPath).toBeNull();

    // Maya CAN walk right up to Sagewood's front porch knockTile
    const knockPath = findPath(mayaStart, sagewood.knockTile, allObjects, allWalls, lockedForMaya);
    expect(knockPath).not.toBeNull();

    // Once unlocked, Maya CAN walk inside Sagewood
    const unlockedForMaya = getLockedDoorWallIdsForMaya(['sagewood_cottage']);
    const insidePath = findPath(
      mayaStart,
      sagewood.greetTile,
      allObjects,
      allWalls,
      unlockedForMaya,
    );
    expect(insidePath).not.toBeNull();

    // A resident of Sagewood CAN walk out of their own locked house to the sidewalk
    useGameStore.getState().resetStarterLot();
    const nora = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_nora')!;
    const residentLocks = getLockedDoorWallIdsForNpc(nora);
    const residentExit = findPath(
      sagewood.greetTile,
      { x: -9, z: 16 },
      allObjects,
      allWalls,
      residentLocks,
    );
    expect(residentExit).not.toBeNull();
  });

  it('keeps Build & Buy placement strictly restricted to Maya home lot 0..15', () => {
    const allWalls = [...STARTER_WALLS, ...ALL_NEIGHBOR_WALLS];
    const allObjects = [...STARTER_OBJECTS, ...ALL_NEIGHBOR_OBJECTS];
    const plant = CATALOG_BY_ID.monstera_plant;

    expect(isPlacementValid(plant, -9, 11, 0, allObjects, allWalls)).toBe(false);
    expect(isPlacementValid(plant, 24, 11, 0, allObjects, allWalls)).toBe(false);
    expect(isPlacementValid(plant, 7, 22, 0, allObjects, allWalls)).toBe(false);
  });

  it('culls indoor NPCs while their house roof is on and reveals them once unlocked or strolling outside', () => {
    useGameStore.getState().resetStarterLot();
    const nora = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_nora')!;
    expect(isNpcVisibleInWorld(nora, [])).toBe(false);
    expect(isNpcVisibleInWorld(nora, ['sagewood_cottage'])).toBe(true);

    // Outdoor NPC on sidewalk is always visible even with roof on
    const outdoorNora = { ...nora, tileX: -9, tileZ: 16 };
    expect(isNpcVisibleInWorld(outdoorNora, [])).toBe(true);
  });
});

describe('knocking, guest etiquette, face-to-face socializing, and doorbell visits', () => {
  beforeEach(() => {
    useGameStore.getState().resetStarterLot();
  });

  it('unlocks a neighbor house after Maya knocks and allows guest furniture use with Polite Guest etiquette', () => {
    expect(useGameStore.getState().unlockedHouseIds).toEqual([]);

    // Queue knock on Sagewood Cottage
    expect(useGameStore.getState().enqueueKnockOnHouse('sagewood_cottage')).toBe(true);
    expect(useGameStore.getState().actionQueue[0].kind).toBe('knock');

    // Arrive at porch & complete knock duration
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(10);

    const afterKnock = useGameStore.getState();
    expect(afterKnock.unlockedHouseIds).toContain('sagewood_cottage');
    expect(afterKnock.actionQueue.length).toBe(0);

    // Guest-friendly sofa inside Sagewood works immediately
    expect(useGameStore.getState().enqueueObjectInteraction('sc_sofa', 'relax_sofa')).toBe(true);
    useGameStore.getState().cancelAction(useGameStore.getState().actionQueue[0].id);

    // Polite Guest etiquette: neighbor dresser wardrobe is blocked
    expect(useGameStore.getState().enqueueObjectInteraction('sc_dresser', 'change_outfit')).toBe(
      false,
    );

    // At Breezeview Loft, both Priya (44) & Marcus (52) start below Good Friend (< 65)
    expect(useGameStore.getState().enqueueKnockOnHouse('breezeview_loft')).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(10);
    expect(useGameStore.getState().unlockedHouseIds).toContain('breezeview_loft');

    // Guest bed at Breezeview Loft is blocked while residents are < 65 relationship
    expect(useGameStore.getState().enqueueObjectInteraction('bl_bed', 'sleep')).toBe(false);

    // Raise Marcus to Good Friend (65+) -> neighbor bed is now allowed!
    useGameStore.setState((s) => ({
      contacts: s.contacts.map((c) => (c.id === 'npc_marcus' ? { ...c, relationship: 70 } : c)),
    }));
    expect(useGameStore.getState().enqueueObjectInteraction('bl_bed', 'sleep')).toBe(true);
  });

  it('supports face-to-face socializing with Friendship + Romance gains, tiers, speech bubbles, and Social Bunny posts', () => {
    // Unlock Sagewood so Maya can reach Nora directly
    useGameStore.setState({ unlockedHouseIds: ['sagewood_cottage'] });

    const beforeContact = useGameStore
      .getState()
      .contacts.find((c) => c.id === 'npc_nora')!;
    const beforeFeedCount = useGameStore.getState().socialFeed.length;

    expect(useGameStore.getState().enqueueNpcInteraction('npc_nora', 'f2f_flirt')).toBe(true);
    expect(useGameStore.getState().actionQueue[0].kind).toBe('social_npc');

    // Begin face-to-face flirt -> both Sims show heart bubbles and talkingWithMaya is active
    useGameStore.getState().beginPerformingActiveAction();
    const mid = useGameStore.getState();
    expect(mid.sim.pose).toBe('talk');
    expect(mid.sim.speechBubble?.icon).toBe('heart');
    const midNora = mid.npcs.find((n) => n.contactId === 'npc_nora')!;
    expect(midNora.talkingWithMaya).toBe(true);
    expect(midNora.speechBubble?.icon).toBe('heart');

    // Complete flirt
    useGameStore.getState().tickSimMinutes(20);
    const after = useGameStore.getState();
    const afterContact = after.contacts.find((c) => c.id === 'npc_nora')!;
    expect(afterContact.relationship).toBeGreaterThan(beforeContact.relationship);
    expect(afterContact.romance).toBeGreaterThan(beforeContact.romance);
    expect(after.socialFeed.length).toBeGreaterThan(beforeFeedCount);
    expect(after.npcs.find((n) => n.contactId === 'npc_nora')?.talkingWithMaya).toBe(false);

    // Verify romance tiers
    expect(getRomanceTier(0)).toBe('none');
    expect(getRomanceTier(20)).toBe('crush');
    expect(getRomanceTier(50)).toBe('romantic_interest');
    expect(getRomanceTier(85)).toBe('partner');
  });

  it('handles Invite Over -> Doorbell prompt -> Invite In -> Send Home lifecycle cleanly', () => {
    // Invite Camille over via smartphone
    expect(useGameStore.getState().inviteContactOver('npc_camille')).toBe(true);
    let camille = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_camille')!;
    expect(camille.pendingGoal).toBe('visit_maya_door');
    expect(camille.path.length).toBeGreaterThan(0);

    // Simulate Camille arriving at Maya's front door
    useGameStore
      .getState()
      .updateNpcTile('npc_camille', MAYA_FRONT_DOOR_OUTSIDE, Math.PI, camille.path.length);
    useGameStore.getState().finishNpcRoute('npc_camille');

    expect(useGameStore.getState().doorbellPrompt?.contactId).toBe('npc_camille');
    camille = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_camille')!;
    expect(camille.knockingAtMayaDoor).toBe(true);

    // Maya invites Camille inside
    useGameStore.getState().respondToDoorbell(true);
    expect(useGameStore.getState().doorbellPrompt).toBeNull();
    camille = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_camille')!;
    expect(camille.visitingMaya).toBe(true);
    expect(camille.knockingAtMayaDoor).toBe(false);

    // Maya sends Camille home
    useGameStore.getState().sendVisitorHome('npc_camille');
    camille = useGameStore.getState().npcs.find((n) => n.contactId === 'npc_camille')!;
    expect(camille.visitingMaya).toBe(false);
    expect(camille.pendingGoal).toBe('return_home');
  });
});
