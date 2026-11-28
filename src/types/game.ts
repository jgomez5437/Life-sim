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

export type AnimationPose =
  | 'idle'
  | 'walk'
  | 'stand_use'
  | 'sit'
  | 'sleep'
  | 'eat'
  | 'wash'
  | 'phone'
  | 'talk';

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
  /** Present on static neighbor-house furniture (non-editable in Build & Buy). */
  houseId?: NeighborHouseId;
  /** 0-100 cleanliness level on Maya's home lot (defaults to 100). */
  cleanliness?: number;
  /** 0-100 durability level on Maya's home lot (defaults to 100). */
  durability?: number;
  /** True when the home appliance/plumbing has broken and needs repair. */
  isBroken?: boolean;
  /** Permanent upgrades installed by Maya. */
  upgrades?: UpgradeId[];
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
  /** Present on neighbor house walls/doors. */
  houseId?: NeighborHouseId;
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

export type SpeechBubbleIcon =
  | 'chat'
  | 'laugh'
  | 'heart'
  | 'sparkle'
  | 'wave'
  | 'knock'
  | 'coffee'
  | 'wrench';

export interface ActiveSpeechBubble {
  icon: SpeechBubbleIcon;
  expiresAtSimMinute: number;
}

export interface ActionQueueItem {
  id: string;
  kind:
    | 'walk'
    | 'object'
    | 'self'
    | 'commute'
    | 'knock'
    | 'social_npc'
    | 'clean_object'
    | 'repair'
    | 'upgrade_object'
    | 'clean_mess'
    | 'pay_bills';
  label: string;
  icon: string;
  targetObjectId?: string;
  interactionId?: string;
  targetHouseId?: NeighborHouseId;
  targetNpcId?: string;
  targetMessId?: string;
  upgradeId?: UpgradeId;
  partsCost?: number;
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
  romanceDelta?: number;
  bubbleIcon?: SpeechBubbleIcon;
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
  speechBubble?: ActiveSpeechBubble | null;
}

export interface GameClock {
  day: number;
  hour: number;
  minute: number;
  totalMinutes: number;
}

export interface PieMenuTarget {
  kind: 'floor' | 'object' | 'sim' | 'npc' | 'house' | 'mess' | 'mailbox';
  title: string;
  subtitle?: string;
  screenX: number;
  screenY: number;
  worldPos: [number, number, number];
  objectId?: string;
  npcId?: string;
  houseId?: NeighborHouseId;
  messId?: string;
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

export type PhoneAppId = 'home' | 'social' | 'career' | 'household' | 'order' | 'entertainment';

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
export type RomanceTier = 'none' | 'crush' | 'romantic_interest' | 'partner';

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
  romance: number;
  homeHouseId: NeighborHouseId;
  appearance: SimAppearance;
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

export type ShiftDayChoice = 'rabbit_hole' | 'wfh' | 'pto' | 'sick' | 'completed' | 'skipped';

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

/* ======================== NEIGHBORHOOD & LIVE NPC TYPES ======================== */

export type NeighborHouseId = 'sagewood_cottage' | 'breezeview_loft' | 'atelier_sunbeam';

export interface TileRect {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface NeighborHouseDef {
  id: NeighborHouseId;
  name: string;
  subtitle: string;
  directionLabel: string;
  roofColor: string;
  exteriorColor: string;
  doorColor: string;
  residentIds: string[];
  lotRect: TileRect;
  houseRect: TileRect;
  frontDoorWallId: string;
  /** Exterior tile right outside the front door where Maya stands to knock. */
  knockTile: TileCoord;
  /** Interior tile right inside the front door where a resident greets Maya. */
  greetTile: TileCoord;
  /** Facing angle for Maya looking toward the front door when knocking. */
  knockFacingAngle: number;
  /** Roof ridge axis ('x' = ridge runs East-West). */
  roofRidgeAxis: 'x' | 'z';
  rooms: RoomDef[];
  walls: WallSegment[];
  objects: PlacedObject[];
}

export interface FaceToFaceSocialDef {
  id: string;
  label: string;
  icon: string;
  durationSimMinutes: number;
  friendshipDelta: number;
  romanceDelta: number;
  needDeltas: Partial<Record<NeedKey, number>>;
  emotionBoost?: EmotionType;
  bubbleIcon: SpeechBubbleIcon;
  postTemplate: (contactName: string) => string;
}

export interface NpcWorldState {
  contactId: string;
  homeHouseId: NeighborHouseId;
  tileX: number;
  tileZ: number;
  facingAngle: number;
  pose: AnimationPose;
  activeObjectId: string | null;
  activeProp: HeldPropType | null;
  visitingMaya: boolean;
  knockingAtMayaDoor: boolean;
  talkingWithMaya: boolean;
  path: TileCoord[];
  pathIndex: number;
  /** Pending pose/object/arrival action when the NPC reaches the end of `path`. */
  pendingGoal: 'idle' | 'visit_maya_door' | 'enter_maya_home' | 'return_home' | 'greet_maya' | 'use_object';
  pendingObjectId?: string | null;
  pendingPose?: AnimationPose;
  pendingProp?: HeldPropType | null;
  pendingFacingAngle?: number;
  busyUntilSimMinute: number;
  speechBubble: ActiveSpeechBubble | null;
}

export interface DoorbellPromptState {
  contactId: string;
  message: string;
}

/* ======================== HOUSEHOLD BILLS, MESSES & UPGRADES ======================== */

export type UpgradeId = 'eco_saver' | 'self_cleaning' | 'performance_boost' | 'unbreakable';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  requiredHandiness: number;
  partsCost: number;
  simoleonCost: number;
  durationSimMinutes: number;
  applicableTypes: CatalogItem['proceduralType'][];
}

export type MessKind = 'puddle' | 'dirty_dish' | 'trash_pile';

export interface HouseholdMess {
  id: string;
  kind: MessKind;
  tileX: number;
  tileZ: number;
  createdAtSimMinute: number;
}

export interface HandinessState {
  level: number;
  xp: number;
  upgradeParts: number;
}

export interface BillBreakdown {
  lotBase: number;
  furnishings: number;
  ecoDiscount: number;
  ecoUpgradeCount: number;
  total: number;
}

export interface HouseholdBillsState {
  amountDue: number;
  issuedOnDay: number | null;
  dueTotalMinutes: number | null;
  waterShutoffTotalMinutes: number | null;
  powerShutoff: boolean;
  waterShutoff: boolean;
  lastBilledDay: number;
  lastBillBreakdown: BillBreakdown | null;
  totalBillsPaid: number;
}



