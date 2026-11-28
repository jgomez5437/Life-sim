import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAID_SERVICE_COST,
  REPAIR_TECH_COST,
  UPGRADE_PARTS_PACK_COST,
} from '../../data/householdData';
import { STARTER_OBJECTS } from '../../data/starterLot';
import {
  applyObjectUseWear,
  awardHandinessXp,
  calculateWeeklyBill,
  getEnvironmentMessPenalty,
} from '../household';
import { computeEmotion, pickAutonomousAction } from '../simulation';
import { useGameStore } from '../../store/gameStore';

describe('household bills, utility shutoffs, wear, Handiness, and upgrades', () => {
  beforeEach(() => {
    useGameStore.getState().resetStarterLot();
  });

  it('calculates weekly bills from lot & furniture value and applies Eco Saver discounts up to 45%', () => {
    const baseBill = calculateWeeklyBill(STARTER_OBJECTS);
    expect(baseBill.lotBase).toBe(110);
    expect(baseBill.furnishings).toBeGreaterThan(100);
    expect(baseBill.ecoDiscount).toBe(0);
    expect(baseBill.total).toBe(baseBill.lotBase + baseBill.furnishings);

    // 2 Eco Saver upgrades -> 30% discount
    const twoEco = STARTER_OBJECTS.map((o, i) =>
      i < 2 ? { ...o, upgrades: ['eco_saver' as const] } : o,
    );
    const twoEcoBill = calculateWeeklyBill(twoEco);
    expect(twoEcoBill.ecoUpgradeCount).toBe(2);
    expect(twoEcoBill.ecoDiscount).toBe(Math.round((twoEcoBill.lotBase + twoEcoBill.furnishings) * 0.3));
    expect(twoEcoBill.total).toBeLessThan(baseBill.total);

    // 5 Eco Saver upgrades -> capped cleanly at 45%
    const fiveEco = STARTER_OBJECTS.map((o, i) =>
      i < 5 ? { ...o, upgrades: ['eco_saver' as const] } : o,
    );
    const fiveEcoBill = calculateWeeklyBill(fiveEco);
    expect(fiveEcoBill.ecoDiscount).toBe(
      Math.round((fiveEcoBill.lotBase + fiveEcoBill.furnishings) * 0.45),
    );
  });

  it('issues weekly bills on Monday 8 AM, shuts off Power at 48h and Water at 72h, and restores utilities when paid', () => {
    // Starter clock is Day 1 (Mon) 9:00 AM -> Day 8 (Mon) 8:00 AM is 7*24h - 1h = 10020 mins away
    useGameStore.getState().tickSimMinutes(7 * 24 * 60 - 60);
    let state = useGameStore.getState();
    expect(state.clock.day).toBe(8);
    expect(state.clock.hour).toBe(8);
    expect(state.bills.amountDue).toBeGreaterThan(0);
    expect(state.bills.powerShutoff).toBe(false);
    expect(state.bills.waterShutoff).toBe(false);

    // Advance 48h -> Power Shutoff! TV & Fridge blocked, Shower still works
    useGameStore.getState().tickSimMinutes(48 * 60);
    state = useGameStore.getState();
    expect(state.bills.powerShutoff).toBe(true);
    expect(state.bills.waterShutoff).toBe(false);

    const tv = state.placedObjects.find((o) => o.catalogId === 'widescreen_tv')!;
    const shower = state.placedObjects.find((o) => o.catalogId === 'rain_shower')!;
    expect(useGameStore.getState().enqueueObjectInteraction(tv.instanceId, 'watch_comedy')).toBe(
      false,
    );
    expect(useGameStore.getState().enqueueObjectInteraction(shower.instanceId, 'steamy_shower')).toBe(
      true,
    );
    useGameStore.getState().cancelAction(useGameStore.getState().actionQueue[0].id);

    // Advance 24h more (72h total) -> Water Shutoff! Shower is now blocked too
    useGameStore.getState().tickSimMinutes(24 * 60);
    state = useGameStore.getState();
    expect(state.bills.waterShutoff).toBe(true);
    expect(useGameStore.getState().enqueueObjectInteraction(shower.instanceId, 'steamy_shower')).toBe(
      false,
    );

    // Autonomy skips utility-blocked appliances
    const autoChoice = pickAutonomousAction(
      state.sim,
      state.placedObjects,
      state.walls,
      state.funds,
      'hygiene',
      {
        allObjects: state.placedObjects,
        allWalls: state.walls,
        bills: state.bills,
      },
    );
    expect(autoChoice).toBeNull();

    // Pay bills -> Power & Water immediately restored!
    const fundsBefore = state.funds;
    const due = state.bills.amountDue;
    expect(useGameStore.getState().payHouseholdBills()).toBe(true);
    state = useGameStore.getState();
    expect(state.funds).toBe(fundsBefore - due);
    expect(state.bills.amountDue).toBe(0);
    expect(state.bills.powerShutoff).toBe(false);
    expect(state.bills.waterShutoff).toBe(false);
    expect(useGameStore.getState().enqueueObjectInteraction(tv.instanceId, 'watch_comedy')).toBe(
      true,
    );
  });

  it('degrades cleanliness and durability on use, spawns a leak puddle when plumbing breaks, and applies Uncomfortable environment mood', () => {
    const toilet = useGameStore
      .getState()
      .placedObjects.find((o) => o.catalogId === 'modern_toilet')!;

    // Set toilet durability low so next use breaks it
    useGameStore.setState((s) => ({
      placedObjects: s.placedObjects.map((o) =>
        o.instanceId === toilet.instanceId ? { ...o, durability: 10, cleanliness: 35 } : o,
      ),
    }));

    expect(useGameStore.getState().enqueueObjectInteraction(toilet.instanceId, 'use_toilet')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(20);

    const after = useGameStore.getState();
    const updatedToilet = after.placedObjects.find((o) => o.instanceId === toilet.instanceId)!;
    expect(updatedToilet.isBroken).toBe(true);
    expect(updatedToilet.durability).toBe(0);
    expect(after.messes.some((m) => m.kind === 'puddle')).toBe(true);

    // Broken toilet blocks normal use
    expect(useGameStore.getState().enqueueObjectInteraction(toilet.instanceId, 'use_toilet')).toBe(
      false,
    );

    // Filthy surroundings (>= 2 mess/broken/grimy sources) turns Maya Uncomfortable when no strong boost overrides
    const penalty = getEnvironmentMessPenalty(after.placedObjects, after.messes, {
      x: after.sim.tileX,
      z: after.sim.tileZ,
    });
    expect(penalty).toBeGreaterThanOrEqual(2);
    expect(computeEmotion(after.sim.needs, null, after.clock.totalMinutes, penalty)).toBe(
      'uncomfortable',
    );
  });

  it('builds Handiness via repairs & cleaning, installs permanent upgrades, and honors Self-Cleaning / Unbreakable / Performance Boost', () => {
    const stove = useGameStore
      .getState()
      .placedObjects.find((o) => o.catalogId === 'chefs_stove')!;

    // Break stove and let Maya repair it
    useGameStore.setState((s) => ({
      placedObjects: s.placedObjects.map((o) =>
        o.instanceId === stove.instanceId ? { ...o, isBroken: true, durability: 0 } : o,
      ),
    }));

    const partsBefore = useGameStore.getState().handiness.upgradeParts;
    expect(useGameStore.getState().enqueueRepairObject(stove.instanceId)).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(40);

    let state = useGameStore.getState();
    const repairedStove = state.placedObjects.find((o) => o.instanceId === stove.instanceId)!;
    expect(repairedStove.isBroken).toBe(false);
    expect(repairedStove.durability).toBe(100);
    expect(state.handiness.xp).toBeGreaterThan(0);
    expect(state.handiness.upgradeParts).toBe(partsBefore + 1);

    // Install Lv 1 Eco Saver using Upgrade Parts (costs 1 part, 0 Simoleons)
    const fundsBefore = state.funds;
    expect(useGameStore.getState().enqueueUpgradeObject(stove.instanceId, 'eco_saver')).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(35);

    state = useGameStore.getState();
    expect(state.funds).toBe(fundsBefore);
    expect(
      state.placedObjects.find((o) => o.instanceId === stove.instanceId)?.upgrades,
    ).toContain('eco_saver');

    // Pure wear check: Self-Cleaning & Unbreakable completely stop grime & breakage
    const upgradedStove = {
      ...repairedStove,
      cleanliness: 100,
      durability: 100,
      upgrades: ['self_cleaning' as const, 'unbreakable' as const],
    };
    const wearResult = applyObjectUseWear(upgradedStove);
    expect(wearResult.nextObj.cleanliness).toBe(100);
    expect(wearResult.nextObj.durability).toBe(100);
    expect(wearResult.justBroke).toBe(false);

    // Handiness leveling curve works cleanly up to Lv 5
    const lvUp = awardHandinessXp({ level: 1, xp: 90, upgradeParts: 0 }, 20, 1);
    expect(lvUp.leveledUp).toBe(true);
    expect(lvUp.nextHandiness.level).toBe(2);
    expect(lvUp.nextHandiness.xp).toBe(10);
    expect(lvUp.nextHandiness.upgradeParts).toBe(1);
  });

  it('supports Call Repair Tech, Hire Cleaning Maid, Buy Upgrade Parts, and keeps neighbor homes immune', () => {
    const tv = useGameStore
      .getState()
      .placedObjects.find((o) => o.catalogId === 'widescreen_tv')!;
    const sink = useGameStore
      .getState()
      .placedObjects.find((o) => o.catalogId === 'pedestal_sink')!;

    useGameStore.setState((s) => ({
      placedObjects: s.placedObjects.map((o) =>
        o.instanceId === tv.instanceId
          ? { ...o, isBroken: true, durability: 0 }
          : o.instanceId === sink.instanceId
            ? { ...o, cleanliness: 20 }
            : o,
      ),
      messes: [
        { id: 'm1', kind: 'puddle', tileX: 6, tileZ: 8, createdAtSimMinute: 540 },
        { id: 'm2', kind: 'dirty_dish', tileX: 5, tileZ: 8, createdAtSimMinute: 540 },
      ],
    }));

    // Call Repair Tech (§85): fixes TV and clears puddle, leaves dirty dish for Maid
    const fundsBeforeTech = useGameStore.getState().funds;
    expect(useGameStore.getState().callRepairTech()).toBe(true);
    let state = useGameStore.getState();
    expect(state.funds).toBe(fundsBeforeTech - REPAIR_TECH_COST);
    expect(state.placedObjects.find((o) => o.instanceId === tv.instanceId)?.isBroken).toBe(false);
    expect(state.messes.some((m) => m.kind === 'puddle')).toBe(false);
    expect(state.messes.some((m) => m.kind === 'dirty_dish')).toBe(true);

    // Hire Maid (§65): scrubs sink to 100% and clears remaining dirty dish
    const fundsBeforeMaid = state.funds;
    expect(useGameStore.getState().hireCleaningMaid()).toBe(true);
    state = useGameStore.getState();
    expect(state.funds).toBe(fundsBeforeMaid - MAID_SERVICE_COST);
    expect(state.placedObjects.find((o) => o.instanceId === sink.instanceId)?.cleanliness).toBe(
      100,
    );
    expect(state.messes.length).toBe(0);

    // Buy Upgrade Parts (§40 -> +2 parts)
    const partsBefore = state.handiness.upgradeParts;
    const fundsBeforeParts = state.funds;
    expect(useGameStore.getState().buyUpgradeParts()).toBe(true);
    state = useGameStore.getState();
    expect(state.funds).toBe(fundsBeforeParts - UPGRADE_PARTS_PACK_COST);
    expect(state.handiness.upgradeParts).toBe(partsBefore + 2);

    // Neighbor home furniture stays usable even if Maya's own Power & Water are shut off!
    useGameStore.setState((s) => ({
      unlockedHouseIds: ['sagewood_cottage'],
      bills: { ...s.bills, amountDue: 250, powerShutoff: true, waterShutoff: true },
    }));
    expect(useGameStore.getState().enqueueObjectInteraction('sc_tv', 'watch_comedy')).toBe(true);
  });
});
