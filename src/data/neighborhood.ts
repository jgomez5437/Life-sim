import type {
  NeighborHouseDef,
  NeighborHouseId,
  PlacedObject,
  RoomDef,
  TileCoord,
  TileRect,
  WallSegment,
} from '../types/game';

export const WORLD_MIN_X = -16;
export const WORLD_MAX_X = 31;
export const WORLD_MIN_Z = 0;
export const WORLD_MAX_Z = 33;

export const MAYA_FRONT_DOOR_OUTSIDE: TileCoord = { x: 6, z: 11 };
export const MAYA_WELCOME_TILE: TileCoord = { x: 6, z: 9 };

export const POCKET_PARK_RECT: TileRect = { x1: -13, z1: 21, x2: -3, z2: 30 };

export const SIDEWALK_STROLL_TILES: TileCoord[] = [
  { x: -11, z: 16 },
  { x: -6, z: 16 },
  { x: 1, z: 16 },
  { x: 6, z: 16 },
  { x: 12, z: 16 },
  { x: 19, z: 16 },
  { x: 24, z: 16 },
  { x: -8, z: 19 },
  { x: 3, z: 19 },
  { x: 7, z: 19 },
  { x: 16, z: 19 },
  { x: -8, z: 24 },
  { x: -6, z: 26 },
  { x: -10, z: 26 },
];

function buildHouseWalls(params: {
  prefix: string;
  houseId: NeighborHouseId;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  doorSide: 'south' | 'north';
  doorX: number;
  northWindows: number[];
  southWindows: number[];
  westWindows: number[];
  eastWindows: number[];
  dividerX: number;
  dividerDoorZs: number[];
  bathDividerZ: number;
}): WallSegment[] {
  const {
    prefix,
    houseId,
    x1,
    z1,
    x2,
    z2,
    doorSide,
    doorX,
    northWindows,
    southWindows,
    westWindows,
    eastWindows,
    dividerX,
    dividerDoorZs,
    bathDividerZ,
  } = params;
  const walls: WallSegment[] = [];

  // North exterior wall (z = z1)
  for (let x = x1; x <= x2; x++) {
    const kind =
      doorSide === 'north' && x === doorX
        ? 'door'
        : northWindows.includes(x)
          ? 'window'
          : 'solid';
    walls.push({
      id: `${prefix}_n_${x}`,
      orientation: 'horizontal',
      x,
      z: z1,
      kind,
      side: 'north',
      houseId,
    });
  }

  // South exterior wall (z = z2 + 1)
  for (let x = x1; x <= x2; x++) {
    const kind =
      doorSide === 'south' && x === doorX
        ? 'door'
        : southWindows.includes(x)
          ? 'window'
          : 'solid';
    walls.push({
      id: `${prefix}_s_${x}`,
      orientation: 'horizontal',
      x,
      z: z2 + 1,
      kind,
      side: 'south',
      houseId,
    });
  }

  // West exterior wall (x = x1)
  for (let z = z1; z <= z2; z++) {
    walls.push({
      id: `${prefix}_w_${z}`,
      orientation: 'vertical',
      x: x1,
      z,
      kind: westWindows.includes(z) ? 'window' : 'solid',
      side: 'west',
      houseId,
    });
  }

  // East exterior wall (x = x2 + 1)
  for (let z = z1; z <= z2; z++) {
    walls.push({
      id: `${prefix}_e_${z}`,
      orientation: 'vertical',
      x: x2 + 1,
      z,
      kind: eastWindows.includes(z) ? 'window' : 'solid',
      side: 'east',
      houseId,
    });
  }

  // Interior vertical divider between Main Lounge and Bed/Bath
  for (let z = z1; z <= z2; z++) {
    walls.push({
      id: `${prefix}_iv_${z}`,
      orientation: 'vertical',
      x: dividerX,
      z,
      kind: dividerDoorZs.includes(z) ? 'door' : 'solid',
      side: 'interior',
      houseId,
    });
  }

  // Interior horizontal divider between Bedroom and Bath
  for (let x = dividerX; x <= x2; x++) {
    walls.push({
      id: `${prefix}_ih_${x}`,
      orientation: 'horizontal',
      x,
      z: bathDividerZ,
      kind: 'solid',
      side: 'interior',
      houseId,
    });
  }

  return walls;
}

const SAGEWOOD_ROOMS: RoomDef[] = [
  { id: 'sc_kitchen', name: 'Kitchen', x1: -13, z1: 3, x2: -8, z2: 6, floorType: 'tile_kitchen' },
  { id: 'sc_living', name: 'Living Lounge', x1: -13, z1: 7, x2: -8, z2: 10, floorType: 'wood_warm' },
  { id: 'sc_bedroom', name: 'Bedroom', x1: -7, z1: 3, x2: -5, z2: 7, floorType: 'wood_light' },
  { id: 'sc_bath', name: 'Bath', x1: -7, z1: 8, x2: -5, z2: 10, floorType: 'tile_bath' },
  { id: 'sc_patio', name: 'Porch', x1: -10, z1: 11, x2: -8, z2: 12, floorType: 'stone_patio' },
  { id: 'sc_path', name: 'Front Path', x1: -9, z1: 13, x2: -9, z2: 15, floorType: 'stone_patio' },
];

const SAGEWOOD_OBJECTS: PlacedObject[] = [
  { instanceId: 'sc_fridge', catalogId: 'retro_fridge', tileX: -13, tileZ: 3, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_coffee', catalogId: 'coffee_station', tileX: -12, tileZ: 3, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_stove', catalogId: 'chefs_stove', tileX: -11, tileZ: 3, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_dining', catalogId: 'dining_table', tileX: -9, tileZ: 4, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_plant', catalogId: 'monstera_plant', tileX: -13, tileZ: 6, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_rug', catalogId: 'woven_rug', tileX: -12, tileZ: 8, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_sofa', catalogId: 'plush_sofa', tileX: -12, tileZ: 7, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_tv', catalogId: 'widescreen_tv', tileX: -12, tileZ: 10, rotation: 180, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_lamp', catalogId: 'floor_lamp', tileX: -13, tileZ: 7, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_bookshelf', catalogId: 'oak_bookshelf', tileX: -13, tileZ: 9, rotation: 90, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_bed', catalogId: 'cozy_double_bed', tileX: -6, tileZ: 3, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_bed_lamp', catalogId: 'floor_lamp', tileX: -7, tileZ: 3, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_dresser', catalogId: 'oak_dresser', tileX: -5, tileZ: 7, rotation: 180, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_sink', catalogId: 'pedestal_sink', tileX: -7, tileZ: 8, rotation: 0, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_shower', catalogId: 'rain_shower', tileX: -5, tileZ: 8, rotation: 270, houseId: 'sagewood_cottage' },
  { instanceId: 'sc_toilet', catalogId: 'modern_toilet', tileX: -5, tileZ: 10, rotation: 270, houseId: 'sagewood_cottage' },
];

const BREEZEVIEW_ROOMS: RoomDef[] = [
  { id: 'bl_lounge', name: 'Coffee & Tech Lounge', x1: 20, z1: 3, x2: 25, z2: 10, floorType: 'wood_light' },
  { id: 'bl_bedroom', name: 'Bedroom', x1: 26, z1: 3, x2: 28, z2: 7, floorType: 'wood_warm' },
  { id: 'bl_bath', name: 'Bath', x1: 26, z1: 8, x2: 28, z2: 10, floorType: 'tile_bath' },
  { id: 'bl_patio', name: 'Porch', x1: 23, z1: 11, x2: 25, z2: 12, floorType: 'stone_patio' },
  { id: 'bl_path', name: 'Front Path', x1: 24, z1: 13, x2: 24, z2: 15, floorType: 'stone_patio' },
];

const BREEZEVIEW_OBJECTS: PlacedObject[] = [
  { instanceId: 'bl_coffee', catalogId: 'coffee_station', tileX: 20, tileZ: 3, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_fridge', catalogId: 'retro_fridge', tileX: 21, tileZ: 3, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_dining', catalogId: 'dining_table', tileX: 23, tileZ: 4, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_plant', catalogId: 'monstera_plant', tileX: 25, tileZ: 3, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_rug', catalogId: 'woven_rug', tileX: 21, tileZ: 8, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_sofa', catalogId: 'plush_sofa', tileX: 21, tileZ: 7, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_tv', catalogId: 'widescreen_tv', tileX: 21, tileZ: 10, rotation: 180, houseId: 'breezeview_loft' },
  { instanceId: 'bl_bookshelf', catalogId: 'oak_bookshelf', tileX: 20, tileZ: 8, rotation: 90, houseId: 'breezeview_loft' },
  { instanceId: 'bl_lamp', catalogId: 'floor_lamp', tileX: 20, tileZ: 10, rotation: 180, houseId: 'breezeview_loft' },
  { instanceId: 'bl_bed', catalogId: 'cozy_double_bed', tileX: 27, tileZ: 3, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_dresser', catalogId: 'oak_dresser', tileX: 28, tileZ: 7, rotation: 180, houseId: 'breezeview_loft' },
  { instanceId: 'bl_sink', catalogId: 'pedestal_sink', tileX: 26, tileZ: 8, rotation: 0, houseId: 'breezeview_loft' },
  { instanceId: 'bl_shower', catalogId: 'rain_shower', tileX: 28, tileZ: 8, rotation: 270, houseId: 'breezeview_loft' },
  { instanceId: 'bl_toilet', catalogId: 'modern_toilet', tileX: 28, tileZ: 10, rotation: 270, houseId: 'breezeview_loft' },
];

const ATELIER_ROOMS: RoomDef[] = [
  { id: 'as_gallery', name: 'Gallery Lounge', x1: 3, z1: 23, x2: 8, z2: 30, floorType: 'wood_warm' },
  { id: 'as_bedroom', name: 'Studio Bedroom', x1: 9, z1: 23, x2: 11, z2: 27, floorType: 'wood_light' },
  { id: 'as_bath', name: 'Bath', x1: 9, z1: 28, x2: 11, z2: 30, floorType: 'tile_bath' },
  { id: 'as_patio', name: 'North Porch', x1: 6, z1: 21, x2: 8, z2: 22, floorType: 'stone_patio' },
  { id: 'as_path', name: 'Walkway', x1: 7, z1: 20, x2: 7, z2: 20, floorType: 'stone_patio' },
];

const ATELIER_OBJECTS: PlacedObject[] = [
  { instanceId: 'as_fridge', catalogId: 'retro_fridge', tileX: 3, tileZ: 23, rotation: 90, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_dining', catalogId: 'dining_table', tileX: 4, tileZ: 24, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_coffee', catalogId: 'coffee_station', tileX: 3, tileZ: 25, rotation: 90, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_bookshelf', catalogId: 'oak_bookshelf', tileX: 3, tileZ: 27, rotation: 90, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_mirror', catalogId: 'arch_mirror', tileX: 3, tileZ: 29, rotation: 90, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_rug', catalogId: 'woven_rug', tileX: 5, tileZ: 26, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_sofa', catalogId: 'plush_sofa', tileX: 5, tileZ: 28, rotation: 180, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_plant', catalogId: 'monstera_plant', tileX: 8, tileZ: 23, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_lamp', catalogId: 'floor_lamp', tileX: 7, tileZ: 30, rotation: 180, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_bed', catalogId: 'cozy_double_bed', tileX: 10, tileZ: 23, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_bed_lamp', catalogId: 'floor_lamp', tileX: 9, tileZ: 23, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_sink', catalogId: 'pedestal_sink', tileX: 9, tileZ: 28, rotation: 0, houseId: 'atelier_sunbeam' },
  { instanceId: 'as_toilet', catalogId: 'modern_toilet', tileX: 11, tileZ: 30, rotation: 270, houseId: 'atelier_sunbeam' },
];

export const NEIGHBOR_HOUSES: NeighborHouseDef[] = [
  {
    id: 'sagewood_cottage',
    name: 'Sagewood Cottage',
    subtitle: 'Leo Rivera & Nora Chen',
    directionLabel: 'West Neighbor',
    roofColor: '#c66f53',
    exteriorColor: '#f7efe3',
    doorColor: '#568c74',
    residentIds: ['npc_leo', 'npc_nora'],
    lotRect: { x1: -16, z1: 0, x2: -2, z2: 15 },
    houseRect: { x1: -13, z1: 3, x2: -5, z2: 10 },
    frontDoorWallId: 'w_sc_s_-9',
    knockTile: { x: -9, z: 11 },
    greetTile: { x: -9, z: 10 },
    knockFacingAngle: Math.PI,
    roofRidgeAxis: 'x',
    rooms: SAGEWOOD_ROOMS,
    walls: buildHouseWalls({
      prefix: 'w_sc',
      houseId: 'sagewood_cottage',
      x1: -13,
      z1: 3,
      x2: -5,
      z2: 10,
      doorSide: 'south',
      doorX: -9,
      northWindows: [-11, -9, -6],
      southWindows: [-12, -7],
      westWindows: [5, 8],
      eastWindows: [5, 9],
      dividerX: -7,
      dividerDoorZs: [6, 9],
      bathDividerZ: 8,
    }),
    objects: SAGEWOOD_OBJECTS,
  },
  {
    id: 'breezeview_loft',
    name: 'Breezeview Loft',
    subtitle: 'Priya Patel & Marcus Brooks',
    directionLabel: 'East Neighbor',
    roofColor: '#4f7796',
    exteriorColor: '#f1f4f6',
    doorColor: '#d9884e',
    residentIds: ['npc_priya', 'npc_marcus'],
    lotRect: { x1: 17, z1: 0, x2: 31, z2: 15 },
    houseRect: { x1: 20, z1: 3, x2: 28, z2: 10 },
    frontDoorWallId: 'w_bl_s_24',
    knockTile: { x: 24, z: 11 },
    greetTile: { x: 24, z: 10 },
    knockFacingAngle: Math.PI,
    roofRidgeAxis: 'x',
    rooms: BREEZEVIEW_ROOMS,
    walls: buildHouseWalls({
      prefix: 'w_bl',
      houseId: 'breezeview_loft',
      x1: 20,
      z1: 3,
      x2: 28,
      z2: 10,
      doorSide: 'south',
      doorX: 24,
      northWindows: [21, 24, 27],
      southWindows: [21, 26],
      westWindows: [5, 8],
      eastWindows: [5, 9],
      dividerX: 26,
      dividerDoorZs: [6, 9],
      bathDividerZ: 8,
    }),
    objects: BREEZEVIEW_OBJECTS,
  },
  {
    id: 'atelier_sunbeam',
    name: 'Atelier Sunbeam',
    subtitle: 'Camille Laurent',
    directionLabel: 'Across Sunnyside Ln',
    roofColor: '#4e8c7e',
    exteriorColor: '#faf4ea',
    doorColor: '#c9884a',
    residentIds: ['npc_camille'],
    lotRect: { x1: 1, z1: 20, x2: 14, z2: 32 },
    houseRect: { x1: 3, z1: 23, x2: 11, z2: 30 },
    frontDoorWallId: 'w_as_n_7',
    knockTile: { x: 7, z: 22 },
    greetTile: { x: 7, z: 23 },
    knockFacingAngle: 0,
    roofRidgeAxis: 'x',
    rooms: ATELIER_ROOMS,
    walls: buildHouseWalls({
      prefix: 'w_as',
      houseId: 'atelier_sunbeam',
      x1: 3,
      z1: 23,
      x2: 11,
      z2: 30,
      doorSide: 'north',
      doorX: 7,
      northWindows: [4, 5, 9, 10],
      southWindows: [4, 6, 10],
      westWindows: [25, 28],
      eastWindows: [25, 29],
      dividerX: 9,
      dividerDoorZs: [26, 29],
      bathDividerZ: 28,
    }),
    objects: ATELIER_OBJECTS,
  },
];

export const NEIGHBOR_HOUSES_BY_ID: Record<NeighborHouseId, NeighborHouseDef> = Object.fromEntries(
  NEIGHBOR_HOUSES.map((h) => [h.id, h]),
) as Record<NeighborHouseId, NeighborHouseDef>;

export const ALL_NEIGHBOR_WALLS: WallSegment[] = NEIGHBOR_HOUSES.flatMap((h) => h.walls);
export const ALL_NEIGHBOR_OBJECTS: PlacedObject[] = NEIGHBOR_HOUSES.flatMap((h) => h.objects);

export const NEIGHBOR_OBJECT_BY_ID: Record<string, PlacedObject> = Object.fromEntries(
  ALL_NEIGHBOR_OBJECTS.map((o) => [o.instanceId, o]),
);

export function isTileInRect(tile: TileCoord, rect: TileRect): boolean {
  return tile.x >= rect.x1 && tile.x <= rect.x2 && tile.z >= rect.z1 && tile.z <= rect.z2;
}

export function getNeighborHouseContainingTile(tile: TileCoord): NeighborHouseDef | null {
  for (const house of NEIGHBOR_HOUSES) {
    if (isTileInRect(tile, house.houseRect)) return house;
  }
  return null;
}

export function getHouseCenterWorld(house: NeighborHouseDef): { x: number; z: number } {
  const cx = (house.houseRect.x1 + house.houseRect.x2 + 1) / 2 - 8;
  const cz = (house.houseRect.z1 + house.houseRect.z2 + 1) / 2 - 8;
  return { x: cx, z: cz };
}
