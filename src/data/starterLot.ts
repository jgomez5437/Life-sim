import type { GameClock, PlacedObject, RoomDef, SimState, WallSegment } from '../types/game';

export const LOT_SIZE = 16;

export const STARTER_ROOMS: RoomDef[] = [
  {
    id: 'kitchen',
    name: 'Kitchen & Dining',
    x1: 3,
    z1: 3,
    x2: 8,
    z2: 6,
    floorType: 'tile_kitchen',
  },
  {
    id: 'living',
    name: 'Living Lounge',
    x1: 3,
    z1: 7,
    x2: 8,
    z2: 10,
    floorType: 'wood_warm',
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    x1: 9,
    z1: 3,
    x2: 12,
    z2: 7,
    floorType: 'wood_light',
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    x1: 9,
    z1: 8,
    x2: 12,
    z2: 10,
    floorType: 'tile_bath',
  },
  {
    id: 'patio',
    name: 'Front Patio',
    x1: 5,
    z1: 11,
    x2: 7,
    z2: 12,
    floorType: 'stone_patio',
  },
  {
    id: 'walkway',
    name: 'Garden Path',
    x1: 6,
    z1: 13,
    x2: 6,
    z2: 15,
    floorType: 'stone_patio',
  },
];

function buildStarterWalls(): WallSegment[] {
  const walls: WallSegment[] = [];

  // North exterior wall (z = 3, x = 3..12)
  for (let x = 3; x <= 12; x++) {
    const isWindow = x === 5 || x === 7 || x === 10 || x === 11;
    walls.push({
      id: `w_n_${x}`,
      orientation: 'horizontal',
      x,
      z: 3,
      kind: isWindow ? 'window' : 'solid',
      side: 'north',
    });
  }

  // South exterior wall (z = 11, x = 3..12)
  for (let x = 3; x <= 12; x++) {
    const kind = x === 6 ? 'door' : x === 4 || x === 8 || x === 10 ? 'window' : 'solid';
    walls.push({
      id: `w_s_${x}`,
      orientation: 'horizontal',
      x,
      z: 11,
      kind,
      side: 'south',
    });
  }

  // West exterior wall (x = 3, z = 3..10)
  for (let z = 3; z <= 10; z++) {
    const isWindow = z === 5 || z === 8;
    walls.push({
      id: `w_w_${z}`,
      orientation: 'vertical',
      x: 3,
      z,
      kind: isWindow ? 'window' : 'solid',
      side: 'west',
    });
  }

  // East exterior wall (x = 13, z = 3..10)
  for (let z = 3; z <= 10; z++) {
    const isWindow = z === 5 || z === 9;
    walls.push({
      id: `w_e_${z}`,
      orientation: 'vertical',
      x: 13,
      z,
      kind: isWindow ? 'window' : 'solid',
      side: 'east',
    });
  }

  // Interior vertical divider between Kitchen/Living (x <= 8) and Bed/Bath (x >= 9)
  for (let z = 3; z <= 10; z++) {
    const kind = z === 6 || z === 9 ? 'door' : 'solid';
    walls.push({
      id: `w_int_v_${z}`,
      orientation: 'vertical',
      x: 9,
      z,
      kind,
      side: 'interior',
    });
  }

  // Interior horizontal divider between Bedroom (z <= 7) and Bathroom (z >= 8)
  for (let x = 9; x <= 12; x++) {
    walls.push({
      id: `w_int_h_${x}`,
      orientation: 'horizontal',
      x,
      z: 8,
      kind: 'solid',
      side: 'interior',
    });
  }

  return walls;
}

export const STARTER_WALLS: WallSegment[] = buildStarterWalls();

export const STARTER_OBJECTS: PlacedObject[] = [
  // Kitchen & Dining
  { instanceId: 'obj_fridge_1', catalogId: 'retro_fridge', tileX: 3, tileZ: 3, rotation: 0 },
  { instanceId: 'obj_coffee_1', catalogId: 'coffee_station', tileX: 4, tileZ: 3, rotation: 0 },
  { instanceId: 'obj_stove_1', catalogId: 'chefs_stove', tileX: 5, tileZ: 3, rotation: 0 },
  { instanceId: 'obj_dining_1', catalogId: 'dining_table', tileX: 6, tileZ: 4, rotation: 0 },
  { instanceId: 'obj_plant_1', catalogId: 'monstera_plant', tileX: 8, tileZ: 3, rotation: 0 },

  // Living Lounge
  { instanceId: 'obj_rug_1', catalogId: 'woven_rug', tileX: 4, tileZ: 8, rotation: 0 },
  { instanceId: 'obj_lamp_living', catalogId: 'floor_lamp', tileX: 3, tileZ: 7, rotation: 0 },
  { instanceId: 'obj_sofa_1', catalogId: 'plush_sofa', tileX: 4, tileZ: 7, rotation: 0 },
  { instanceId: 'obj_tv_1', catalogId: 'widescreen_tv', tileX: 4, tileZ: 10, rotation: 180 },
  { instanceId: 'obj_bookshelf_1', catalogId: 'oak_bookshelf', tileX: 3, tileZ: 9, rotation: 90 },

  // Bedroom
  { instanceId: 'obj_bed_1', catalogId: 'cozy_double_bed', tileX: 11, tileZ: 3, rotation: 0 },
  { instanceId: 'obj_lamp_bed', catalogId: 'floor_lamp', tileX: 10, tileZ: 3, rotation: 0 },
  { instanceId: 'obj_mirror_1', catalogId: 'arch_mirror', tileX: 9, tileZ: 4, rotation: 90 },
  { instanceId: 'obj_dresser_1', catalogId: 'oak_dresser', tileX: 10, tileZ: 7, rotation: 180 },
  { instanceId: 'obj_bookshelf_2', catalogId: 'oak_bookshelf', tileX: 12, tileZ: 6, rotation: 270 },

  // Bathroom
  { instanceId: 'obj_sink_1', catalogId: 'pedestal_sink', tileX: 10, tileZ: 8, rotation: 0 },
  { instanceId: 'obj_shower_1', catalogId: 'rain_shower', tileX: 12, tileZ: 8, rotation: 270 },
  { instanceId: 'obj_toilet_1', catalogId: 'modern_toilet', tileX: 12, tileZ: 10, rotation: 270 },

  // Patio Plant
  { instanceId: 'obj_plant_patio', catalogId: 'monstera_plant', tileX: 7, tileZ: 11, rotation: 0 },
];

export const INITIAL_FUNDS = 2500;

export function createInitialClock(): GameClock {
  return {
    day: 1,
    hour: 9,
    minute: 0,
    totalMinutes: 9 * 60,
  };
}

export function createInitialSim(): SimState {
  return {
    id: 'sim_maya',
    name: 'Maya Lin',
    traits: ['Creative', 'Foodie', 'Warmhearted'],
    appearance: {
      hairStyle: 'bun',
      skinColor: '#f0c4a6',
      hairColor: '#2d2220',
      eyeColor: '#4c382a',
      topColor: '#2a9b7f',
      bottomColor: '#364d68',
      shoeColor: '#f6f2ea',
    },
    tileX: 6,
    tileZ: 7,
    facingAngle: 0,
    needs: {
      hunger: 74,
      energy: 86,
      bladder: 78,
      hygiene: 84,
      fun: 72,
      social: 68,
    },
    emotion: 'happy',
    emotionBoost: null,
    pose: 'idle',
    activeObjectId: null,
    activeProp: null,
    awayAtWork: false,
  };
}
