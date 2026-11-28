import type {
  CatalogItem,
  HandinessState,
  HouseholdBillsState,
  TileCoord,
  UpgradeDef,
  UpgradeId,
} from '../types/game';

export const MAILBOX_STAND_TILE: TileCoord = { x: 7, z: 15 };
export const MAX_HOUSEHOLD_MESSES = 5;
export const REPAIR_TECH_COST = 85;
export const MAID_SERVICE_COST = 65;
export const UPGRADE_PARTS_PACK_COST = 40;
export const UPGRADE_PARTS_PACK_QTY = 2;
export const MAX_HANDINESS_LEVEL = 5;

export interface ObjectMaintenanceSpec {
  requiresPower: boolean;
  requiresWater: boolean;
  cleanlinessDecayPerUse: number;
  durabilityDecayPerUse: number;
  breakEffect: 'sparks' | 'leak' | null;
}

export const MAINTENANCE_SPECS: Partial<Record<CatalogItem['proceduralType'], ObjectMaintenanceSpec>> = {
  fridge: {
    requiresPower: true,
    requiresWater: false,
    cleanlinessDecayPerUse: 8,
    durabilityDecayPerUse: 10,
    breakEffect: 'sparks',
  },
  stove: {
    requiresPower: true,
    requiresWater: false,
    cleanlinessDecayPerUse: 15,
    durabilityDecayPerUse: 12,
    breakEffect: 'sparks',
  },
  coffee_station: {
    requiresPower: true,
    requiresWater: false,
    cleanlinessDecayPerUse: 12,
    durabilityDecayPerUse: 15,
    breakEffect: 'sparks',
  },
  tv_stand: {
    requiresPower: true,
    requiresWater: false,
    cleanlinessDecayPerUse: 0,
    durabilityDecayPerUse: 12,
    breakEffect: 'sparks',
  },
  floor_lamp: {
    requiresPower: true,
    requiresWater: false,
    cleanlinessDecayPerUse: 0,
    durabilityDecayPerUse: 0,
    breakEffect: null,
  },
  toilet: {
    requiresPower: false,
    requiresWater: true,
    cleanlinessDecayPerUse: 16,
    durabilityDecayPerUse: 16,
    breakEffect: 'leak',
  },
  shower: {
    requiresPower: false,
    requiresWater: true,
    cleanlinessDecayPerUse: 14,
    durabilityDecayPerUse: 14,
    breakEffect: 'leak',
  },
  sink: {
    requiresPower: false,
    requiresWater: true,
    cleanlinessDecayPerUse: 10,
    durabilityDecayPerUse: 14,
    breakEffect: 'leak',
  },
};

export const DISH_SPAWNING_INTERACTION_IDS = new Set([
  'quick_snack',
  'garden_salad',
  'cook_pasta',
  'bake_pancakes',
  'brew_latte',
]);

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'eco_saver',
    label: 'Eco Saver Module',
    shortLabel: 'Eco Saver',
    description: 'Cuts weekly household utility bills by 15% per upgraded item (up to 45% total).',
    icon: 'leaf',
    requiredHandiness: 1,
    partsCost: 1,
    simoleonCost: 45,
    durationSimMinutes: 22,
    applicableTypes: [
      'fridge',
      'stove',
      'coffee_station',
      'tv_stand',
      'toilet',
      'shower',
      'sink',
      'floor_lamp',
    ],
  },
  {
    id: 'self_cleaning',
    label: 'Self-Cleaning Coat',
    shortLabel: 'Self-Cleaning',
    description: 'Prevents grime & odor buildup permanently — stays sparkling clean!',
    icon: 'sparkles',
    requiredHandiness: 2,
    partsCost: 2,
    simoleonCost: 80,
    durationSimMinutes: 26,
    applicableTypes: ['fridge', 'stove', 'coffee_station', 'toilet', 'shower', 'sink'],
  },
  {
    id: 'performance_boost',
    label: 'Precision Calibration',
    shortLabel: 'Turbo Boost',
    description: '25% faster interactions and +20% stronger Need restoration every use.',
    icon: 'zap',
    requiredHandiness: 3,
    partsCost: 2,
    simoleonCost: 95,
    durationSimMinutes: 30,
    applicableTypes: ['fridge', 'stove', 'coffee_station', 'tv_stand', 'toilet', 'shower', 'sink'],
  },
  {
    id: 'unbreakable',
    label: 'Unbreakable Build',
    shortLabel: 'Unbreakable',
    description: 'Reinforces internal parts so this fixture never breaks down again.',
    icon: 'shield',
    requiredHandiness: 4,
    partsCost: 3,
    simoleonCost: 130,
    durationSimMinutes: 34,
    applicableTypes: ['fridge', 'stove', 'coffee_station', 'tv_stand', 'toilet', 'shower', 'sink'],
  },
];

export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADE_DEFS.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

export function createInitialHandiness(): HandinessState {
  return {
    level: 1,
    xp: 0,
    upgradeParts: 1,
  };
}

export function createInitialBillsState(): HouseholdBillsState {
  return {
    amountDue: 0,
    issuedOnDay: null,
    dueTotalMinutes: null,
    waterShutoffTotalMinutes: null,
    powerShutoff: false,
    waterShutoff: false,
    lastBilledDay: 1,
    lastBillBreakdown: null,
    totalBillsPaid: 0,
  };
}
