export type NeedKey = 'hunger' | 'energy' | 'bladder' | 'hygiene' | 'fun' | 'social';

export type EmotionType =
  | 'happy'
  | 'inspired'
  | 'energized'
  | 'fine'
  | 'uncomfortable'
  | 'tense'
  | 'exhausted';

export type GameMode = 'live' | 'build';
export type WallViewMode = 'cutaway' | 'down' | 'up';
export type SimSpeed = 0 | 1 | 3 | 8;
export type RotationDeg = 0 | 90 | 180 | 270;
export type GraphicsQuality = 'high' | 'balanced';

export type HairStyle = 'bun' | 'waves' | 'bob' | 'pixie';
export type HeldPropType = 'phone' | 'mug' | 'plate' | 'book';

export type CatalogCategory =
  | 'comfort'
  | 'appliances'
  | 'plumbing'
  | 'entertainment'
  | 'surfaces'
  | 'decor';

export type AnimationPose = 'idle' | 'walk' | 'stand_use' | 'sit' | 'sleep' | 'eat' | 'wash' | 'phone';

export interface InteractionOption {
  id: string;
  label: string;
  icon: string;
  cost?: number;
  durationSimMinutes: number;
  needDeltas: Partial<Record<NeedKey, number>>;
  animationPose: Exclude<AnimationPose, 'idle' | 'walk'>;
  emotionBoost?: EmotionType;
  /** Opens the in-world Wardrobe Studio upon arrival at a dresser or mirror. */
  opensWardrobe?: boolean;
  /** Optional 3D prop held in Maya's hand while performing this interaction. */
  heldProp?: HeldPropType;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: CatalogCategory;
  price: number;
  footprint: [widthTiles: number, depthTiles: number];
  /** Local-space offset (in tiles, relative to object center) where the Sim prefers to stand/use when rotation === 0 (front = +Z). */
  interactionOffset: [dx: number, dz: number];
  /** Optional local offset for seated/sleeping/showering pose alignment relative to object center. */
  poseOffset?: [dx: number, dy: number, dz: number];
  walkable?: boolean;
  emitsLight?: boolean;
  /** Optional external .glb URL. When present, AssetRenderer loads via useGLTF; otherwise renders procedural 3D mesh. */
  modelUrl?: string;
  proceduralType:
    | 'bed'
    | 'fridge'
    | 'stove'
    | 'coffee_station'
    | 'dining_table'
    | 'sofa'
    | 'tv_stand'
    | 'toilet'
    | 'shower'
    | 'sink'
    | 'bookshelf'
    | 'plant'
    | 'rug'
    | 'floor_lamp'
    | 'dresser'
    | 'mirror';
  primaryColor: string;
  secondaryColor: string;
  interactions: InteractionOption[];
}

export interface PlacedObject {
  instanceId: string;
  catalogId: string;
  tileX: number;
  tileZ: number;
  rotation: RotationDeg;
}

export interface TileCoord {
  x: number;
  z: number;
}

export interface WallSegment {
  id: string;
  /** 'horizontal' lies on north edge of (x, z); 'vertical' lies on west edge of (x, z). */
  orientation: 'horizontal' | 'vertical';
  x: number;
  z: number;
  kind: 'solid' | 'window' | 'door';
  side: 'north' | 'south' | 'west' | 'east' | 'interior';
}

export interface RoomDef {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  floorType: 'wood_warm' | 'wood_light' | 'tile_kitchen' | 'tile_bath' | 'stone_patio';
}

export interface ActionQueueItem {
  id: string;
  kind: 'walk' | 'object' | 'self';
  label: string;
  icon: string;
  targetObjectId?: string;
  interactionId?: string;
  targetTile: TileCoord;
  facingAngle?: number;
  durationSimMinutes: number;
  elapsedSimMinutes: number;
  cost: number;
  costPaid: boolean;
  needDeltas: Partial<Record<NeedKey, number>>;
  animationPose: AnimationPose;
  emotionBoost?: EmotionType;
  opensWardrobe?: boolean;
  heldProp?: HeldPropType;
  phase: 'routing' | 'performing';
  path: TileCoord[];
  pathIndex: number;
}

export interface SimNeeds {
  hunger: number;
  energy: number;
  bladder: number;
  hygiene: number;
  fun: number;
  social: number;
}

export interface SimAppearance {
  hairStyle: HairStyle;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
}

export interface SimState {
  id: string;
  name: string;
  traits: string[];
  appearance: SimAppearance;
  tileX: number;
  tileZ: number;
  facingAngle: number;
  needs: SimNeeds;
  emotion: EmotionType;
  emotionBoost: { type: EmotionType; expiresAtSimMinute: number } | null;
  pose: AnimationPose;
  activeObjectId: string | null;
  activeProp: HeldPropType | null;
}

export interface GameClock {
  day: number;
  hour: number;
  minute: number;
  totalMinutes: number;
}

export interface PieMenuTarget {
  kind: 'floor' | 'object' | 'sim';
  title: string;
  subtitle?: string;
  screenX: number;
  screenY: number;
  worldPos: [number, number, number];
  objectId?: string;
  tile: TileCoord;
  options: Array<{
    id: string;
    label: string;
    icon: string;
    cost?: number;
    disabled?: boolean;
    reason?: string;
  }>;
}

export interface BuildSelection {
  mode: 'place_new' | 'move_existing';
  catalogId: string;
  movingInstanceId?: string;
  originalTileX?: number;
  originalTileZ?: number;
  originalRotation?: RotationDeg;
  tileX: number;
  tileZ: number;
  rotation: RotationDeg;
  isValid: boolean;
}

export interface FloatingFeedback {
  id: string;
  text: string;
  tone: 'positive' | 'negative' | 'info';
  createdAt: number;
}
