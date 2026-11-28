import { CATALOG_BY_ID } from '../data/catalog';
import {
  MAINTENANCE_SPECS,
  MAX_HANDINESS_LEVEL,
  UPGRADE_DEFS,
} from '../data/householdData';
import type {
  BillBreakdown,
  HandinessState,
  HouseholdBillsState,
  HouseholdMess,
  NeedKey,
  PlacedObject,
  TileCoord,
  UpgradeDef,
  WallSegment,
} from '../types/game';
import {
  buildBlockedTileSet,
  buildWallLookup,
  getOccupiedTiles,
  isInLotBounds,
  isWallBetween,
} from './grid';

const LOT_BASE_TAX = 110;
const FURNISHINGS_BILL_RATE = 0.045;
const ECO_DISCOUNT_PER_ITEM = 0.15;
const ECO_DISCOUNT_MAX = 0.45;

export function calculateWeeklyBill(placedObjects: PlacedObject[]): BillBreakdown {
  let furnitureTotal = 0;
  let ecoUpgradeCount = 0;

  for (const obj of placedObjects) {
    if (obj.houseId) continue;
    const item = CATALOG_BY_ID[obj.catalogId];
    if (item) {
      furnitureTotal += item.price;
    }
    if (obj.upgrades?.includes('eco_saver')) {
      ecoUpgradeCount += 1;
    }
  }

  const furnishings = Math.round(furnitureTotal * FURNISHINGS_BILL_RATE);
  const gross = LOT_BASE_TAX + furnishings;
  const discountRate = Math.min(ECO_DISCOUNT_MAX, ecoUpgradeCount * ECO_DISCOUNT_PER_ITEM);
  const ecoDiscount = Math.round(gross * discountRate);
  const total = Math.max(45, gross - ecoDiscount);

  return {
    lotBase: LOT_BASE_TAX,
    furnishings,
    ecoDiscount,
    ecoUpgradeCount,
    total,
  };
}

export function getHandinessXpForNextLevel(level: number): number {
  if (level >= MAX_HANDINESS_LEVEL) return 0;
  return 60 + level * 40; // Lv1->2: 100, Lv2->3: 140, Lv3->4: 180, Lv4->5: 220
}

export function awardHandinessXp(
  handiness: HandinessState,
  xpGain: number,
  bonusParts = 0,
): { nextHandiness: HandinessState; leveledUp: boolean } {
  let level = handiness.level;
  let xp = handiness.xp + xpGain;
  let leveledUp = false;

  while (level < MAX_HANDINESS_LEVEL) {
    const needed = getHandinessXpForNextLevel(level);
    if (xp >= needed) {
      xp -= needed;
      level += 1;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (level >= MAX_HANDINESS_LEVEL) {
    xp = 0;
  }

  return {
    nextHandiness: {
      level,
      xp,
      upgradeParts: handiness.upgradeParts + bonusParts,
    },
    leveledUp,
  };
}

export function getMaintenanceSpecForObject(obj: PlacedObject) {
  const item = CATALOG_BY_ID[obj.catalogId];
  if (!item) return null;
  return MAINTENANCE_SPECS[item.proceduralType] ?? null;
}

export function isObjectBlockedByUtility(
  obj: PlacedObject,
  bills: HouseholdBillsState,
): { blocked: boolean; reason?: string } {
  if (obj.houseId) return { blocked: false };
  const spec = getMaintenanceSpecForObject(obj);
  if (!spec) return { blocked: false };
  if (spec.requiresPower && bills.powerShutoff) {
    return { blocked: true, reason: 'Power shut off — Pay Bills' };
  }
  if (spec.requiresWater && bills.waterShutoff) {
    return { blocked: true, reason: 'Water shut off — Pay Bills' };
  }
  return { blocked: false };
}

export function applyObjectUseWear(obj: PlacedObject): {
  nextObj: PlacedObject;
  justBroke: boolean;
  breakEffect: 'sparks' | 'leak' | null;
} {
  if (obj.houseId) {
    return { nextObj: obj, justBroke: false, breakEffect: null };
  }
  const spec = getMaintenanceSpecForObject(obj);
  if (!spec) {
    return { nextObj: obj, justBroke: false, breakEffect: null };
  }

  const upgrades = obj.upgrades ?? [];
  const hasSelfClean = upgrades.includes('self_cleaning');
  const hasUnbreakable = upgrades.includes('unbreakable');

  const curClean = obj.cleanliness ?? 100;
  const curDurability = obj.durability ?? 100;

  const nextClean = hasSelfClean
    ? 100
    : Math.max(0, curClean - spec.cleanlinessDecayPerUse);
  const nextDurability = hasUnbreakable
    ? 100
    : Math.max(0, curDurability - spec.durabilityDecayPerUse);

  const justBroke =
    !obj.isBroken && !hasUnbreakable && spec.durabilityDecayPerUse > 0 && nextDurability <= 0;

  return {
    nextObj: {
      ...obj,
      cleanliness: nextClean,
      durability: nextDurability,
      isBroken: obj.isBroken || justBroke,
    },
    justBroke,
    breakEffect: justBroke ? spec.breakEffect : null,
  };
}

export function getAvailableUpgradesForObject(
  obj: PlacedObject,
  handiness: HandinessState,
  funds: number,
): Array<{
  upgrade: UpgradeDef;
  canAffordWithParts: boolean;
  canAffordWithFunds: boolean;
  lockedBySkill: boolean;
  reason?: string;
}> {
  if (obj.houseId) return [];
  const item = CATALOG_BY_ID[obj.catalogId];
  if (!item) return [];
  const installed = new Set(obj.upgrades ?? []);

  return UPGRADE_DEFS.filter(
    (u) => u.applicableTypes.includes(item.proceduralType) && !installed.has(u.id),
  ).map((upgrade) => {
    const lockedBySkill = handiness.level < upgrade.requiredHandiness;
    const canAffordWithParts = handiness.upgradeParts >= upgrade.partsCost;
    const canAffordWithFunds = funds >= upgrade.simoleonCost;
    let reason: string | undefined;
    if (lockedBySkill) {
      reason = `Needs Handiness Lv ${upgrade.requiredHandiness}`;
    } else if (!canAffordWithParts && !canAffordWithFunds) {
      reason = `Needs ${upgrade.partsCost} Parts or §${upgrade.simoleonCost}`;
    }
    return {
      upgrade,
      canAffordWithParts,
      canAffordWithFunds,
      lockedBySkill,
      reason,
    };
  });
}

export function applyPerformanceUpgradeBonus(
  durationSimMinutes: number,
  needDeltas: Partial<Record<NeedKey, number>>,
  obj: PlacedObject,
  handinessLevel: number,
): { durationSimMinutes: number; needDeltas: Partial<Record<NeedKey, number>> } {
  const upgrades = obj.upgrades ?? [];
  const hasBoost = upgrades.includes('performance_boost');
  const hasMasterwork = upgrades.length > 0 && handinessLevel >= MAX_HANDINESS_LEVEL;

  if (!hasBoost && !hasMasterwork) {
    return { durationSimMinutes, needDeltas };
  }

  const speedMult = hasBoost ? 0.75 : 0.9;
  const gainMult = hasBoost ? 1.2 : 1.08;

  const boostedDeltas: Partial<Record<NeedKey, number>> = {};
  for (const [k, val] of Object.entries(needDeltas)) {
    if (val === undefined) continue;
    boostedDeltas[k as NeedKey] = val > 0 ? Math.round(val * gainMult) : val;
  }

  return {
    durationSimMinutes: Math.max(4, Math.round(durationSimMinutes * speedMult)),
    needDeltas: boostedDeltas,
  };
}

/**
 * Counts active filth/breakage sources on Maya's home lot when she is at home.
 * >= 2 sources causes a Sims 4 "Filthy Surroundings" Uncomfortable environment penalty.
 */
export function getEnvironmentMessPenalty(
  placedObjects: PlacedObject[],
  messes: HouseholdMess[],
  simTile: TileCoord,
): number {
  // Only affects Maya while on her own 0..15 home lot
  if (!isInLotBounds(simTile.x, simTile.z)) return 0;

  let penalty = messes.length;
  for (const obj of placedObjects) {
    if (obj.houseId) continue;
    if (obj.isBroken) penalty += 1;
    if ((obj.cleanliness ?? 100) < 40) penalty += 1;
  }
  return penalty;
}

/**
 * Finds an unobstructed walkable floor tile inside Maya's home lot adjacent to an object or tile
 * for spawning a leak puddle or dirty dish.
 */
export function findNearbyMessSpawnTile(
  originObj: PlacedObject | null,
  fallbackTile: TileCoord,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  existingMesses: HouseholdMess[],
): TileCoord | null {
  const blocked = buildBlockedTileSet(placedObjects);
  const wallLookup = buildWallLookup(walls);
  const messKeys = new Set(existingMesses.map((m) => `${m.tileX},${m.tileZ}`));

  const anchors: TileCoord[] = [];
  if (originObj) {
    const item = CATALOG_BY_ID[originObj.catalogId];
    if (item) {
      anchors.push(...getOccupiedTiles(originObj.tileX, originObj.tileZ, item.footprint, originObj.rotation));
    }
  }
  if (anchors.length === 0) {
    anchors.push(fallbackTile);
  }

  const dirs = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
  ];

  for (const anchor of anchors) {
    for (const [dx, dz] of dirs) {
      const tx = anchor.x + dx;
      const tz = anchor.z + dz;
      if (!isInLotBounds(tx, tz)) continue;
      // Keep messes inside the interior/patio area (not out on the grass curb)
      if (tx < 2 || tx > 13 || tz < 2 || tz > 10) continue;
      if (isWallBetween(anchor.x, anchor.z, tx, tz, wallLookup)) continue;
      const key = `${tx},${tz}`;
      if (blocked.has(key) || messKeys.has(key)) continue;
      return { x: tx, z: tz };
    }
  }

  // Fallback: check fallbackTile itself if walkable and inside home
  if (
    isInLotBounds(fallbackTile.x, fallbackTile.z) &&
    fallbackTile.x >= 2 &&
    fallbackTile.x <= 13 &&
    fallbackTile.z >= 2 &&
    fallbackTile.z <= 10
  ) {
    const key = `${fallbackTile.x},${fallbackTile.z}`;
    if (!blocked.has(key) && !messKeys.has(key)) {
      return { x: fallbackTile.x, z: fallbackTile.z };
    }
  }

  return null;
}

export function getDaysUntilNextMondayBill(day: number, hour: number, lastBilledDay: number): number {
  const dow = (day - 1) % 7; // 0 = Mon
  if (dow === 0 && day > lastBilledDay && hour < 8) {
    return 0;
  }
  return dow === 0 ? 7 : 7 - dow;
}
