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
  kind: 'walk' | 'object' | 'self' | 'commute';
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
  contactId?: string;
  relationshipDelta?: number;
  socialPostText?: string;
  deliveryItemId?: string;
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
  awayAtWork: boolean;
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

/* ======================== SMARTPHONE & SOCIAL TYPES ======================== */

export type PhoneAppId = 'home' | 'social' | 'career' | 'order' | 'entertainment';

export type PhoneCaseId =
  | 'coastal_mint'
  | 'coral_sunset'
  | 'midnight_slate'
  | 'lavender_haze'
  | 'honey_gold'
  | 'botanical_sage';

export interface PhoneCaseStyle {
  id: PhoneCaseId;
  name: string;
  frameColor: string;
  accentColor: string;
  meshColor: string;
}

export type RelationshipTier = 'acquaintance' | 'friend' | 'good_friend' | 'best_friend';

export interface NpcContact {
  id: string;
  name: string;
  role: string;
  bio: string;
  traits: string[];
  avatarColor: string;
  hairColor: string;
  skinColor: string;
  relationship: number;
  lastInteractedDay: number;
}

export interface SocialPost {
  id: string;
  authorName: string;
  authorColor: string;
  text: string;
  day: number;
  hour: number;
  minute: number;
  likes: number;
  tag: 'friend' | 'career' | 'lifestyle';
}

export interface PhoneSocialActionDef {
  id: string;
  label: string;
  icon: string;
  durationSimMinutes: number;
  relationshipDelta: number;
  needDeltas: Partial<Record<NeedKey, number>>;
  emotionBoost?: EmotionType;
  postTemplate: (contactName: string) => string;
}

export interface DeliveryItemDef {
  id: string;
  name: string;
  category: 'food' | 'service';
  description: string;
  icon: string;
  cost: number;
  needDeltas: Partial<Record<NeedKey, number>>;
  emotionBoost?: EmotionType;
  postText: string;
}

/* ======================== CAREER & JOB SYSTEM TYPES ======================== */

export type CareerTrackId = 'culinary' | 'tech_guru' | 'painter' | 'writer' | 'barista';

export type WorkTone = 'normal' | 'work_hard' | 'take_easy' | 'socialize';

export type ShiftDayChoice = 'rabbit_hole' | 'wfh' | 'pto' | 'sick' | 'completed';

export interface CareerTaskRule {
  id: string;
  label: string;
  hint: string;
  targetCount: number;
  matchingInteractionIds: string[];
}

export interface CareerLevelDef {
  level: number;
  title: string;
  hourlyPay: number;
  shiftStartHour: number;
  shiftDurationHours: number;
  /** 0 = Mon, 1 = Tue, ..., 6 = Sun */
  workDays: number[];
  promotionBonus: number;
  idealEmotion: EmotionType;
  dailyTask: CareerTaskRule;
}

export interface ChanceCardOption {
  label: string;
  sublabel: string;
  outcomeText: string;
  performanceDelta: number;
  fundsDelta?: number;
  emotionBoost?: EmotionType;
  relationshipBoost?: number;
}

export interface ChanceCardDef {
  id: string;
  title: string;
  scenario: string;
  options: [ChanceCardOption, ChanceCardOption];
}

export interface CareerDef {
  id: CareerTrackId;
  name: string;
  category: 'Full-Time' | 'Part-Time';
  tagline: string;
  accentColor: string;
  icon: string;
  levels: CareerLevelDef[];
  wfhTaskPool: CareerTaskRule[];
  chanceCards: ChanceCardDef[];
}

export interface WfhTaskProgress {
  ruleId: string;
  label: string;
  hint: string;
  matchingInteractionIds: string[];
  progress: number;
  targetCount: number;
}

export interface SimCareerState {
  careerId: CareerTrackId;
  level: number;
  /** 0 to 100 */
  performance: number;
  dailyTaskProgress: number;
  /** Accrued PTO credits; integer part is usable vacation days */
  ptoDays: number;
  shiftsCompleted: number;
  totalEarned: number;
  /** Tracks which clock.day the shiftChoiceForDay & shiftPrompt apply to */
  activeDayMarker: number;
  shiftChoiceForDay: ShiftDayChoice | null;
  promptShownForDay: number;
  wfhActive: boolean;
  wfhTasks: WfhTaskProgress[];
  wfhPaidToday: boolean;
}

export interface ActiveShiftState {
  careerId: CareerTrackId;
  level: number;
  day: number;
  startTotalMinutes: number;
  endTotalMinutes: number;
  tone: WorkTone;
  chanceCardTriggered: boolean;
  performanceGained: number;
  workedMinutes: number;
}

export interface ShiftPromptState {
  day: number;
  careerId: CareerTrackId;
  level: number;
  shiftStartHour: number;
  shiftDurationHours: number;
}

export interface ActiveChanceCardState {
  card: ChanceCardDef;
  careerName: string;
  resolvedOptionIndex?: number;
}

export interface PromotionSummary {
  careerName: string;
  oldTitle: string;
  newTitle: string;
  newLevel: number;
  oldHourlyPay: number;
  newHourlyPay: number;
  bonus: number;
  dailyTaskLabel: string;
}

