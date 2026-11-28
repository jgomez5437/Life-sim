import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { CAREERS_BY_ID } from '../data/careers';
import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import {
  DISH_SPAWNING_INTERACTION_IDS,
  MAID_SERVICE_COST,
  MAILBOX_STAND_TILE,
  MAX_HANDINESS_LEVEL,
  MAX_HOUSEHOLD_MESSES,
  REPAIR_TECH_COST,
  UPGRADE_BY_ID,
  UPGRADE_PARTS_PACK_COST,
  UPGRADE_PARTS_PACK_QTY,
  createInitialBillsState,
  createInitialHandiness,
} from '../data/householdData';
import {
  ALL_NEIGHBOR_OBJECTS,
  ALL_NEIGHBOR_WALLS,
  MAYA_FRONT_DOOR_OUTSIDE,
  MAYA_WELCOME_TILE,
  NEIGHBOR_HOUSES_BY_ID,
  getHouseCenterWorld,
  getNeighborHouseContainingTile,
} from '../data/neighborhood';
import {
  DELIVERY_ITEMS,
  FACE_TO_FACE_SOCIAL_ACTIONS,
  PHONE_SOCIAL_ACTIONS,
  createInitialContacts,
  createInitialSocialFeed,
} from '../data/phoneData';
import {
  INITIAL_FUNDS,
  STARTER_OBJECTS,
  STARTER_WALLS,
  createInitialClock,
  createInitialSim,
} from '../data/starterLot';
import {
  COMMUTE_STREET_TILE,
  RETURN_HOME_TILE,
  applyWorkShiftNeedTick,
  canPromote,
  computeShiftPay,
  computeShiftPerformanceDelta,
  createInitialCareerState,
  formatHour12,
  generateWfhTasksForDay,
  getCareerLevel,
  getDayOfWeek,
  getNextCareerLevel,
  getShiftWindowForDay,
  isWorkday,
  pickChanceCardForCareer,
} from '../engine/careers';
import {
  findAdjacentStandTile,
  getBestInteractionSlot,
  getOccupiedTiles,
  isInWorldBounds,
  isPlacementValid,
  tileToWorld,
} from '../engine/grid';
import {
  applyObjectUseWear,
  applyPerformanceUpgradeBonus,
  awardHandinessXp,
  calculateWeeklyBill,
  findNearbyMessSpawnTile,
  getEnvironmentMessPenalty,
  getMaintenanceSpecForObject,
  isObjectBlockedByUtility,
} from '../engine/household';
import {
  createInitialNpcWorldStates,
  getLockedDoorWallIdsForMaya,
  getLockedDoorWallIdsForNpc,
  pickNextNpcAutonomyPlan,
} from '../engine/npcEngine';
import { syncAllNpcsRuntime, syncNpcRuntimeToTile } from '../engine/npcRuntime';
import { findPath } from '../engine/pathfinding';
import { simRuntime, syncRuntimeToTile } from '../engine/simRuntime';
import {
  applyNeedDeltas,
  computeEmotion,
  decayNeeds,
  pickAutonomousAction,
} from '../engine/simulation';
import { clampRelationship, createSocialPost } from '../engine/social';
import type {
  ActionQueueItem,
  ActiveChanceCardState,
  ActiveShiftState,
  BuildSelection,
  CareerTrackId,
  DoorbellPromptState,
  FloatingFeedback,
  GameClock,
  GameMode,
  GraphicsQuality,
  HandinessState,
  HouseholdBillsState,
  HouseholdMess,
  NeedKey,
  NeighborHouseId,
  NpcContact,
  NpcWorldState,
  PhoneAppId,
  PhoneCaseId,
  PieMenuTarget,
  PlacedObject,
  PromotionSummary,
  RotationDeg,
  ShiftPromptState,
  SimAppearance,
  SimCareerState,
  SimSpeed,
  SimState,
  SocialPost,
  TileCoord,
  UpgradeId,
  WallSegment,
  WallViewMode,
  WorkTone,
} from '../types/game';

const MAX_QUEUE_LENGTH = 6;
const SAVE_KEY = 'lifesim_save_v1';

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export interface GameStoreState {
  mode: GameMode;
  wallMode: WallViewMode;
  graphicsQuality: GraphicsQuality;
  wardrobeOpen: boolean;
  speed: SimSpeed;
  lastLiveSpeed: Exclude<SimSpeed, 0>;
  freeWill: boolean;
  clock: GameClock;
  funds: number;
  sim: SimState;
  walls: WallSegment[];
  placedObjects: PlacedObject[];
  actionQueue: ActionQueueItem[];
  pieMenu: PieMenuTarget | null;
  buildSelection: BuildSelection | null;
  feedbacks: FloatingFeedback[];
  idleSimMinutes: number;

  // Smartphone, Social & Delivery state
  phoneOpen: boolean;
  phoneApp: PhoneAppId;
  phoneCaseId: PhoneCaseId;
  phoneHasBadge: boolean;
  contacts: NpcContact[];
  socialFeed: SocialPost[];

  // Neighborhood & Live NPC state
  unlockedHouseIds: NeighborHouseId[];
  npcs: NpcWorldState[];
  doorbellPrompt: DoorbellPromptState | null;

  // Career & Job System state
  career: SimCareerState | null;
  shiftPrompt: ShiftPromptState | null;
  activeShift: ActiveShiftState | null;
  activeChanceCard: ActiveChanceCardState | null;
  promotionSummary: PromotionSummary | null;

  // Household Bills, Messes, Handiness & Upgrades state
  bills: HouseholdBillsState;
  handiness: HandinessState;
  messes: HouseholdMess[];

  // Mode & HUD actions
  setMode: (mode: GameMode) => void;
  cycleWallMode: () => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setSpeed: (speed: SimSpeed) => void;
  toggleFreeWill: () => void;
  openPieMenu: (target: PieMenuTarget) => void;
  closePieMenu: () => void;
  addFeedback: (text: string, tone?: FloatingFeedback['tone']) => void;
  pruneFeedbacks: () => void;
  focusCameraOnSim: () => void;

  // Smartphone, Social & Delivery actions
  togglePhone: () => void;
  openPhone: (app?: PhoneAppId) => void;
  closePhone: () => void;
  setPhoneApp: (app: PhoneAppId) => void;
  setPhoneCase: (caseId: PhoneCaseId) => void;
  enqueueContactInteraction: (contactId: string, socialActionId: string) => boolean;
  orderDelivery: (deliveryItemId: string) => boolean;

  // Household Bills, Maintenance, Upgrades & Service actions
  payHouseholdBills: () => boolean;
  enqueuePayBillsAtMailbox: () => boolean;
  enqueueCleanObject: (objectId: string) => boolean;
  enqueueRepairObject: (objectId: string) => boolean;
  enqueueUpgradeObject: (objectId: string, upgradeId: UpgradeId) => boolean;
  enqueueCleanMess: (messId: string) => boolean;
  callRepairTech: () => boolean;
  hireCleaningMaid: () => boolean;
  buyUpgradeParts: () => boolean;

  // Neighborhood & Live NPC actions
  enqueueKnockOnHouse: (houseId: NeighborHouseId) => boolean;
  enqueueNpcInteraction: (contactId: string, socialActionId: string) => boolean;
  inviteContactOver: (contactId: string) => boolean;
  visitNeighborHouse: (houseId: NeighborHouseId) => boolean;
  respondToDoorbell: (accept: boolean) => void;
  sendVisitorHome: (contactId: string) => void;
  updateNpcTile: (contactId: string, tile: TileCoord, facingAngle: number, nextPathIndex: number) => void;
  finishNpcRoute: (contactId: string) => void;
  stepNpcAutonomy: () => void;

  // Career & Job System actions
  joinCareer: (careerId: CareerTrackId) => void;
  quitCareer: () => void;
  chooseShiftMode: (choice: 'rabbit_hole' | 'wfh' | 'pto') => boolean;
  dismissShiftPrompt: () => void;
  goToWorkNow: () => boolean;
  callInSick: () => boolean;
  setWorkTone: (tone: WorkTone) => void;
  leaveWorkEarly: () => void;
  resolveChanceCard: (optionIndex: 0 | 1) => void;
  dismissChanceCard: () => void;
  dismissPromotionSummary: () => void;

  // In-world Wardrobe actions (triggered via dresser/mirror)
  openWardrobe: () => void;
  closeWardrobe: (showSavedToast?: boolean) => void;
  updateSimAppearance: (patch: Partial<SimAppearance>) => void;

  // Live mode gameplay actions
  enqueueWalk: (tile: TileCoord) => boolean;
  enqueueObjectInteraction: (objectId: string, interactionId: string) => boolean;
  enqueueSelfInteraction: (interactionId: string) => boolean;
  enqueueBestForNeed: (needKey: NeedKey) => boolean;
  cancelAction: (actionId: string) => void;

  // Simulation driver ticks
  tickSimMinutes: (simMinutesDelta: number) => void;
  updateSimTile: (tile: TileCoord, facingAngle: number, nextPathIndex: number) => void;
  beginPerformingActiveAction: () => void;
  tryAutonomousDecision: () => void;

  // Build / Buy actions
  startBuildItem: (catalogId: string) => void;
  startMoveObject: (instanceId: string) => void;
  updateBuildGhost: (tileX: number, tileZ: number) => void;
  rotateBuildSelection: () => void;
  confirmBuildPlacement: () => boolean;
  sellSelectedObject: () => boolean;
  cancelBuildSelection: () => void;

  // Persistence / Reset
  resetStarterLot: () => void;
}

function getAllWorldObjects(homeObjects: PlacedObject[]): PlacedObject[] {
  return [...homeObjects, ...ALL_NEIGHBOR_OBJECTS];
}

function getAllWorldWalls(homeWalls: WallSegment[]): WallSegment[] {
  return [...homeWalls, ...ALL_NEIGHBOR_WALLS];
}

function findInitialBuildTile(
  catalogId: string,
  rotation: RotationDeg,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  simTile: TileCoord,
): TileCoord {
  const item = CATALOG_BY_ID[catalogId];
  if (!item) return { x: 6, z: 6 };

  // Spiral search starting near center of the living room
  const centerX = 6;
  const centerZ = 6;
  for (let radius = 0; radius <= 7; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const tx = centerX + dx;
        const tz = centerZ + dz;
        if (isPlacementValid(item, tx, tz, rotation, placedObjects, walls, { simTile })) {
          return { x: tx, z: tz };
        }
      }
    }
  }
  return { x: 6, z: 6 };
}

function preparePathForFrontAction(
  queue: ActionQueueItem[],
  sim: SimState,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  unlockedHouseIds: NeighborHouseId[] = [],
  npcs: NpcWorldState[] = [],
): ActionQueueItem[] {
  let remaining = queue;
  const simTile = { x: sim.tileX, z: sim.tileZ };
  const allObjects = getAllWorldObjects(placedObjects);
  const allWalls = getAllWorldWalls(walls);
  const lockedDoors = getLockedDoorWallIdsForMaya(unlockedHouseIds);

  while (remaining.length > 0) {
    const [front, ...rest] = remaining;
    if (front.phase === 'performing') return remaining;

    if (front.kind === 'self') {
      return [
        {
          ...front,
          targetTile: simTile,
          path: [],
          pathIndex: 0,
        },
        ...rest,
      ];
    }

    let targetTile = front.targetTile;
    let facingAngle = front.facingAngle;

    if (
      (front.kind === 'object' ||
        front.kind === 'clean_object' ||
        front.kind === 'repair' ||
        front.kind === 'upgrade_object') &&
      front.targetObjectId
    ) {
      const obj = allObjects.find((o) => o.instanceId === front.targetObjectId);
      const item = obj ? CATALOG_BY_ID[obj.catalogId] : null;
      if (!obj || !item) {
        remaining = rest;
        continue;
      }
      const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, simTile, lockedDoors);
      if (!slot) {
        remaining = rest;
        continue;
      }
      targetTile = slot.tile;
      facingAngle = slot.facingAngle;
    } else if (front.kind === 'pay_bills') {
      targetTile = MAILBOX_STAND_TILE;
      facingAngle = 0;
    } else if (front.kind === 'social_npc' && front.targetNpcId) {
      const npc = npcs.find((n) => n.contactId === front.targetNpcId);
      if (!npc) {
        remaining = rest;
        continue;
      }
      const stand = findAdjacentStandTile(
        { x: npc.tileX, z: npc.tileZ },
        simTile,
        allObjects,
        allWalls,
        lockedDoors,
      );
      if (!stand) {
        remaining = rest;
        continue;
      }
      targetTile = stand.tile;
      facingAngle = stand.facingAngle;
    } else if (front.kind === 'knock' && front.targetHouseId) {
      const house = NEIGHBOR_HOUSES_BY_ID[front.targetHouseId];
      if (!house) {
        remaining = rest;
        continue;
      }
      targetTile = house.knockTile;
      facingAngle = house.knockFacingAngle;
    }

    const path = findPath(simTile, targetTile, allObjects, allWalls, lockedDoors);
    if (path === null) {
      remaining = rest;
      continue;
    }

    return [
      {
        ...front,
        targetTile,
        facingAngle,
        path,
        pathIndex: 0,
      },
      ...rest,
    ];
  }

  return [];
}

function buildCommuteAction(
  sim: SimState,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  careerName: string,
  unlockedHouseIds: NeighborHouseId[] = [],
): ActionQueueItem | null {
  const startTile = { x: sim.tileX, z: sim.tileZ };
  const path = findPath(
    startTile,
    COMMUTE_STREET_TILE,
    getAllWorldObjects(placedObjects),
    getAllWorldWalls(walls),
    getLockedDoorWallIdsForMaya(unlockedHouseIds),
  );
  if (path === null) return null;
  return {
    id: nextId('act'),
    kind: 'commute',
    label: `Go to ${careerName}`,
    icon: 'briefcase',
    targetTile: { ...COMMUTE_STREET_TILE },
    durationSimMinutes: 0,
    elapsedSimMinutes: 0,
    cost: 0,
    costPaid: true,
    needDeltas: {},
    animationPose: 'walk',
    phase: 'routing',
    path,
    pathIndex: 0,
  };
}

function buildReturnHomeAction(
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  unlockedHouseIds: NeighborHouseId[] = [],
): ActionQueueItem[] {
  const path = findPath(
    COMMUTE_STREET_TILE,
    RETURN_HOME_TILE,
    getAllWorldObjects(placedObjects),
    getAllWorldWalls(walls),
    getLockedDoorWallIdsForMaya(unlockedHouseIds),
  );
  if (!path || path.length === 0) return [];
  return [
    {
      id: nextId('act'),
      kind: 'walk',
      label: 'Return Home',
      icon: 'footprints',
      targetTile: { ...RETURN_HOME_TILE },
      durationSimMinutes: 0,
      elapsedSimMinutes: 0,
      cost: 0,
      costPaid: true,
      needDeltas: {},
      animationPose: 'walk',
      phase: 'routing',
      path,
      pathIndex: 0,
    },
  ];
}

function sendNpcBackHomeState(
  npc: NpcWorldState,
  allObjects: PlacedObject[],
  allWalls: WallSegment[],
  waveUntilSimMinute?: number,
): NpcWorldState {
  const house = NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId];
  const lockedForNpc = getLockedDoorWallIdsForNpc(npc);
  const path =
    (house &&
      findPath(
        { x: npc.tileX, z: npc.tileZ },
        house.greetTile,
        allObjects,
        allWalls,
        lockedForNpc,
      )) ||
    [];
  return {
    ...npc,
    visitingMaya: false,
    knockingAtMayaDoor: false,
    talkingWithMaya: false,
    activeObjectId: null,
    activeProp: null,
    pose: path.length > 0 ? 'walk' : 'idle',
    path,
    pathIndex: 0,
    pendingGoal: 'return_home',
    pendingObjectId: null,
    speechBubble: waveUntilSimMinute
      ? { icon: 'wave', expiresAtSimMinute: waveUntilSimMinute }
      : null,
  };
}

const SEED_CONTACTS = createInitialContacts();
const SEED_NPCS = createInitialNpcWorldStates(SEED_CONTACTS);
syncAllNpcsRuntime(SEED_NPCS);

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      mode: 'live',
      wallMode: 'cutaway',
      graphicsQuality: 'high',
      wardrobeOpen: false,
      speed: 1,
      lastLiveSpeed: 1,
      freeWill: true,
      clock: createInitialClock(),
      funds: INITIAL_FUNDS,
      sim: createInitialSim(),
      walls: STARTER_WALLS,
      placedObjects: STARTER_OBJECTS.map((o) => ({ ...o })),
      actionQueue: [],
      pieMenu: null,
      buildSelection: null,
      feedbacks: [],
      idleSimMinutes: 0,

      // Smartphone, Social & Delivery state
      phoneOpen: false,
      phoneApp: 'home',
      phoneCaseId: 'coastal_mint',
      phoneHasBadge: false,
      contacts: SEED_CONTACTS.map((c) => ({ ...c, appearance: { ...c.appearance } })),
      socialFeed: createInitialSocialFeed(),

      // Neighborhood & Live NPC state
      unlockedHouseIds: [],
      npcs: SEED_NPCS.map((n) => ({ ...n, path: [] })),
      doorbellPrompt: null,

      // Career & Job System state
      career: null,
      shiftPrompt: null,
      activeShift: null,
      activeChanceCard: null,
      promotionSummary: null,

      // Household Bills, Messes, Handiness & Upgrades state
      bills: createInitialBillsState(),
      handiness: createInitialHandiness(),
      messes: [],

      setMode: (mode) => {
        const state = get();
        if (state.mode === mode) return;
        if (mode === 'build') {
          simRuntime.focusWorldTarget = { x: 0, z: 0 };
          set({
            mode: 'build',
            wardrobeOpen: false,
            phoneOpen: false,
            lastLiveSpeed: state.speed === 0 ? state.lastLiveSpeed : state.speed,
            speed: 0,
            pieMenu: null,
            buildSelection: null,
          });
        } else {
          // Re-validate queued walking path in case new furniture now intersects the old route
          const refreshedQueue = preparePathForFrontAction(
            state.actionQueue,
            state.sim,
            state.placedObjects,
            state.walls,
            state.unlockedHouseIds,
            state.npcs,
          );
          const frontWasCancelled =
            state.actionQueue.length > 0 &&
            (refreshedQueue.length === 0 || refreshedQueue[0].id !== state.actionQueue[0].id);

          set({
            mode: 'live',
            speed: state.lastLiveSpeed || 1,
            buildSelection: null,
            pieMenu: null,
            actionQueue: refreshedQueue,
            sim: frontWasCancelled
              ? { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null }
              : state.sim,
          });
        }
      },

      enqueueKnockOnHouse: (houseId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        const house = NEIGHBOR_HOUSES_BY_ID[houseId];
        if (!house) return false;
        if (state.unlockedHouseIds.includes(houseId)) {
          state.addFeedback(`Already invited inside ${house.name}!`, 'info');
          return state.enqueueWalk(house.greetTile);
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const path = findPath(startTile, house.knockTile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${house.name} right now`, 'negative');
          return false;
        }

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'knock',
          label: `Knock at ${house.name}`,
          icon: 'home',
          targetHouseId: houseId,
          targetTile: { ...house.knockTile },
          facingAngle: house.knockFacingAngle,
          durationSimMinutes: 5,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: {},
          animationPose: 'stand_use',
          bubbleIcon: 'knock',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueNpcInteraction: (contactId, socialActionId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const npc = state.npcs.find((n) => n.contactId === contactId);
        const contact = state.contacts.find((c) => c.id === contactId);
        const socialDef = FACE_TO_FACE_SOCIAL_ACTIONS.find((a) => a.id === socialActionId);
        if (!npc || !contact || !socialDef) return false;

        // If NPC is inside a locked neighbor house, knock on their front door first!
        const npcHouse = getNeighborHouseContainingTile({ x: npc.tileX, z: npc.tileZ });
        if (npcHouse && !state.unlockedHouseIds.includes(npcHouse.id)) {
          state.addFeedback(`Knocking at ${npcHouse.name} first!`, 'info');
          return state.enqueueKnockOnHouse(npcHouse.id);
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);

        const stand = findAdjacentStandTile(
          { x: npc.tileX, z: npc.tileZ },
          startTile,
          allObjects,
          allWalls,
          lockedDoors,
        );
        if (!stand) {
          state.addFeedback(`Cannot get close to ${contact.name}`, 'negative');
          return false;
        }

        const path = findPath(startTile, stand.tile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${contact.name} right now`, 'negative');
          return false;
        }

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'social_npc',
          label: `${socialDef.label}: ${contact.name.split(' ')[0]}`,
          icon: socialDef.icon,
          interactionId: socialDef.id,
          targetNpcId: contactId,
          contactId,
          targetTile: stand.tile,
          facingAngle: stand.facingAngle,
          durationSimMinutes: socialDef.durationSimMinutes,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: socialDef.needDeltas,
          animationPose: 'talk',
          emotionBoost: socialDef.emotionBoost,
          relationshipDelta: socialDef.friendshipDelta,
          romanceDelta: socialDef.romanceDelta,
          bubbleIcon: socialDef.bubbleIcon,
          socialPostText: socialDef.postTemplate(contact.name),
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      inviteContactOver: (contactId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Wait until Maya gets home to invite friends over!', 'info');
          return false;
        }
        const npc = state.npcs.find((n) => n.contactId === contactId);
        const contact = state.contacts.find((c) => c.id === contactId);
        if (!npc || !contact) return false;

        if (npc.visitingMaya) {
          state.addFeedback(`${contact.name} is already visiting!`, 'info');
          return false;
        }

        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedForNpc = getLockedDoorWallIdsForNpc(npc);
        const path = findPath(
          { x: npc.tileX, z: npc.tileZ },
          MAYA_FRONT_DOOR_OUTSIDE,
          allObjects,
          allWalls,
          lockedForNpc,
        );
        if (path === null) {
          state.addFeedback(`${contact.name} couldn't find a clear path over`, 'negative');
          return false;
        }

        const arrivedImmediately = path.length === 0;
        set({
          phoneOpen: false,
          pieMenu: null,
          doorbellPrompt: arrivedImmediately
            ? {
                contactId,
                message: `${contact.name} is at your front door!`,
              }
            : state.doorbellPrompt,
          npcs: state.npcs.map((n) =>
            n.contactId === contactId
              ? {
                  ...n,
                  pose: arrivedImmediately ? 'idle' : 'walk',
                  activeObjectId: null,
                  activeProp: null,
                  knockingAtMayaDoor: arrivedImmediately,
                  talkingWithMaya: false,
                  path,
                  pathIndex: 0,
                  pendingGoal: 'visit_maya_door',
                  speechBubble: {
                    icon: arrivedImmediately ? 'knock' : 'wave',
                    expiresAtSimMinute: state.clock.totalMinutes + 20,
                  },
                }
              : n,
          ),
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `${contact.name} is walking over to your house!`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      visitNeighborHouse: (houseId) => {
        const house = NEIGHBOR_HOUSES_BY_ID[houseId];
        if (!house) return false;
        simRuntime.focusWorldTarget = getHouseCenterWorld(house);
        return get().enqueueKnockOnHouse(houseId);
      },

      respondToDoorbell: (accept) => {
        const state = get();
        const prompt = state.doorbellPrompt;
        if (!prompt) return;
        const npc = state.npcs.find((n) => n.contactId === prompt.contactId);
        const contact = state.contacts.find((c) => c.id === prompt.contactId);
        if (!npc || !contact) {
          set({ doorbellPrompt: null });
          return;
        }

        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedForNpc = getLockedDoorWallIdsForNpc(npc);

        if (accept) {
          const path =
            findPath(
              { x: npc.tileX, z: npc.tileZ },
              MAYA_WELCOME_TILE,
              allObjects,
              allWalls,
              lockedForNpc,
            ) ?? [];
          set({
            doorbellPrompt: null,
            npcs: state.npcs.map((n) =>
              n.contactId === prompt.contactId
                ? {
                    ...n,
                    visitingMaya: true,
                    knockingAtMayaDoor: false,
                    pose: path.length > 0 ? 'walk' : 'idle',
                    path,
                    pathIndex: 0,
                    pendingGoal: 'enter_maya_home',
                    busyUntilSimMinute: state.clock.totalMinutes + 16,
                    speechBubble: {
                      icon: 'wave',
                      expiresAtSimMinute: state.clock.totalMinutes + 18,
                    },
                  }
                : n,
            ),
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `${contact.name} came inside to hang out!`,
                tone: 'positive',
                createdAt: Date.now(),
              },
            ],
          });
        } else {
          const house = NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId];
          const path =
            (house &&
              findPath(
                { x: npc.tileX, z: npc.tileZ },
                house.greetTile,
                allObjects,
                allWalls,
                lockedForNpc,
              )) ||
            [];
          set({
            doorbellPrompt: null,
            npcs: state.npcs.map((n) =>
              n.contactId === prompt.contactId
                ? {
                    ...n,
                    visitingMaya: false,
                    knockingAtMayaDoor: false,
                    pose: path.length > 0 ? 'walk' : 'idle',
                    path,
                    pathIndex: 0,
                    pendingGoal: 'return_home',
                    speechBubble: null,
                  }
                : n,
            ),
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Maybe next time, ${contact.name.split(' ')[0]}!`,
                tone: 'info',
                createdAt: Date.now(),
              },
            ],
          });
        }
      },

      sendVisitorHome: (contactId) => {
        const state = get();
        const npc = state.npcs.find((n) => n.contactId === contactId);
        const contact = state.contacts.find((c) => c.id === contactId);
        if (!npc || !contact) return;

        const house = NEIGHBOR_HOUSES_BY_ID[npc.homeHouseId];
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedForNpc = getLockedDoorWallIdsForNpc(npc);
        const path =
          (house &&
            findPath(
              { x: npc.tileX, z: npc.tileZ },
              house.greetTile,
              allObjects,
              allWalls,
              lockedForNpc,
            )) ||
          [];

        set({
          pieMenu: null,
          npcs: state.npcs.map((n) =>
            n.contactId === contactId
              ? {
                  ...n,
                  visitingMaya: false,
                  knockingAtMayaDoor: false,
                  talkingWithMaya: false,
                  activeObjectId: null,
                  activeProp: null,
                  pose: path.length > 0 ? 'walk' : 'idle',
                  path,
                  pathIndex: 0,
                  pendingGoal: 'return_home',
                  speechBubble: {
                    icon: 'wave',
                    expiresAtSimMinute: state.clock.totalMinutes + 15,
                  },
                }
              : n,
          ),
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `${contact.name} headed back home`,
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
      },

      updateNpcTile: (contactId, tile, facingAngle, nextPathIndex) => {
        set((state) => ({
          npcs: state.npcs.map((n) =>
            n.contactId === contactId
              ? {
                  ...n,
                  tileX: tile.x,
                  tileZ: tile.z,
                  facingAngle,
                  pose: 'walk',
                  activeObjectId: null,
                  activeProp: null,
                  pathIndex: nextPathIndex,
                }
              : n,
          ),
        }));
      },

      finishNpcRoute: (contactId) => {
        set((state) => {
          const npc = state.npcs.find((n) => n.contactId === contactId);
          if (!npc) return state;
          const contact = state.contacts.find((c) => c.id === contactId);
          let nextDoorbell = state.doorbellPrompt;
          const nextFeedbacks = [...state.feedbacks];

          const updatedNpcs = state.npcs.map((n) => {
            if (n.contactId !== contactId) return n;
            if (n.pendingGoal === 'visit_maya_door') {
              if (state.sim.awayAtWork) {
                if (contact) {
                  nextFeedbacks.push({
                    id: nextId('fb'),
                    text: `${contact.name.split(' ')[0]} stopped by while Maya was at work`,
                    tone: 'info',
                    createdAt: Date.now(),
                  });
                }
                const allObjects = getAllWorldObjects(state.placedObjects);
                const allWalls = getAllWorldWalls(state.walls);
                return sendNpcBackHomeState(n, allObjects, allWalls, state.clock.totalMinutes + 12);
              }
              if (contact) {
                nextDoorbell = {
                  contactId,
                  message: `${contact.name} is at your front door!`,
                };
                nextFeedbacks.push({
                  id: nextId('fb'),
                  text: `Doorbell! ${contact.name} is outside`,
                  tone: 'info',
                  createdAt: Date.now(),
                });
              }
              return {
                ...n,
                path: [],
                pathIndex: 0,
                pose: 'idle' as const,
                facingAngle: Math.PI,
                knockingAtMayaDoor: true,
                pendingGoal: 'idle' as const,
                busyUntilSimMinute: state.clock.totalMinutes + 45,
                speechBubble: {
                  icon: 'knock' as const,
                  expiresAtSimMinute: state.clock.totalMinutes + 30,
                },
              };
            }
            if (n.pendingGoal === 'return_home') {
              return {
                ...n,
                path: [],
                pathIndex: 0,
                pose: 'idle' as const,
                visitingMaya: false,
                knockingAtMayaDoor: false,
                pendingGoal: 'idle' as const,
                busyUntilSimMinute: state.clock.totalMinutes + 20,
              };
            }
            if (n.pendingGoal === 'use_object' && n.pendingObjectId) {
              return {
                ...n,
                path: [],
                pathIndex: 0,
                pose: n.pendingPose ?? 'stand_use',
                activeObjectId: n.pendingObjectId,
                activeProp: n.pendingProp ?? null,
                facingAngle: n.pendingFacingAngle ?? n.facingAngle,
                pendingGoal: 'idle' as const,
                pendingObjectId: null,
                busyUntilSimMinute: state.clock.totalMinutes + 26,
              };
            }
            if (n.pendingGoal === 'greet_maya') {
              return {
                ...n,
                path: [],
                pathIndex: 0,
                pose: 'idle' as const,
                facingAngle: n.pendingFacingAngle ?? n.facingAngle,
                pendingGoal: 'idle' as const,
                busyUntilSimMinute: state.clock.totalMinutes + 18,
                speechBubble: {
                  icon: 'wave' as const,
                  expiresAtSimMinute: state.clock.totalMinutes + 18,
                },
              };
            }
            return {
              ...n,
              path: [],
              pathIndex: 0,
              pose: 'idle' as const,
              pendingGoal: 'idle' as const,
              busyUntilSimMinute: state.clock.totalMinutes + 18,
            };
          });

          return {
            npcs: updatedNpcs,
            doorbellPrompt: nextDoorbell,
            feedbacks: nextFeedbacks.slice(-4),
          };
        });
      },

      stepNpcAutonomy: () => {
        const state = get();
        if (state.mode !== 'live' || state.wardrobeOpen || state.speed === 0) return;

        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const now = state.clock.totalMinutes;
        let changed = false;

        const nextNpcs = state.npcs.map((npc, idx) => {
          // Skip NPCs currently walking, talking to Maya, knocking at Maya's door, or still busy
          if (
            npc.path.length > 0 ||
            npc.talkingWithMaya ||
            npc.knockingAtMayaDoor ||
            now < npc.busyUntilSimMinute
          ) {
            return npc;
          }

          const seed = Math.floor(now) + idx * 17 + state.clock.day * 31;
          const plan = pickNextNpcAutonomyPlan(
            npc,
            allObjects,
            allWalls,
            state.placedObjects,
            state.clock.hour,
            seed,
          );
          if (!plan) {
            changed = true;
            return {
              ...npc,
              pose: 'idle' as const,
              activeObjectId: null,
              activeProp: null,
              busyUntilSimMinute: now + 14,
            };
          }

          changed = true;
          return {
            ...npc,
            pose: plan.path.length > 0 ? ('walk' as const) : (plan.pendingPose ?? ('idle' as const)),
            activeObjectId: plan.path.length > 0 ? null : (plan.pendingObjectId ?? null),
            activeProp: plan.path.length > 0 ? null : (plan.pendingProp ?? null),
            path: plan.path,
            pathIndex: 0,
            pendingGoal: plan.pendingGoal,
            pendingObjectId: plan.pendingObjectId ?? null,
            pendingPose: plan.pendingPose,
            pendingProp: plan.pendingProp ?? null,
            pendingFacingAngle: plan.pendingFacingAngle,
            busyUntilSimMinute: now + plan.durationMinutes,
          };
        });

        if (changed) {
          set({ npcs: nextNpcs });
        }
      },

      cycleWallMode: () =>
        set((state) => {
          const order: WallViewMode[] = ['cutaway', 'down', 'up'];
          const next = order[(order.indexOf(state.wallMode) + 1) % order.length];
          return { wallMode: next };
        }),

      setGraphicsQuality: (graphicsQuality) =>
        set((state) => ({
          graphicsQuality,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text:
                graphicsQuality === 'high'
                  ? 'Graphics: High Fidelity'
                  : 'Graphics: Balanced Mobile',
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        })),

      togglePhone: () =>
        set((state) => {
          if (state.mode !== 'live' || state.wardrobeOpen) return state;
          const nextOpen = !state.phoneOpen;
          return {
            phoneOpen: nextOpen,
            phoneHasBadge: nextOpen ? false : state.phoneHasBadge,
            pieMenu: null,
          };
        }),

      openPhone: (app) =>
        set((state) => {
          if (state.mode !== 'live' || state.wardrobeOpen) return state;
          return {
            phoneOpen: true,
            phoneApp: app ?? state.phoneApp,
            phoneHasBadge: false,
            pieMenu: null,
          };
        }),

      closePhone: () => set({ phoneOpen: false }),

      setPhoneApp: (phoneApp) => set({ phoneApp, phoneHasBadge: false }),

      setPhoneCase: (phoneCaseId) =>
        set((state) => ({
          phoneCaseId,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: 'Phone Case Updated!',
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        })),

      enqueueContactInteraction: (contactId, socialActionId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const contact = state.contacts.find((c) => c.id === contactId);
        const socialAction = PHONE_SOCIAL_ACTIONS.find((a) => a.id === socialActionId);
        if (!contact || !socialAction) return false;

        const plannedTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'self',
          label: `${socialAction.label}: ${contact.name.split(' ')[0]}`,
          icon: socialAction.icon,
          interactionId: socialAction.id,
          targetTile: plannedTile,
          durationSimMinutes: socialAction.durationSimMinutes,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: socialAction.needDeltas,
          animationPose: 'phone',
          emotionBoost: socialAction.emotionBoost,
          heldProp: 'phone',
          contactId: contact.id,
          relationshipDelta: socialAction.relationshipDelta,
          socialPostText: socialAction.postTemplate(contact.name),
          phase: 'routing',
          path: [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      orderDelivery: (deliveryItemId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Wait until Maya gets home to order!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const item = DELIVERY_ITEMS.find((d) => d.id === deliveryItemId);
        if (!item) return false;
        if (state.funds < item.cost) {
          state.addFeedback(`Need §${item.cost} Simoleons`, 'negative');
          return false;
        }

        const plannedTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'self',
          label: `Order ${item.name}`,
          icon: item.icon,
          interactionId: item.id,
          targetTile: plannedTile,
          durationSimMinutes: 10,
          elapsedSimMinutes: 0,
          cost: item.cost,
          costPaid: false,
          needDeltas: item.needDeltas,
          animationPose: 'phone',
          emotionBoost: item.emotionBoost,
          heldProp: 'phone',
          deliveryItemId: item.id,
          socialPostText: item.postText,
          phase: 'routing',
          path: [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      payHouseholdBills: () => {
        const state = get();
        if (state.bills.amountDue <= 0) {
          state.addFeedback('All household bills are already paid!', 'info');
          return false;
        }
        if (state.funds < state.bills.amountDue) {
          state.addFeedback(`Need §${state.bills.amountDue} to pay bills`, 'negative');
          return false;
        }
        const paid = state.bills.amountDue;
        const wasShutoff = state.bills.powerShutoff || state.bills.waterShutoff;
        const nextSocialFeed = wasShutoff
          ? [
              createSocialPost({
                id: nextId('post'),
                authorName: state.sim.name,
                authorColor: state.sim.appearance.topColor,
                text: `Paid the §${paid} utility bill — lights and hot water are officially back on!`,
                clock: state.clock,
                tag: 'lifestyle',
              }),
              ...state.socialFeed,
            ].slice(0, 18)
          : state.socialFeed;

        set({
          funds: state.funds - paid,
          bills: {
            ...state.bills,
            amountDue: 0,
            issuedOnDay: null,
            dueTotalMinutes: null,
            waterShutoffTotalMinutes: null,
            powerShutoff: false,
            waterShutoff: false,
            totalBillsPaid: state.bills.totalBillsPaid + paid,
          },
          socialFeed: nextSocialFeed,
          pieMenu: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: wasShutoff
                ? `Paid §${paid} — Power & Water Restored!`
                : `Household Bills Paid (-§${paid})`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      enqueuePayBillsAtMailbox: () => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.bills.amountDue <= 0) {
          state.addFeedback('No unpaid bills in the mailbox!', 'info');
          return false;
        }
        if (state.funds < state.bills.amountDue) {
          state.addFeedback(`Need §${state.bills.amountDue} to pay bills`, 'negative');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const path = findPath(startTile, MAILBOX_STAND_TILE, allObjects, allWalls, lockedDoors);
        if (path === null) {
          return state.payHouseholdBills();
        }

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'pay_bills',
          label: `Pay Bills (§${state.bills.amountDue})`,
          icon: 'mail',
          targetTile: MAILBOX_STAND_TILE,
          facingAngle: 0,
          durationSimMinutes: 6,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: {},
          animationPose: 'stand_use',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueCleanObject: (objectId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const obj = state.placedObjects.find((o) => o.instanceId === objectId);
        if (!obj || obj.houseId) return false;
        const item = CATALOG_BY_ID[obj.catalogId];
        if (!item) return false;

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedDoors);
        if (!slot) {
          state.addFeedback(`${item.name} is blocked!`, 'negative');
          return false;
        }
        const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${item.name}`, 'negative');
          return false;
        }

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'clean_object',
          label: `Scrub ${item.name}`,
          icon: 'sparkles',
          targetObjectId: objectId,
          targetTile: slot.tile,
          facingAngle: slot.facingAngle,
          durationSimMinutes: 16,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: { hygiene: -5, fun: -3 },
          animationPose: 'wash',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueRepairObject: (objectId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const obj = state.placedObjects.find((o) => o.instanceId === objectId);
        if (!obj || obj.houseId || !obj.isBroken) return false;
        const item = CATALOG_BY_ID[obj.catalogId];
        if (!item) return false;

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedDoors);
        if (!slot) {
          state.addFeedback(`${item.name} is blocked!`, 'negative');
          return false;
        }
        const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${item.name}`, 'negative');
          return false;
        }

        const speedScale = state.handiness.level >= MAX_HANDINESS_LEVEL ? 0.65 : 1 - (state.handiness.level - 1) * 0.08;
        const duration = Math.max(12, Math.round(28 * speedScale));

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'repair',
          label: `Repair ${item.name}`,
          icon: 'wrench',
          targetObjectId: objectId,
          targetTile: slot.tile,
          facingAngle: slot.facingAngle,
          durationSimMinutes: duration,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: { energy: -6, hygiene: -6 },
          animationPose: 'stand_use',
          bubbleIcon: 'wrench',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueUpgradeObject: (objectId, upgradeId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const obj = state.placedObjects.find((o) => o.instanceId === objectId);
        if (!obj || obj.houseId) return false;
        if (obj.isBroken) {
          state.addFeedback('Repair this item before upgrading it!', 'info');
          return false;
        }
        if (obj.upgrades?.includes(upgradeId)) {
          state.addFeedback('Upgrade already installed!', 'info');
          return false;
        }
        const item = CATALOG_BY_ID[obj.catalogId];
        const upgrade = UPGRADE_BY_ID[upgradeId];
        if (!item || !upgrade || !upgrade.applicableTypes.includes(item.proceduralType)) {
          return false;
        }

        if (state.handiness.level < upgrade.requiredHandiness) {
          state.addFeedback(`Needs Handiness Lv ${upgrade.requiredHandiness}`, 'negative');
          return false;
        }

        const useParts = state.handiness.upgradeParts >= upgrade.partsCost;
        const simCost = useParts ? 0 : upgrade.simoleonCost;
        if (!useParts && state.funds < simCost) {
          state.addFeedback(
            `Needs ${upgrade.partsCost} Parts or §${upgrade.simoleonCost}`,
            'negative',
          );
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedDoors);
        if (!slot) {
          state.addFeedback(`${item.name} is blocked!`, 'negative');
          return false;
        }
        const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${item.name}`, 'negative');
          return false;
        }

        const speedScale = state.handiness.level >= MAX_HANDINESS_LEVEL ? 0.65 : 1 - (state.handiness.level - 1) * 0.06;
        const duration = Math.max(12, Math.round(upgrade.durationSimMinutes * speedScale));

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'upgrade_object',
          label: `Upgrade: ${upgrade.shortLabel}`,
          icon: upgrade.icon,
          targetObjectId: objectId,
          upgradeId,
          partsCost: useParts ? upgrade.partsCost : 0,
          targetTile: slot.tile,
          facingAngle: slot.facingAngle,
          durationSimMinutes: duration,
          elapsedSimMinutes: 0,
          cost: simCost,
          costPaid: false,
          needDeltas: { energy: -5, fun: 6 },
          animationPose: 'stand_use',
          emotionBoost: 'inspired',
          bubbleIcon: 'wrench',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueCleanMess: (messId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }
        const mess = state.messes.find((m) => m.id === messId);
        if (!mess) return false;

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const targetTile = { x: mess.tileX, z: mess.tileZ };
        const path = findPath(startTile, targetTile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback('Cannot reach that mess right now', 'negative');
          return false;
        }

        const label =
          mess.kind === 'puddle'
            ? 'Mop Up Puddle'
            : mess.kind === 'dirty_dish'
              ? 'Wash Dirty Dish'
              : 'Throw Away Trash';

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'clean_mess',
          label,
          icon: mess.kind === 'puddle' ? 'droplet' : mess.kind === 'trash_pile' ? 'trash' : 'sparkles',
          targetMessId: messId,
          targetTile,
          durationSimMinutes: 10,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: { hygiene: -3 },
          animationPose: 'wash',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      callRepairTech: () => {
        const state = get();
        const brokenCount = state.placedObjects.filter((o) => !o.houseId && o.isBroken).length;
        if (brokenCount === 0) {
          state.addFeedback('All home appliances are working fine!', 'info');
          return false;
        }
        if (state.funds < REPAIR_TECH_COST) {
          state.addFeedback(`Need §${REPAIR_TECH_COST} for Repair Tech`, 'negative');
          return false;
        }

        const repairedObjects = state.placedObjects.map((o) =>
          !o.houseId && o.isBroken
            ? { ...o, isBroken: false, durability: 100 }
            : o,
        );
        const remainingMesses = state.messes.filter((m) => m.kind !== 'puddle');
        const post = createSocialPost({
          id: nextId('post'),
          authorName: state.sim.name,
          authorColor: state.sim.appearance.topColor,
          text: `Sunnyside Repair Tech came through and fixed ${brokenCount === 1 ? 'my broken appliance' : `all ${brokenCount} broken appliances`} in record time!`,
          clock: state.clock,
          tag: 'lifestyle',
        });

        set({
          funds: state.funds - REPAIR_TECH_COST,
          placedObjects: repairedObjects,
          messes: remainingMesses,
          socialFeed: [post, ...state.socialFeed].slice(0, 18),
          pieMenu: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Repair Tech fixed ${brokenCount} item${brokenCount > 1 ? 's' : ''} (-§${REPAIR_TECH_COST})`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      hireCleaningMaid: () => {
        const state = get();
        const dirtyCount = state.placedObjects.filter(
          (o) => !o.houseId && (o.cleanliness ?? 100) < 95,
        ).length;
        if (dirtyCount === 0 && state.messes.length === 0) {
          state.addFeedback('Your home is already spotless!', 'info');
          return false;
        }
        if (state.funds < MAID_SERVICE_COST) {
          state.addFeedback(`Need §${MAID_SERVICE_COST} for Cleaning Maid`, 'negative');
          return false;
        }

        const cleanedObjects = state.placedObjects.map((o) =>
          !o.houseId ? { ...o, cleanliness: 100 } : o,
        );

        set({
          funds: state.funds - MAID_SERVICE_COST,
          placedObjects: cleanedObjects,
          messes: [],
          pieMenu: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Cleaning Maid made the house sparkle! (-§${MAID_SERVICE_COST})`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      buyUpgradeParts: () => {
        const state = get();
        if (state.funds < UPGRADE_PARTS_PACK_COST) {
          state.addFeedback(`Need §${UPGRADE_PARTS_PACK_COST} for Upgrade Parts`, 'negative');
          return false;
        }
        set({
          funds: state.funds - UPGRADE_PARTS_PACK_COST,
          handiness: {
            ...state.handiness,
            upgradeParts: state.handiness.upgradeParts + UPGRADE_PARTS_PACK_QTY,
          },
          pieMenu: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `+${UPGRADE_PARTS_PACK_QTY} Upgrade Parts delivered! (-§${UPGRADE_PARTS_PACK_COST})`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      joinCareer: (careerId) => {
        const state = get();
        const careerDef = CAREERS_BY_ID[careerId];
        if (!careerDef) return;

        // If switching while away at work, bring Maya home cleanly first
        const wasAway = state.sim.awayAtWork;
        if (wasAway) {
          syncRuntimeToTile(RETURN_HOME_TILE.x, RETURN_HOME_TILE.z, 0);
        }

        const nextCareer = createInitialCareerState(careerId, state.clock.day);
        const levelDef = getCareerLevel(careerId, 1);

        // If hired right inside or within 60 mins of today's shift, surface the Shift Prompt immediately
        let nextPrompt: ShiftPromptState | null = null;
        if (isWorkday(levelDef, state.clock.day)) {
          const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(
            levelDef,
            state.clock.day,
          );
          if (
            state.clock.totalMinutes >= startTotalMinutes - 60 &&
            state.clock.totalMinutes < endTotalMinutes - 30
          ) {
            nextPrompt = {
              day: state.clock.day,
              careerId,
              level: 1,
              shiftStartHour: levelDef.shiftStartHour,
              shiftDurationHours: levelDef.shiftDurationHours,
            };
            nextCareer.promptShownForDay = state.clock.day;
          }
        }

        const post = createSocialPost({
          id: nextId('post'),
          authorName: state.sim.name,
          authorColor: state.sim.appearance.topColor,
          text: `Big news! Just started as a ${levelDef.title} in the ${careerDef.name} career!`,
          clock: state.clock,
          tag: 'career',
        });

        set({
          career: nextCareer,
          activeShift: null,
          activeChanceCard: null,
          shiftPrompt: nextPrompt,
          socialFeed: [post, ...state.socialFeed].slice(0, 18),
          sim: wasAway
            ? {
                ...state.sim,
                awayAtWork: false,
                tileX: RETURN_HOME_TILE.x,
                tileZ: RETURN_HOME_TILE.z,
                pose: 'idle',
                activeObjectId: null,
                activeProp: null,
              }
            : state.sim,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Hired as ${levelDef.title} (§${levelDef.hourlyPay}/hr)!`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
      },

      quitCareer: () => {
        const state = get();
        if (!state.career) return;
        const careerDef = CAREERS_BY_ID[state.career.careerId];
        const wasAway = state.sim.awayAtWork;
        if (wasAway) {
          syncRuntimeToTile(RETURN_HOME_TILE.x, RETURN_HOME_TILE.z, 0);
        }

        set({
          career: null,
          activeShift: null,
          shiftPrompt: null,
          activeChanceCard: null,
          promotionSummary: null,
          actionQueue: state.actionQueue.filter((a) => a.kind !== 'commute'),
          sim: wasAway
            ? {
                ...state.sim,
                awayAtWork: false,
                tileX: RETURN_HOME_TILE.x,
                tileZ: RETURN_HOME_TILE.z,
                pose: 'idle',
                activeObjectId: null,
                activeProp: null,
              }
            : state.sim,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Left ${careerDef.name} career`,
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
      },

      chooseShiftMode: (choice) => {
        const state = get();
        if (!state.career) return false;
        const careerDef = CAREERS_BY_ID[state.career.careerId];
        const levelDef = getCareerLevel(state.career.careerId, state.career.level);
        const day = state.clock.day;

        if (choice === 'pto') {
          if (Math.floor(state.career.ptoDays) < 1) {
            state.addFeedback('No PTO days earned yet', 'negative');
            return false;
          }
          const ptoPay = levelDef.hourlyPay * levelDef.shiftDurationHours;
          set({
            funds: state.funds + ptoPay,
            shiftPrompt: null,
            career: {
              ...state.career,
              ptoDays: Math.max(0, state.career.ptoDays - 1),
              totalEarned: state.career.totalEarned + ptoPay,
              activeDayMarker: day,
              shiftChoiceForDay: 'pto',
              wfhActive: false,
              wfhTasks: [],
            },
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Paid Vacation Day! +§${ptoPay}`,
                tone: 'positive',
                createdAt: Date.now(),
              },
            ],
          });
          return true;
        }

        if (choice === 'wfh') {
          const wfhTasks = generateWfhTasksForDay(careerDef);
          set({
            shiftPrompt: null,
            phoneOpen: false,
            career: {
              ...state.career,
              activeDayMarker: day,
              shiftChoiceForDay: 'wfh',
              wfhActive: true,
              wfhTasks,
              wfhPaidToday: false,
            },
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Working From Home (${wfhTasks.length} tasks ready)`,
                tone: 'positive',
                createdAt: Date.now(),
              },
            ],
          });
          return true;
        }

        // choice === 'rabbit_hole'
        const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(levelDef, day);
        const inShiftWindow =
          isWorkday(levelDef, day) &&
          state.clock.totalMinutes >= startTotalMinutes - 15 &&
          state.clock.totalMinutes < endTotalMinutes - 30;

        if (!inShiftWindow) {
          set({
            shiftPrompt: null,
            career: {
              ...state.career,
              activeDayMarker: day,
              shiftChoiceForDay: 'rabbit_hole',
              wfhActive: false,
            },
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Heading to work at ${formatHour12(levelDef.shiftStartHour)}`,
                tone: 'info',
                createdAt: Date.now(),
              },
            ],
          });
          return true;
        }

        return get().goToWorkNow();
      },

      dismissShiftPrompt: () => set({ shiftPrompt: null }),

      goToWorkNow: () => {
        const state = get();
        if (!state.career || state.sim.awayAtWork || state.activeShift) return false;
        const careerDef = CAREERS_BY_ID[state.career.careerId];
        const levelDef = getCareerLevel(state.career.careerId, state.career.level);
        const day = state.clock.day;

        if (!isWorkday(levelDef, day)) {
          state.addFeedback('Today is a scheduled day off!', 'info');
          return false;
        }
        const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(levelDef, day);
        if (state.clock.totalMinutes < startTotalMinutes - 60) {
          state.addFeedback(
            `Shift starts at ${formatHour12(levelDef.shiftStartHour)}`,
            'info',
          );
          return false;
        }
        if (state.clock.totalMinutes >= endTotalMinutes - 20) {
          state.addFeedback('Today’s shift has already ended', 'info');
          return false;
        }

        const commute = buildCommuteAction(
          state.sim,
          state.placedObjects,
          state.walls,
          careerDef.name,
          state.unlockedHouseIds,
        );

        if (commute) {
          set({
            shiftPrompt: null,
            phoneOpen: false,
            pieMenu: null,
            actionQueue: [commute],
            career: {
              ...state.career,
              activeDayMarker: day,
              shiftChoiceForDay: 'rabbit_hole',
              wfhActive: false,
            },
            sim: { ...state.sim, pose: 'walk', activeObjectId: null, activeProp: null },
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Heading to ${careerDef.name} shift!`,
                tone: 'info',
                createdAt: Date.now(),
              },
            ],
          });
          return true;
        }

        // Fallback if street path is blocked: transition directly into shift so player is never soft-locked
        const shiftEnd = Math.max(
          endTotalMinutes,
          state.clock.totalMinutes + 60,
        );
        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const nextNpcs = state.npcs.some((n) => n.knockingAtMayaDoor)
          ? state.npcs.map((n) =>
              n.knockingAtMayaDoor ? sendNpcBackHomeState(n, allObjects, allWalls) : n,
            )
          : state.npcs;
        set({
          shiftPrompt: null,
          doorbellPrompt: null,
          npcs: nextNpcs,
          phoneOpen: false,
          pieMenu: null,
          actionQueue: [],
          career: {
            ...state.career,
            activeDayMarker: day,
            shiftChoiceForDay: 'rabbit_hole',
            wfhActive: false,
          },
          sim: {
            ...state.sim,
            awayAtWork: true,
            pose: 'idle',
            activeObjectId: null,
            activeProp: null,
          },
          activeShift: {
            careerId: state.career.careerId,
            level: state.career.level,
            day,
            startTotalMinutes: state.clock.totalMinutes,
            endTotalMinutes: shiftEnd,
            tone: 'normal',
            chanceCardTriggered: false,
            performanceGained: 0,
            workedMinutes: 0,
          },
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Started ${careerDef.name} shift!`,
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      callInSick: () => {
        const state = get();
        if (!state.career || state.sim.awayAtWork) return false;
        const day = state.clock.day;
        set({
          shiftPrompt: null,
          career: {
            ...state.career,
            activeDayMarker: day,
            shiftChoiceForDay: 'sick',
            wfhActive: false,
            wfhTasks: [],
            performance: Math.max(0, state.career.performance - 4),
          },
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: 'Called in sick — get some rest!',
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      setWorkTone: (tone) =>
        set((state) => {
          if (!state.activeShift) return state;
          return {
            activeShift: {
              ...state.activeShift,
              tone,
            },
          };
        }),

      leaveWorkEarly: () => {
        const state = get();
        if (!state.activeShift || !state.career) return;
        const levelDef = getCareerLevel(state.career.careerId, state.career.level);
        const partialPay = computeShiftPay(levelDef, state.activeShift.workedMinutes);
        syncRuntimeToTile(COMMUTE_STREET_TILE.x, COMMUTE_STREET_TILE.z, Math.PI);
        const returnQueue = buildReturnHomeAction(state.placedObjects, state.walls);

        set({
          funds: state.funds + partialPay,
          activeShift: null,
          activeChanceCard: null,
          actionQueue: returnQueue,
          career: {
            ...state.career,
            shiftChoiceForDay: 'completed',
            performance: Math.max(0, state.career.performance - 8),
            totalEarned: state.career.totalEarned + partialPay,
          },
          sim: {
            ...state.sim,
            awayAtWork: false,
            tileX: COMMUTE_STREET_TILE.x,
            tileZ: COMMUTE_STREET_TILE.z,
            pose: 'idle',
            activeObjectId: null,
            activeProp: null,
          },
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text:
                partialPay > 0
                  ? `Left work early (+§${partialPay})`
                  : 'Left work early',
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
      },

      resolveChanceCard: (optionIndex) => {
        const state = get();
        if (!state.activeChanceCard || state.activeChanceCard.resolvedOptionIndex !== undefined) {
          return;
        }
        const opt = state.activeChanceCard.card.options[optionIndex];
        let nextFunds = state.funds + (opt.fundsDelta ?? 0);
        if (nextFunds < 0) nextFunds = 0;

        let nextCareer = state.career;
        if (nextCareer) {
          nextCareer = {
            ...nextCareer,
            performance: Math.max(0, Math.min(100, nextCareer.performance + opt.performanceDelta)),
            totalEarned: nextCareer.totalEarned + Math.max(0, opt.fundsDelta ?? 0),
          };
        }

        let nextContacts = state.contacts;
        if (opt.relationshipBoost && nextContacts.length > 0) {
          // Boost top coworker/friend contact
          const boostIdx = state.clock.day % nextContacts.length;
          nextContacts = nextContacts.map((c, idx) =>
            idx === boostIdx
              ? {
                  ...c,
                  relationship: clampRelationship(c.relationship + opt.relationshipBoost!),
                  lastInteractedDay: state.clock.day,
                }
              : c,
          );
        }

        const nextBoost = opt.emotionBoost
          ? { type: opt.emotionBoost, expiresAtSimMinute: state.clock.totalMinutes + 240 }
          : state.sim.emotionBoost;

        set({
          funds: nextFunds,
          career: nextCareer,
          contacts: nextContacts,
          activeChanceCard: {
            ...state.activeChanceCard,
            resolvedOptionIndex: optionIndex,
          },
          sim: {
            ...state.sim,
            emotionBoost: nextBoost,
            emotion: computeEmotion(state.sim.needs, nextBoost, state.clock.totalMinutes),
          },
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: opt.fundsDelta
                ? `Work Dilemma: +§${opt.fundsDelta} & +${opt.performanceDelta}% Perf`
                : `Work Dilemma: +${opt.performanceDelta}% Performance`,
              tone: opt.performanceDelta >= 0 ? 'positive' : 'negative',
              createdAt: Date.now(),
            },
          ],
        });
      },

      dismissChanceCard: () =>
        set((state) => ({
          activeChanceCard: null,
          speed: state.lastLiveSpeed || 1,
        })),

      dismissPromotionSummary: () =>
        set((state) => ({
          promotionSummary: null,
          speed: state.lastLiveSpeed || 1,
        })),

      openWardrobe: () =>
        set((state) => ({
          wardrobeOpen: true,
          phoneOpen: false,
          pieMenu: null,
          lastLiveSpeed: state.speed === 0 ? state.lastLiveSpeed : state.speed,
          speed: 0,
          sim: {
            ...state.sim,
            pose: 'idle',
            activeObjectId: null,
            activeProp: null,
          },
        })),

      closeWardrobe: (showSavedToast = true) =>
        set((state) => ({
          wardrobeOpen: false,
          speed: state.lastLiveSpeed || 1,
          feedbacks: showSavedToast
            ? [
                ...state.feedbacks.slice(-3),
                {
                  id: nextId('fb'),
                  text: 'Style Updated!',
                  tone: 'positive',
                  createdAt: Date.now(),
                },
              ]
            : state.feedbacks,
        })),

      updateSimAppearance: (patch) =>
        set((state) => ({
          sim: {
            ...state.sim,
            appearance: {
              ...state.sim.appearance,
              ...patch,
            },
          },
        })),

      setSpeed: (speed) =>
        set((state) => ({
          speed,
          lastLiveSpeed: speed === 0 ? state.lastLiveSpeed : speed,
        })),

      toggleFreeWill: () =>
        set((state) => {
          const next = !state.freeWill;
          return {
            freeWill: next,
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: next ? 'Free Will Enabled' : 'Free Will Paused',
                tone: 'info',
                createdAt: Date.now(),
              },
            ],
          };
        }),

      openPieMenu: (target) => set({ pieMenu: target, phoneOpen: false }),
      closePieMenu: () => set({ pieMenu: null }),

      addFeedback: (text, tone = 'info') =>
        set((state) => ({
          feedbacks: [
            ...state.feedbacks.slice(-3),
            { id: nextId('fb'), text, tone, createdAt: Date.now() },
          ],
        })),

      pruneFeedbacks: () =>
        set((state) => {
          const now = Date.now();
          const filtered = state.feedbacks.filter((f) => now - f.createdAt < 2600);
          return filtered.length === state.feedbacks.length ? state : { feedbacks: filtered };
        }),

      focusCameraOnSim: () => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is currently at work', 'info');
          return;
        }
        simRuntime.focusSimRequested = true;
      },

      enqueueWalk: (tile) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (!isInWorldBounds(tile.x, tile.z)) return false;
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        // If user taps inside a locked neighbor house, offer to knock on their door instead!
        const houseAtTile = getNeighborHouseContainingTile(tile);
        if (houseAtTile && !state.unlockedHouseIds.includes(houseAtTile.id)) {
          return state.enqueueKnockOnHouse(houseAtTile.id);
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const path = findPath(
          startTile,
          tile,
          getAllWorldObjects(state.placedObjects),
          getAllWorldWalls(state.walls),
          getLockedDoorWallIdsForMaya(state.unlockedHouseIds),
        );
        if (path === null) {
          state.addFeedback('Cannot reach that spot', 'negative');
          return false;
        }

        const worldTarget = tileToWorld(tile.x, tile.z);
        simRuntime.walkRipple = {
          x: worldTarget.x,
          z: worldTarget.z,
          startedAt: performance.now(),
        };

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'walk',
          label: 'Walk Here',
          icon: 'footprints',
          targetTile: tile,
          durationSimMinutes: 0,
          elapsedSimMinutes: 0,
          cost: 0,
          costPaid: true,
          needDeltas: {},
          animationPose: 'walk',
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueObjectInteraction: (objectId, interactionId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const allObjects = getAllWorldObjects(state.placedObjects);
        const allWalls = getAllWorldWalls(state.walls);
        const obj = allObjects.find((o) => o.instanceId === objectId);
        if (!obj) return false;
        const item = CATALOG_BY_ID[obj.catalogId];
        if (!item) return false;
        const interaction = item.interactions.find((i) => i.id === interactionId);
        if (!interaction) return false;

        // Neighbor-house guest etiquette checks
        if (obj.houseId) {
          if (!state.unlockedHouseIds.includes(obj.houseId)) {
            return state.enqueueKnockOnHouse(obj.houseId);
          }
          if (interaction.opensWardrobe) {
            state.addFeedback('Use your own dresser or mirror at home to style Maya', 'info');
            return false;
          }
          if (item.proceduralType === 'bed') {
            const house = NEIGHBOR_HOUSES_BY_ID[obj.houseId];
            const hasGoodFriend = house.residentIds.some((resId) => {
              const contact = state.contacts.find((c) => c.id === resId);
              return (contact?.relationship ?? 0) >= 65;
            });
            if (!hasGoodFriend) {
              state.addFeedback('Polite Guest: Become Good Friends (65+) to nap here!', 'info');
              return false;
            }
          }
        } else {
          // Home lot maintenance & utility shutoff checks
          if (obj.isBroken) {
            state.addFeedback(`${item.name} is broken! Repair it or call a Repair Tech.`, 'negative');
            return false;
          }
          const utilCheck = isObjectBlockedByUtility(obj, state.bills);
          if (utilCheck.blocked) {
            state.addFeedback(utilCheck.reason ?? 'Utility shut off — Pay Bills!', 'negative');
            return false;
          }
        }

        const cost = interaction.cost ?? 0;
        if (cost > state.funds) {
          state.addFeedback(`Need §${cost} Simoleons`, 'negative');
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
        const slot = getBestInteractionSlot(obj, item, allObjects, allWalls, startTile, lockedDoors);
        if (!slot) {
          state.addFeedback(`${item.name} is blocked!`, 'negative');
          return false;
        }

        const path = findPath(startTile, slot.tile, allObjects, allWalls, lockedDoors);
        if (path === null) {
          state.addFeedback(`Cannot reach ${item.name}`, 'negative');
          return false;
        }

        const boosted = !obj.houseId
          ? applyPerformanceUpgradeBonus(
              interaction.durationSimMinutes,
              interaction.needDeltas,
              obj,
              state.handiness.level,
            )
          : { durationSimMinutes: interaction.durationSimMinutes, needDeltas: interaction.needDeltas };

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'object',
          label: interaction.label,
          icon: interaction.icon,
          targetObjectId: objectId,
          interactionId,
          targetTile: slot.tile,
          facingAngle: slot.facingAngle,
          durationSimMinutes: boosted.durationSimMinutes,
          elapsedSimMinutes: 0,
          cost,
          costPaid: false,
          needDeltas: boosted.needDeltas,
          animationPose: interaction.animationPose,
          emotionBoost: interaction.emotionBoost,
          opensWardrobe: interaction.opensWardrobe,
          heldProp: interaction.heldProp,
          phase: 'routing',
          path: state.actionQueue.length === 0 ? path : [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          phoneOpen: false,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueSelfInteraction: (interactionId) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const interaction = SELF_INTERACTIONS.find((i) => i.id === interactionId);
        if (!interaction) return false;

        const cost = interaction.cost ?? 0;
        if (cost > state.funds) {
          state.addFeedback(`Need §${cost} Simoleons`, 'negative');
          return false;
        }

        const plannedTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'self',
          label: interaction.label,
          icon: interaction.icon,
          interactionId,
          targetTile: plannedTile,
          durationSimMinutes: interaction.durationSimMinutes,
          elapsedSimMinutes: 0,
          cost,
          costPaid: false,
          needDeltas: interaction.needDeltas,
          animationPose: interaction.animationPose,
          emotionBoost: interaction.emotionBoost,
          heldProp: interaction.heldProp,
          phase: 'routing',
          path: [],
          pathIndex: 0,
        };

        set({
          actionQueue: [...state.actionQueue, action],
          pieMenu: null,
          idleSimMinutes: 0,
        });
        return true;
      },

      enqueueBestForNeed: (needKey) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        const choice = pickAutonomousAction(
          state.sim,
          state.placedObjects,
          state.walls,
          state.funds,
          needKey,
          {
            allObjects: getAllWorldObjects(state.placedObjects),
            allWalls: getAllWorldWalls(state.walls),
            lockedDoorWallIds: getLockedDoorWallIdsForMaya(state.unlockedHouseIds),
            bills: state.bills,
          },
        );
        if (!choice) {
          state.addFeedback(`No available way to restore ${needKey}`, 'negative');
          return false;
        }
        if (choice.kind === 'object' && choice.objectId) {
          return state.enqueueObjectInteraction(choice.objectId, choice.interactionId);
        }
        return state.enqueueSelfInteraction(choice.interactionId);
      },

      cancelAction: (actionId) => {
        set((state) => {
          const cancelled = state.actionQueue.find((a) => a.id === actionId);
          const isFront = state.actionQueue[0]?.id === actionId;
          const remaining = state.actionQueue.filter((a) => a.id !== actionId);
          const nextQueue = isFront
            ? preparePathForFrontAction(
                remaining,
                state.sim,
                state.placedObjects,
                state.walls,
                state.unlockedHouseIds,
                state.npcs,
              )
            : remaining;
          const isCommuteCancel = cancelled?.kind === 'commute';
          const releasedNpcId =
            isFront && cancelled?.kind === 'social_npc' ? cancelled.targetNpcId : null;
          return {
            actionQueue: nextQueue,
            npcs: releasedNpcId
              ? state.npcs.map((n) =>
                  n.contactId === releasedNpcId
                    ? { ...n, talkingWithMaya: false, pose: 'idle', speechBubble: null }
                    : n,
                )
              : state.npcs,
            career:
              isCommuteCancel && state.career
                ? {
                    ...state.career,
                    activeDayMarker: state.clock.day,
                    shiftChoiceForDay: 'skipped',
                  }
                : state.career,
            feedbacks: isCommuteCancel
              ? [
                  ...state.feedbacks.slice(-3),
                  {
                    id: nextId('fb'),
                    text: 'Commute cancelled — open Career Hub to go in anytime',
                    tone: 'info',
                    createdAt: Date.now(),
                  },
                ]
              : state.feedbacks,
            sim: isFront
              ? {
                  ...state.sim,
                  pose: 'idle',
                  activeObjectId: null,
                  activeProp: null,
                  speechBubble: null,
                }
              : state.sim,
          };
        });
      },

      updateSimTile: (tile, facingAngle, nextPathIndex) => {
        set((state) => {
          const queue = state.actionQueue;
          if (queue.length === 0) return state;
          const [front, ...rest] = queue;
          return {
            sim: {
              ...state.sim,
              tileX: tile.x,
              tileZ: tile.z,
              facingAngle,
              pose: 'walk',
              activeObjectId: null,
              activeProp: null,
            },
            actionQueue: [{ ...front, pathIndex: nextPathIndex }, ...rest],
          };
        });
      },

      beginPerformingActiveAction: () => {
        set((state) => {
          const queue = state.actionQueue;
          if (queue.length === 0) return state;
          const [front, ...rest] = queue;

          // Commute arrival transitions Maya off-lot into her Rabbit-Hole work shift
          if (front.kind === 'commute') {
            if (!state.career) {
              return {
                actionQueue: [],
                sim: { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null },
              };
            }
            const levelDef = getCareerLevel(state.career.careerId, state.career.level);
            const { endTotalMinutes } = getShiftWindowForDay(levelDef, state.clock.day);
            const shiftEnd = Math.max(endTotalMinutes, state.clock.totalMinutes + 60);
            const allObjects = getAllWorldObjects(state.placedObjects);
            const allWalls = getAllWorldWalls(state.walls);
            const nextNpcs = state.npcs.some((n) => n.knockingAtMayaDoor)
              ? state.npcs.map((n) =>
                  n.knockingAtMayaDoor ? sendNpcBackHomeState(n, allObjects, allWalls) : n,
                )
              : state.npcs;

            return {
              actionQueue: [],
              shiftPrompt: null,
              doorbellPrompt: null,
              npcs: nextNpcs,
              pieMenu: null,
              sim: {
                ...state.sim,
                awayAtWork: true,
                pose: 'idle',
                activeObjectId: null,
                activeProp: null,
                speechBubble: null,
              },
              activeShift: {
                careerId: state.career.careerId,
                level: state.career.level,
                day: state.clock.day,
                startTotalMinutes: state.clock.totalMinutes,
                endTotalMinutes: shiftEnd,
                tone: 'normal',
                chanceCardTriggered: false,
                performanceGained: 0,
                workedMinutes: 0,
              },
            };
          }

          // Walk-only actions complete immediately upon arrival
          if (front.kind === 'walk') {
            const nextQueue = preparePathForFrontAction(
              rest,
              state.sim,
              state.placedObjects,
              state.walls,
              state.unlockedHouseIds,
              state.npcs,
            );
            return {
              actionQueue: nextQueue,
              sim: { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null },
            };
          }

          // Dresser / Mirror wardrobe actions pause Live Mode and open the in-world Wardrobe Studio
          if (front.opensWardrobe) {
            const nextQueue = preparePathForFrontAction(
              rest,
              state.sim,
              state.placedObjects,
              state.walls,
              state.unlockedHouseIds,
              state.npcs,
            );
            const facingAngle = front.facingAngle ?? state.sim.facingAngle;
            simRuntime.facingAngle = facingAngle;

            return {
              wardrobeOpen: true,
              phoneOpen: false,
              pieMenu: null,
              lastLiveSpeed: state.speed === 0 ? state.lastLiveSpeed : state.speed,
              speed: 0,
              actionQueue: nextQueue,
              sim: {
                ...state.sim,
                facingAngle,
                pose: 'idle',
                activeObjectId: null,
                activeProp: null,
              },
            };
          }

          // Deduct interaction cost or upgrade parts if not already paid
          let nextFunds = state.funds;
          let nextHandiness = state.handiness;
          const nextFeedbacks = [...state.feedbacks];
          if (!front.costPaid && (front.cost > 0 || (front.partsCost ?? 0) > 0)) {
            const partsNeeded = front.partsCost ?? 0;
            if (partsNeeded > 0) {
              if (state.handiness.upgradeParts < partsNeeded) {
                nextFeedbacks.push({
                  id: nextId('fb'),
                  text: `Not enough Upgrade Parts (need ${partsNeeded})`,
                  tone: 'negative',
                  createdAt: Date.now(),
                });
                const nextQueue = preparePathForFrontAction(
                  rest,
                  state.sim,
                  state.placedObjects,
                  state.walls,
                  state.unlockedHouseIds,
                  state.npcs,
                );
                return {
                  actionQueue: nextQueue,
                  feedbacks: nextFeedbacks.slice(-4),
                  sim: { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null },
                };
              }
              nextHandiness = {
                ...state.handiness,
                upgradeParts: state.handiness.upgradeParts - partsNeeded,
              };
              nextFeedbacks.push({
                id: nextId('fb'),
                text: `-${partsNeeded} Upgrade Part${partsNeeded > 1 ? 's' : ''}`,
                tone: 'info',
                createdAt: Date.now(),
              });
            } else if (front.cost > 0) {
              if (state.funds < front.cost) {
                nextFeedbacks.push({
                  id: nextId('fb'),
                  text: `Not enough Simoleons (§${front.cost})`,
                  tone: 'negative',
                  createdAt: Date.now(),
                });
                const nextQueue = preparePathForFrontAction(
                  rest,
                  state.sim,
                  state.placedObjects,
                  state.walls,
                  state.unlockedHouseIds,
                  state.npcs,
                );
                return {
                  actionQueue: nextQueue,
                  feedbacks: nextFeedbacks.slice(-4),
                  sim: { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null },
                };
              }
              nextFunds -= front.cost;
              nextFeedbacks.push({
                id: nextId('fb'),
                text: `-§${front.cost}`,
                tone: 'negative',
                createdAt: Date.now(),
              });
            }
          }

          let facingAngle = front.facingAngle ?? state.sim.facingAngle;
          let nextNpcs = state.npcs;
          let simBubble = state.sim.speechBubble ?? null;

          // Knocking on a neighbor's front door sets Maya's knock speech bubble
          if (front.kind === 'knock') {
            simBubble = {
              icon: 'knock',
              expiresAtSimMinute: state.clock.totalMinutes + front.durationSimMinutes + 4,
            };
          } else if (front.kind === 'repair' || front.kind === 'upgrade_object') {
            simBubble = {
              icon: 'wrench',
              expiresAtSimMinute: state.clock.totalMinutes + front.durationSimMinutes + 2,
            };
          }

          // Face-to-face NPC socializing turns Maya & the NPC toward each other with expressive speech bubbles!
          if (front.kind === 'social_npc' && front.targetNpcId) {
            const targetNpc = state.npcs.find((n) => n.contactId === front.targetNpcId);
            if (targetNpc) {
              const tileDist = Math.hypot(
                targetNpc.tileX - state.sim.tileX,
                targetNpc.tileZ - state.sim.tileZ,
              );
              // If the strolling NPC moved far away while Maya walked over, pause them and walk right up!
              if (tileDist > 2.6) {
                const allObjects = getAllWorldObjects(state.placedObjects);
                const allWalls = getAllWorldWalls(state.walls);
                const lockedDoors = getLockedDoorWallIdsForMaya(state.unlockedHouseIds);
                const stand = findAdjacentStandTile(
                  { x: targetNpc.tileX, z: targetNpc.tileZ },
                  { x: state.sim.tileX, z: state.sim.tileZ },
                  allObjects,
                  allWalls,
                  lockedDoors,
                );
                const catchUpPath = stand
                  ? findPath(
                      { x: state.sim.tileX, z: state.sim.tileZ },
                      stand.tile,
                      allObjects,
                      allWalls,
                      lockedDoors,
                    )
                  : null;
                if (stand && catchUpPath && catchUpPath.length > 0) {
                  return {
                    npcs: state.npcs.map((n) =>
                      n.contactId === targetNpc.contactId
                        ? {
                            ...n,
                            path: [],
                            pathIndex: 0,
                            pose: 'idle' as const,
                            pendingGoal: 'idle' as const,
                            busyUntilSimMinute: state.clock.totalMinutes + 18,
                          }
                        : n,
                    ),
                    actionQueue: [
                      {
                        ...front,
                        targetTile: stand.tile,
                        facingAngle: stand.facingAngle,
                        phase: 'routing',
                        path: catchUpPath,
                        pathIndex: 0,
                      },
                      ...rest,
                    ],
                  };
                }
              }

              const mayaWorld = tileToWorld(state.sim.tileX, state.sim.tileZ);
              const npcWorld = tileToWorld(targetNpc.tileX, targetNpc.tileZ);
              facingAngle = Math.atan2(npcWorld.x - mayaWorld.x, npcWorld.z - mayaWorld.z);
              const npcFacingMaya = Math.atan2(mayaWorld.x - npcWorld.x, mayaWorld.z - npcWorld.z);
              syncNpcRuntimeToTile(
                targetNpc.contactId,
                targetNpc.tileX,
                targetNpc.tileZ,
                npcFacingMaya,
              );
              const bubbleIcon = front.bubbleIcon ?? 'chat';
              const bubbleExpiry = state.clock.totalMinutes + front.durationSimMinutes + 2;
              simBubble = { icon: bubbleIcon, expiresAtSimMinute: bubbleExpiry };
              nextNpcs = state.npcs.map((n) =>
                n.contactId === targetNpc.contactId
                  ? {
                      ...n,
                      facingAngle: npcFacingMaya,
                      pose: 'talk',
                      activeObjectId: null,
                      activeProp: null,
                      path: [],
                      pathIndex: 0,
                      talkingWithMaya: true,
                      busyUntilSimMinute: bubbleExpiry,
                      speechBubble: { icon: bubbleIcon, expiresAtSimMinute: bubbleExpiry },
                    }
                  : n,
              );
            }
          }

          simRuntime.facingAngle = facingAngle;

          return {
            funds: nextFunds,
            handiness: nextHandiness,
            npcs: nextNpcs,
            feedbacks: nextFeedbacks.slice(-4),
            sim: {
              ...state.sim,
              facingAngle,
              pose: front.animationPose,
              activeObjectId: front.targetObjectId ?? null,
              activeProp: front.heldProp ?? null,
              speechBubble: simBubble,
            },
            actionQueue: [
              {
                ...front,
                phase: 'performing',
                costPaid: true,
              },
              ...rest,
            ],
          };
        });
      },

      tickSimMinutes: (simMinutesDelta) => {
        if (simMinutesDelta <= 0) return;

        set((state) => {
          const newTotal = state.clock.totalMinutes + simMinutesDelta;
          const totalWhole = Math.floor(newTotal);
          const day = Math.floor(totalWhole / (24 * 60)) + 1;
          const minuteOfDay = totalWhole % (24 * 60);
          const hour = Math.floor(minuteOfDay / 60);
          const minute = minuteOfDay % 60;
          const nextClock: GameClock = { day, hour, minute, totalMinutes: newTotal };

          let nextNeeds =
            state.sim.awayAtWork && state.activeShift
              ? applyWorkShiftNeedTick(state.sim.needs, simMinutesDelta, state.activeShift.tone)
              : decayNeeds(state.sim.needs, simMinutesDelta, state.sim.pose);
          let nextQueue = state.actionQueue;
          let nextSim = state.sim;
          let nextIdle = state.idleSimMinutes;
          let nextFunds = state.funds;
          let nextContacts = state.contacts;
          let nextSocialFeed = state.socialFeed;
          let nextUnlockedHouseIds = state.unlockedHouseIds;
          let nextNpcs = state.npcs;
          let nextDoorbellPrompt = state.doorbellPrompt;
          let nextPlacedObjects = state.placedObjects;
          let nextBills = state.bills;
          let nextHandiness = state.handiness;
          let nextMesses = state.messes;
          let nextCareer = state.career;
          let nextShiftPrompt = state.shiftPrompt;
          let nextActiveShift = state.activeShift;
          let nextChanceCard = state.activeChanceCard;
          let nextPromotionSummary = state.promotionSummary;
          let nextPhoneHasBadge = state.phoneHasBadge;
          let nextSpeed = state.speed;
          let nextLastLiveSpeed = state.lastLiveSpeed;
          const nextFeedbacks = [...state.feedbacks];

          const pushFeedback = (text: string, tone: FloatingFeedback['tone'] = 'info') => {
            nextFeedbacks.push({
              id: nextId('fb'),
              text,
              tone,
              createdAt: Date.now(),
            });
          };

          const tryApplyPromotion = (careerSnapshot: SimCareerState): SimCareerState => {
            const curLevelDef = getCareerLevel(careerSnapshot.careerId, careerSnapshot.level);
            const nextLevelDef = getNextCareerLevel(careerSnapshot.careerId, careerSnapshot.level);

            // Max-rank (Level 5) excellence bonus when performance & daily task are maxed
            if (
              !nextLevelDef &&
              careerSnapshot.performance >= 100 &&
              careerSnapshot.dailyTaskProgress >= curLevelDef.dailyTask.targetCount
            ) {
              const excellenceBonus = 150;
              nextFunds += excellenceBonus;
              pushFeedback(`Top-Rank Excellence Bonus! +§${excellenceBonus}`, 'positive');
              return {
                ...careerSnapshot,
                performance: 65,
                dailyTaskProgress: 0,
                totalEarned: careerSnapshot.totalEarned + excellenceBonus,
              };
            }

            if (!canPromote(careerSnapshot, curLevelDef) || !nextLevelDef) return careerSnapshot;

            const careerDef = CAREERS_BY_ID[careerSnapshot.careerId];
            const bonus = curLevelDef.promotionBonus;
            nextFunds += bonus;

            const promotedCareer: SimCareerState = {
              ...careerSnapshot,
              level: nextLevelDef.level,
              performance: 15,
              dailyTaskProgress: 0,
              totalEarned: careerSnapshot.totalEarned + bonus,
            };

            nextPromotionSummary = {
              careerName: careerDef.name,
              oldTitle: curLevelDef.title,
              newTitle: nextLevelDef.title,
              newLevel: nextLevelDef.level,
              oldHourlyPay: curLevelDef.hourlyPay,
              newHourlyPay: nextLevelDef.hourlyPay,
              bonus,
              dailyTaskLabel: nextLevelDef.dailyTask.label,
            };
            nextLastLiveSpeed = nextSpeed === 0 ? nextLastLiveSpeed : nextSpeed;
            nextSpeed = 0;

            const promoPost = createSocialPost({
              id: nextId('post'),
              authorName: nextSim.name,
              authorColor: nextSim.appearance.topColor,
              text: `Promoted to ${nextLevelDef.title} (§${nextLevelDef.hourlyPay}/hr) in ${careerDef.name}! Celebration time!`,
              clock: nextClock,
              tag: 'career',
              likes: 18 + nextLevelDef.level * 4,
            });
            nextSocialFeed = [promoPost, ...nextSocialFeed].slice(0, 18);
            pushFeedback(`Promoted to ${nextLevelDef.title}! (+§${bonus})`, 'positive');
            return promotedCareer;
          };

          // Midnight rollover (new day): reset daily shift state, re-lock empty neighbor houses & check safety net
          const prevDay = state.clock.day;
          if (day > prevDay) {
            if (!nextCareer && nextFunds < 100) {
              nextFunds += 50;
              pushFeedback('Safety Net Stipend +§50', 'positive');
            }
            if (nextCareer) {
              nextCareer = {
                ...nextCareer,
                activeDayMarker: day,
                shiftChoiceForDay: null,
                wfhActive: false,
                wfhTasks: [],
                wfhPaidToday: false,
              };
            }
            if (nextShiftPrompt && nextShiftPrompt.day < day) {
              nextShiftPrompt = null;
            }
            const mayaCurrentHouse = getNeighborHouseContainingTile({
              x: nextSim.tileX,
              z: nextSim.tileZ,
            });
            nextUnlockedHouseIds = mayaCurrentHouse ? [mayaCurrentHouse.id] : [];

            // Politely send home any late-night visitors at midnight
            const hasLateVisitor = nextNpcs.some(
              (n) => (n.visitingMaya || n.knockingAtMayaDoor) && !n.talkingWithMaya,
            );
            if (hasLateVisitor) {
              const allObjects = getAllWorldObjects(state.placedObjects);
              const allWalls = getAllWorldWalls(state.walls);
              nextNpcs = nextNpcs.map((n) =>
                (n.visitingMaya || n.knockingAtMayaDoor) && !n.talkingWithMaya
                  ? sendNpcBackHomeState(n, allObjects, allWalls, newTotal + 12)
                  : n,
              );
              nextDoorbellPrompt = null;
              pushFeedback('Visitors headed home for the night', 'info');
            }
          }

          // Weekly Monday 8:00 AM Household Bill Issuance (classic Sims 4 cadence)
          if (
            getDayOfWeek(day) === 0 &&
            day > 1 &&
            hour >= 8 &&
            nextBills.lastBilledDay < day
          ) {
            const breakdown = calculateWeeklyBill(nextPlacedObjects);
            const updatedDue = nextBills.amountDue + breakdown.total;
            const powerDeadline = nextBills.dueTotalMinutes ?? newTotal + 48 * 60;
            const waterDeadline = nextBills.waterShutoffTotalMinutes ?? newTotal + 72 * 60;
            nextBills = {
              ...nextBills,
              amountDue: updatedDue,
              issuedOnDay: nextBills.issuedOnDay ?? day,
              dueTotalMinutes: powerDeadline,
              waterShutoffTotalMinutes: waterDeadline,
              lastBilledDay: day,
              lastBillBreakdown: breakdown,
            };
            nextPhoneHasBadge = true;
            pushFeedback(`Weekly Bills Arrived: §${updatedDue} — Pay at Mailbox or Phone`, 'info');
          }

          // Utility Shutoff Escalation (48h -> Power Off, 72h -> Water Off)
          if (nextBills.amountDue > 0) {
            if (
              !nextBills.powerShutoff &&
              nextBills.dueTotalMinutes !== null &&
              newTotal >= nextBills.dueTotalMinutes
            ) {
              nextBills = { ...nextBills, powerShutoff: true };
              nextPhoneHasBadge = true;
              pushFeedback(`Power Shut Off! Pay §${nextBills.amountDue} at Mailbox or Phone`, 'negative');
              if (nextQueue.length > 0 && nextQueue[0].kind === 'object' && nextQueue[0].targetObjectId) {
                const activeObj = nextPlacedObjects.find((o) => o.instanceId === nextQueue[0].targetObjectId);
                if (activeObj && !activeObj.houseId && getMaintenanceSpecForObject(activeObj)?.requiresPower) {
                  nextQueue = nextQueue.slice(1);
                  nextSim = { ...nextSim, pose: 'idle', activeObjectId: null, activeProp: null };
                }
              }
            }
            if (
              !nextBills.waterShutoff &&
              nextBills.waterShutoffTotalMinutes !== null &&
              newTotal >= nextBills.waterShutoffTotalMinutes
            ) {
              nextBills = { ...nextBills, waterShutoff: true };
              nextPhoneHasBadge = true;
              pushFeedback(`Water Shut Off! Pay §${nextBills.amountDue} bills immediately`, 'negative');
              if (nextQueue.length > 0 && nextQueue[0].kind === 'object' && nextQueue[0].targetObjectId) {
                const activeObj = nextPlacedObjects.find((o) => o.instanceId === nextQueue[0].targetObjectId);
                if (activeObj && !activeObj.houseId && getMaintenanceSpecForObject(activeObj)?.requiresWater) {
                  nextQueue = nextQueue.slice(1);
                  nextSim = { ...nextSim, pose: 'idle', activeObjectId: null, activeProp: null };
                }
              }
            }
          }

          // 1. Active Rabbit-Hole Work Shift progression
          if (nextSim.awayAtWork && nextActiveShift && nextCareer) {
            const careerDef = CAREERS_BY_ID[nextCareer.careerId];
            const levelDef = getCareerLevel(nextCareer.careerId, nextCareer.level);
            const shiftDurationMins = Math.max(
              60,
              nextActiveShift.endTotalMinutes - nextActiveShift.startTotalMinutes,
            );
            const dailyTaskComplete =
              nextCareer.dailyTaskProgress >= levelDef.dailyTask.targetCount;
            const perfGain = computeShiftPerformanceDelta(
              simMinutesDelta,
              shiftDurationMins,
              nextActiveShift.tone,
              nextSim.emotion,
              levelDef.idealEmotion,
              dailyTaskComplete,
            );

            const updatedPerf = Math.min(100, nextCareer.performance + perfGain);
            const updatedWorked = nextActiveShift.workedMinutes + simMinutesDelta;

            nextCareer = {
              ...nextCareer,
              performance: updatedPerf,
            };
            nextActiveShift = {
              ...nextActiveShift,
              performanceGained: nextActiveShift.performanceGained + perfGain,
              workedMinutes: updatedWorked,
            };

            // Trigger one mid-shift Chance Card around 45% through shift
            const midpoint =
              nextActiveShift.startTotalMinutes + shiftDurationMins * 0.45;
            if (
              !nextActiveShift.chanceCardTriggered &&
              !nextChanceCard &&
              newTotal >= midpoint &&
              newTotal < nextActiveShift.endTotalMinutes - 15
            ) {
              const card = pickChanceCardForCareer(
                nextCareer.careerId,
                day + nextCareer.shiftsCompleted + nextCareer.level,
              );
              nextActiveShift = {
                ...nextActiveShift,
                chanceCardTriggered: true,
              };
              nextChanceCard = {
                card,
                careerName: careerDef.name,
              };
              nextLastLiveSpeed = nextSpeed === 0 ? nextLastLiveSpeed : nextSpeed;
              nextSpeed = 0;
            }

            // Complete shift when end time reached
            if (newTotal >= nextActiveShift.endTotalMinutes) {
              const pay = computeShiftPay(levelDef, updatedWorked);
              nextFunds += pay;
              pushFeedback(`Shift Complete! Earned +§${pay}`, 'positive');

              nextCareer = {
                ...nextCareer,
                shiftChoiceForDay: 'completed',
                shiftsCompleted: nextCareer.shiftsCompleted + 1,
                totalEarned: nextCareer.totalEarned + pay,
                ptoDays: Math.min(5, Number((nextCareer.ptoDays + 0.34).toFixed(2))),
              };
              nextCareer = tryApplyPromotion(nextCareer);
              nextCareer = { ...nextCareer, dailyTaskProgress: 0 };

              // Return Maya to the front sidewalk and walk her home
              syncRuntimeToTile(COMMUTE_STREET_TILE.x, COMMUTE_STREET_TILE.z, Math.PI);
              nextSim = {
                ...nextSim,
                awayAtWork: false,
                tileX: COMMUTE_STREET_TILE.x,
                tileZ: COMMUTE_STREET_TILE.z,
                pose: 'idle',
                activeObjectId: null,
                activeProp: null,
              };
              nextActiveShift = null;
              nextQueue = buildReturnHomeAction(state.placedObjects, state.walls);
            }
            nextIdle = 0;
          } else {
            // 2. Normal on-lot interaction progress
            if (nextQueue.length > 0 && nextQueue[0].phase === 'performing') {
              const [front, ...rest] = nextQueue;
              const remaining = Math.max(0, front.durationSimMinutes - front.elapsedSimMinutes);
              const appliedDt = Math.min(simMinutesDelta, remaining);
              const fraction =
                front.durationSimMinutes > 0 ? appliedDt / front.durationSimMinutes : 1;

              nextNeeds = applyNeedDeltas(nextNeeds, front.needDeltas, fraction);
              const updatedElapsed = front.elapsedSimMinutes + simMinutesDelta;

              if (updatedElapsed >= front.durationSimMinutes) {
                const boost = front.emotionBoost
                  ? { type: front.emotionBoost, expiresAtSimMinute: newTotal + 180 }
                  : nextSim.emotionBoost;

                // Neighbor Front-Door Knock completion -> Resident greets Maya & invites her inside!
                if (front.kind === 'knock' && front.targetHouseId) {
                  const house = NEIGHBOR_HOUSES_BY_ID[front.targetHouseId];
                  if (house) {
                    const houseResidents = nextContacts.filter((c) =>
                      house.residentIds.includes(c.id),
                    );
                    const greeterContact = houseResidents[0];
                    const isLateNight = hour >= 23 || hour < 6;
                    const hasGoodFriend = houseResidents.some((c) => c.relationship >= 65);

                    if (isLateNight && !hasGoodFriend) {
                      pushFeedback(
                        `It’s late! ${greeterContact?.name.split(' ')[0] ?? 'Neighbors'} asks to visit in the morning.`,
                        'info',
                      );
                    } else {
                      if (!nextUnlockedHouseIds.includes(house.id)) {
                        nextUnlockedHouseIds = [...nextUnlockedHouseIds, house.id];
                      }
                      const greeterName = greeterContact?.name.split(' ')[0] ?? 'Neighbor';
                      pushFeedback(`${greeterName}: "Come on in, Maya!"`, 'positive');

                      // Route the first resident to their greet tile facing Maya with a wave bubble!
                      if (greeterContact) {
                        const greeterNpc = nextNpcs.find((n) => n.contactId === greeterContact.id);
                        if (greeterNpc) {
                          const allObjects = getAllWorldObjects(state.placedObjects);
                          const allWalls = getAllWorldWalls(state.walls);
                          const lockedForNpc = getLockedDoorWallIdsForNpc(greeterNpc);
                          const greetPath =
                            findPath(
                              { x: greeterNpc.tileX, z: greeterNpc.tileZ },
                              house.greetTile,
                              allObjects,
                              allWalls,
                              lockedForNpc,
                            ) ?? [];
                          const greetFacing =
                            house.knockFacingAngle === Math.PI ? 0 : Math.PI;
                          nextNpcs = nextNpcs.map((n) =>
                            n.contactId === greeterContact.id
                              ? {
                                  ...n,
                                  pose: greetPath.length > 0 ? 'walk' : 'idle',
                                  activeObjectId: null,
                                  activeProp: null,
                                  path: greetPath,
                                  pathIndex: 0,
                                  pendingGoal: 'greet_maya',
                                  pendingFacingAngle: greetFacing,
                                  facingAngle: greetPath.length === 0 ? greetFacing : n.facingAngle,
                                  busyUntilSimMinute: newTotal + 22,
                                  speechBubble: {
                                    icon: 'wave',
                                    expiresAtSimMinute: newTotal + 18,
                                  },
                                }
                              : n,
                          );
                        }
                      }
                      nextSim = {
                        ...nextSim,
                        speechBubble: { icon: 'wave', expiresAtSimMinute: newTotal + 14 },
                      };
                    }
                  }
                }

                // Social Contact friendship & romance gain + Social Bunny post
                if (front.contactId && (front.relationshipDelta || front.romanceDelta)) {
                  const targetContact = nextContacts.find((c) => c.id === front.contactId);
                  if (targetContact) {
                    const fDelta = front.relationshipDelta ?? 0;
                    const rDelta = front.romanceDelta ?? 0;
                    const updatedRel = clampRelationship(targetContact.relationship + fDelta);
                    const updatedRom = clampRelationship((targetContact.romance ?? 0) + rDelta);
                    nextContacts = nextContacts.map((c) =>
                      c.id === front.contactId
                        ? {
                            ...c,
                            relationship: updatedRel,
                            romance: updatedRom,
                            lastInteractedDay: day,
                          }
                        : c,
                    );
                    const firstName = targetContact.name.split(' ')[0];
                    if (rDelta > 0) {
                      pushFeedback(`+${rDelta} Romance & +${fDelta} Friendship with ${firstName}!`, 'positive');
                    } else {
                      pushFeedback(`+${fDelta} Friendship with ${firstName}`, 'positive');
                    }
                    if (front.socialPostText) {
                      const post = createSocialPost({
                        id: nextId('post'),
                        authorName: nextSim.name,
                        authorColor: nextSim.appearance.topColor,
                        text: front.socialPostText,
                        clock: nextClock,
                        tag: 'friend',
                      });
                      nextSocialFeed = [post, ...nextSocialFeed].slice(0, 18);
                    }
                  }
                }

                // Release face-to-face NPC partner back to normal state
                if (front.kind === 'social_npc' && front.targetNpcId) {
                  nextNpcs = nextNpcs.map((n) =>
                    n.contactId === front.targetNpcId
                      ? {
                          ...n,
                          talkingWithMaya: false,
                          pose: 'idle',
                          busyUntilSimMinute: newTotal + 14,
                        }
                      : n,
                  );
                }

                // Zoomers Delivery completion toast & post
                if (front.deliveryItemId) {
                  const delItem = DELIVERY_ITEMS.find((d) => d.id === front.deliveryItemId);
                  if (delItem) {
                    pushFeedback(`Zoomers Delivered: ${delItem.name}!`, 'positive');
                    const post = createSocialPost({
                      id: nextId('post'),
                      authorName: nextSim.name,
                      authorColor: nextSim.appearance.topColor,
                      text: delItem.postText,
                      clock: nextClock,
                      tag: 'lifestyle',
                    });
                    nextSocialFeed = [post, ...nextSocialFeed].slice(0, 18);
                  }
                }

                // Home Object Wear, Grime, Breakage & Occasional Floor Messes
                if (front.kind === 'object' && front.targetObjectId) {
                  const usedHomeObj = nextPlacedObjects.find(
                    (o) => o.instanceId === front.targetObjectId && !o.houseId,
                  );
                  if (usedHomeObj) {
                    const { nextObj, justBroke, breakEffect } = applyObjectUseWear(usedHomeObj);
                    nextPlacedObjects = nextPlacedObjects.map((o) =>
                      o.instanceId === usedHomeObj.instanceId ? nextObj : o,
                    );
                    const usedItem = CATALOG_BY_ID[usedHomeObj.catalogId];
                    if (justBroke && usedItem) {
                      pushFeedback(`${usedItem.name} broke! Repair it or call Repair Tech.`, 'negative');
                      if (breakEffect === 'leak' && nextMesses.length < MAX_HOUSEHOLD_MESSES) {
                        const puddleTile = findNearbyMessSpawnTile(
                          usedHomeObj,
                          { x: nextSim.tileX, z: nextSim.tileZ },
                          nextPlacedObjects,
                          state.walls,
                          nextMesses,
                        );
                        if (puddleTile) {
                          nextMesses = [
                            ...nextMesses,
                            {
                              id: nextId('mess'),
                              kind: 'puddle',
                              tileX: puddleTile.x,
                              tileZ: puddleTile.z,
                              createdAtSimMinute: newTotal,
                            },
                          ];
                        }
                      }
                    } else if (
                      front.interactionId &&
                      DISH_SPAWNING_INTERACTION_IDS.has(front.interactionId) &&
                      nextMesses.length < MAX_HOUSEHOLD_MESSES &&
                      Math.floor(newTotal + nextMesses.length) % 3 === 0
                    ) {
                      const dishTile = findNearbyMessSpawnTile(
                        usedHomeObj,
                        { x: nextSim.tileX, z: nextSim.tileZ },
                        nextPlacedObjects,
                        state.walls,
                        nextMesses,
                      );
                      if (dishTile) {
                        nextMesses = [
                          ...nextMesses,
                          {
                            id: nextId('mess'),
                            kind: Math.floor(newTotal) % 2 === 0 ? 'dirty_dish' : 'trash_pile',
                            tileX: dishTile.x,
                            tileZ: dishTile.z,
                            createdAtSimMinute: newTotal,
                          },
                        ];
                      }
                    }
                  }
                }

                // Clean Home Object completion
                if (front.kind === 'clean_object' && front.targetObjectId) {
                  nextPlacedObjects = nextPlacedObjects.map((o) =>
                    o.instanceId === front.targetObjectId ? { ...o, cleanliness: 100 } : o,
                  );
                  const { nextHandiness: updatedH, leveledUp } = awardHandinessXp(nextHandiness, 12);
                  nextHandiness = updatedH;
                  pushFeedback(
                    leveledUp
                      ? `Spotless! Handiness reached Lv ${nextHandiness.level}!`
                      : 'Sparkling clean! (+12 Handiness XP)',
                    'positive',
                  );
                }

                // Repair Home Object completion -> fixes item, builds Handiness, salvages Upgrade Parts
                if (front.kind === 'repair' && front.targetObjectId) {
                  const targetObj = nextPlacedObjects.find((o) => o.instanceId === front.targetObjectId);
                  const targetItem = targetObj ? CATALOG_BY_ID[targetObj.catalogId] : null;
                  nextPlacedObjects = nextPlacedObjects.map((o) =>
                    o.instanceId === front.targetObjectId
                      ? { ...o, isBroken: false, durability: 100 }
                      : o,
                  );
                  const partsGain = nextHandiness.level >= MAX_HANDINESS_LEVEL ? 2 : 1;
                  const { nextHandiness: updatedH, leveledUp } = awardHandinessXp(
                    nextHandiness,
                    35,
                    partsGain,
                  );
                  nextHandiness = updatedH;
                  pushFeedback(
                    leveledUp
                      ? `Fixed ${targetItem?.name ?? 'item'}! Handiness Lv ${nextHandiness.level} (+${partsGain} Parts)`
                      : `Repaired ${targetItem?.name ?? 'item'}! (+${partsGain} Upgrade Part${partsGain > 1 ? 's' : ''})`,
                    'positive',
                  );
                  if (leveledUp) {
                    const skillPost = createSocialPost({
                      id: nextId('post'),
                      authorName: nextSim.name,
                      authorColor: nextSim.appearance.topColor,
                      text: `Leveled up Handiness to Lv ${nextHandiness.level}! Ready to install new home upgrades!`,
                      clock: nextClock,
                      tag: 'lifestyle',
                    });
                    nextSocialFeed = [skillPost, ...nextSocialFeed].slice(0, 18);
                  }
                }

                // Upgrade Home Object completion -> installs permanent upgrade + Handiness XP
                if (front.kind === 'upgrade_object' && front.targetObjectId && front.upgradeId) {
                  const upgradeDef = UPGRADE_BY_ID[front.upgradeId];
                  nextPlacedObjects = nextPlacedObjects.map((o) => {
                    if (o.instanceId !== front.targetObjectId) return o;
                    const existing = o.upgrades ?? [];
                    if (existing.includes(front.upgradeId!)) return o;
                    return {
                      ...o,
                      cleanliness: front.upgradeId === 'self_cleaning' ? 100 : o.cleanliness,
                      durability: front.upgradeId === 'unbreakable' ? 100 : o.durability,
                      upgrades: [...existing, front.upgradeId!],
                    };
                  });
                  const { nextHandiness: updatedH, leveledUp } = awardHandinessXp(nextHandiness, 45);
                  nextHandiness = updatedH;
                  pushFeedback(
                    leveledUp
                      ? `Installed ${upgradeDef?.shortLabel ?? 'Upgrade'}! Handiness Lv ${nextHandiness.level}!`
                      : `Installed ${upgradeDef?.shortLabel ?? 'Upgrade'}!`,
                    'positive',
                  );
                }

                // Clean Floor Mess completion
                if (front.kind === 'clean_mess' && front.targetMessId) {
                  nextMesses = nextMesses.filter((m) => m.id !== front.targetMessId);
                  const { nextHandiness: updatedH } = awardHandinessXp(nextHandiness, 8);
                  nextHandiness = updatedH;
                  pushFeedback('Mess cleaned up!', 'positive');
                }

                // Pay Bills at Mailbox completion
                if (front.kind === 'pay_bills' && nextBills.amountDue > 0) {
                  if (nextFunds >= nextBills.amountDue) {
                    const paid = nextBills.amountDue;
                    const wasShutoff = nextBills.powerShutoff || nextBills.waterShutoff;
                    nextFunds -= paid;
                    nextBills = {
                      ...nextBills,
                      amountDue: 0,
                      issuedOnDay: null,
                      dueTotalMinutes: null,
                      waterShutoffTotalMinutes: null,
                      powerShutoff: false,
                      waterShutoff: false,
                      totalBillsPaid: nextBills.totalBillsPaid + paid,
                    };
                    pushFeedback(
                      wasShutoff
                        ? `Paid §${paid} — Power & Water Restored!`
                        : `Household Bills Paid (-§${paid})`,
                      'positive',
                    );
                  } else {
                    pushFeedback(`Need §${nextBills.amountDue} to pay bills`, 'negative');
                  }
                }

                // Career Daily Prep Task & Work From Home Task matching
                if (nextCareer && front.interactionId) {
                  const levelDef = getCareerLevel(nextCareer.careerId, nextCareer.level);
                  const interactionId = front.interactionId;

                  if (
                    nextCareer.dailyTaskProgress < levelDef.dailyTask.targetCount &&
                    levelDef.dailyTask.matchingInteractionIds.includes(interactionId)
                  ) {
                    const nextProgress = nextCareer.dailyTaskProgress + 1;
                    nextCareer = {
                      ...nextCareer,
                      dailyTaskProgress: nextProgress,
                      performance: Math.min(100, nextCareer.performance + 8),
                    };
                    if (nextProgress >= levelDef.dailyTask.targetCount) {
                      pushFeedback(`Daily Career Task Complete!`, 'positive');
                    } else {
                      pushFeedback(
                        `Daily Task: ${nextProgress}/${levelDef.dailyTask.targetCount}`,
                        'info',
                      );
                    }
                  }

                  if (nextCareer.wfhActive && !nextCareer.wfhPaidToday) {
                    let wfhProgressed = false;
                    const updatedWfhTasks = nextCareer.wfhTasks.map((task) => {
                      if (
                        !wfhProgressed &&
                        task.progress < task.targetCount &&
                        task.matchingInteractionIds.includes(interactionId)
                      ) {
                        wfhProgressed = true;
                        return { ...task, progress: task.progress + 1 };
                      }
                      return task;
                    });

                    if (wfhProgressed) {
                      const allDone = updatedWfhTasks.every((t) => t.progress >= t.targetCount);
                      nextCareer = {
                        ...nextCareer,
                        wfhTasks: updatedWfhTasks,
                      };
                      if (allDone) {
                        const wfhPay = levelDef.hourlyPay * levelDef.shiftDurationHours;
                        nextFunds += wfhPay;
                        nextCareer = {
                          ...nextCareer,
                          wfhPaidToday: true,
                          shiftsCompleted: nextCareer.shiftsCompleted + 1,
                          totalEarned: nextCareer.totalEarned + wfhPay,
                          performance: Math.min(100, nextCareer.performance + 34),
                          ptoDays: Math.min(5, Number((nextCareer.ptoDays + 0.34).toFixed(2))),
                        };
                        pushFeedback(`WFH Complete! Earned +§${wfhPay}`, 'positive');
                        const wfhPost = createSocialPost({
                          id: nextId('post'),
                          authorName: nextSim.name,
                          authorColor: nextSim.appearance.topColor,
                          text: `Crushed my Work From Home tasks today and earned §${wfhPay} from the couch!`,
                          clock: nextClock,
                          tag: 'career',
                        });
                        nextSocialFeed = [wfhPost, ...nextSocialFeed].slice(0, 18);
                        nextCareer = tryApplyPromotion(nextCareer);
                        nextCareer = { ...nextCareer, dailyTaskProgress: 0 };
                      } else {
                        const doneCount = updatedWfhTasks.filter(
                          (t) => t.progress >= t.targetCount,
                        ).length;
                        pushFeedback(
                          `WFH Task Done (${doneCount}/${updatedWfhTasks.length})`,
                          'positive',
                        );
                      }
                    }
                  }
                }

                const preparedNext = preparePathForFrontAction(
                  rest,
                  nextSim,
                  nextPlacedObjects,
                  state.walls,
                  nextUnlockedHouseIds,
                  nextNpcs,
                );
                nextQueue = preparedNext;
                nextSim = {
                  ...nextSim,
                  pose: 'idle',
                  activeObjectId: null,
                  activeProp: null,
                  emotionBoost: boost,
                };
              } else {
                nextQueue = [{ ...front, elapsedSimMinutes: updatedElapsed }, ...rest];
              }
              nextIdle = 0;
            } else if (nextQueue.length === 0) {
              nextIdle += simMinutesDelta;
            } else {
              nextIdle = 0;
            }

            // 3. Schedule Pre-Shift Prompt (60 min prior) & Auto-Commute at Shift Start
            if (nextCareer && !nextActiveShift && !nextSim.awayAtWork) {
              const careerDef = CAREERS_BY_ID[nextCareer.careerId];
              const levelDef = getCareerLevel(nextCareer.careerId, nextCareer.level);
              if (isWorkday(levelDef, day)) {
                const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(levelDef, day);

                // Trigger pre-shift prompt 60 minutes before shift starts
                if (
                  nextCareer.promptShownForDay !== day &&
                  nextCareer.shiftChoiceForDay === null &&
                  newTotal >= startTotalMinutes - 60 &&
                  newTotal < endTotalMinutes - 30
                ) {
                  nextShiftPrompt = {
                    day,
                    careerId: nextCareer.careerId,
                    level: nextCareer.level,
                    shiftStartHour: levelDef.shiftStartHour,
                    shiftDurationHours: levelDef.shiftDurationHours,
                  };
                  nextCareer = {
                    ...nextCareer,
                    promptShownForDay: day,
                  };
                  nextPhoneHasBadge = true;
                  pushFeedback(
                    `${careerDef.name} shift starts at ${formatHour12(levelDef.shiftStartHour)}!`,
                    'info',
                  );
                }

                // Auto-commute once shift starts (with a 20 Sim-min grace window when shiftChoiceForDay is still undecided
                // so newly hired 9:00 AM Sims or players reading the prompt have time to pick WFH or PTO)
                const alreadyCommuting = nextQueue.some((a) => a.kind === 'commute');
                const readyForAutoCommute =
                  nextCareer.shiftChoiceForDay === 'rabbit_hole'
                    ? newTotal >= startTotalMinutes
                    : nextCareer.shiftChoiceForDay === null &&
                      newTotal >= startTotalMinutes + 20;
                if (
                  !alreadyCommuting &&
                  readyForAutoCommute &&
                  newTotal < endTotalMinutes - 30
                ) {
                  const commute = buildCommuteAction(
                    nextSim,
                    state.placedObjects,
                    state.walls,
                    careerDef.name,
                    nextUnlockedHouseIds,
                  );
                  nextShiftPrompt = null;
                  nextCareer = {
                    ...nextCareer,
                    activeDayMarker: day,
                    shiftChoiceForDay: 'rabbit_hole',
                    wfhActive: false,
                  };

                  if (commute) {
                    nextQueue = [commute];
                    nextSim = {
                      ...nextSim,
                      pose: 'walk',
                      activeObjectId: null,
                      activeProp: null,
                    };
                    pushFeedback(`Time for work! Heading to ${careerDef.name}`, 'info');
                  } else {
                    // Direct off-lot fallback if doorway is blocked
                    const allObjects = getAllWorldObjects(state.placedObjects);
                    const allWalls = getAllWorldWalls(state.walls);
                    if (nextNpcs.some((n) => n.knockingAtMayaDoor)) {
                      nextNpcs = nextNpcs.map((n) =>
                        n.knockingAtMayaDoor
                          ? sendNpcBackHomeState(n, allObjects, allWalls)
                          : n,
                      );
                    }
                    nextDoorbellPrompt = null;
                    nextQueue = [];
                    nextSim = {
                      ...nextSim,
                      awayAtWork: true,
                      pose: 'idle',
                      activeObjectId: null,
                      activeProp: null,
                    };
                    nextActiveShift = {
                      careerId: nextCareer.careerId,
                      level: nextCareer.level,
                      day,
                      startTotalMinutes: newTotal,
                      endTotalMinutes: Math.max(endTotalMinutes, newTotal + 60),
                      tone: 'normal',
                      chanceCardTriggered: false,
                      performanceGained: 0,
                      workedMinutes: 0,
                    };
                    pushFeedback(`Started ${careerDef.name} shift!`, 'info');
                  }
                }
              }
            }
          }

          // Clear expired speech bubbles on Maya & NPCs
          if (nextSim.speechBubble && newTotal >= nextSim.speechBubble.expiresAtSimMinute) {
            nextSim = { ...nextSim, speechBubble: null };
          }
          if (nextNpcs.some((n) => n.speechBubble && newTotal >= n.speechBubble.expiresAtSimMinute)) {
            nextNpcs = nextNpcs.map((n) =>
              n.speechBubble && newTotal >= n.speechBubble.expiresAtSimMinute
                ? { ...n, speechBubble: null }
                : n,
            );
          }

          const envPenalty = getEnvironmentMessPenalty(nextPlacedObjects, nextMesses, {
            x: nextSim.tileX,
            z: nextSim.tileZ,
          });
          const nextEmotion = computeEmotion(nextNeeds, nextSim.emotionBoost, newTotal, envPenalty);

          return {
            clock: nextClock,
            funds: nextFunds,
            placedObjects: nextPlacedObjects,
            bills: nextBills,
            handiness: nextHandiness,
            messes: nextMesses,
            speed: nextSpeed,
            lastLiveSpeed: nextLastLiveSpeed,
            feedbacks: nextFeedbacks.slice(-4),
            actionQueue: nextQueue,
            idleSimMinutes: nextIdle,
            contacts: nextContacts,
            socialFeed: nextSocialFeed,
            unlockedHouseIds: nextUnlockedHouseIds,
            npcs: nextNpcs,
            doorbellPrompt: nextDoorbellPrompt,
            career: nextCareer,
            shiftPrompt: nextShiftPrompt,
            activeShift: nextActiveShift,
            activeChanceCard: nextChanceCard,
            promotionSummary: nextPromotionSummary,
            phoneHasBadge: nextPhoneHasBadge,
            sim: {
              ...nextSim,
              needs: nextNeeds,
              emotion: nextEmotion,
            },
          };
        });
      },

      tryAutonomousDecision: () => {
        const state = get();
        if (
          !state.freeWill ||
          state.mode !== 'live' ||
          state.wardrobeOpen ||
          state.sim.awayAtWork ||
          state.activeChanceCard ||
          state.promotionSummary ||
          state.actionQueue.length > 0
        ) {
          return;
        }
        if (state.idleSimMinutes < 6) return;

        const choice = pickAutonomousAction(
          state.sim,
          state.placedObjects,
          state.walls,
          state.funds,
          undefined,
          {
            allObjects: getAllWorldObjects(state.placedObjects),
            allWalls: getAllWorldWalls(state.walls),
            lockedDoorWallIds: getLockedDoorWallIdsForMaya(state.unlockedHouseIds),
            bills: state.bills,
          },
        );
        if (!choice) {
          set({ idleSimMinutes: 0 });
          return;
        }

        if (choice.kind === 'object' && choice.objectId) {
          state.enqueueObjectInteraction(choice.objectId, choice.interactionId);
        } else {
          state.enqueueSelfInteraction(choice.interactionId);
        }
      },

      startBuildItem: (catalogId) => {
        const state = get();
        const item = CATALOG_BY_ID[catalogId];
        if (!item) return;

        const simTile = { x: state.sim.tileX, z: state.sim.tileZ };
        const initialTile = findInitialBuildTile(
          catalogId,
          0,
          state.placedObjects,
          state.walls,
          simTile,
        );
        const isValid = isPlacementValid(
          item,
          initialTile.x,
          initialTile.z,
          0,
          state.placedObjects,
          state.walls,
          { simTile },
        );

        set({
          buildSelection: {
            mode: 'place_new',
            catalogId,
            tileX: initialTile.x,
            tileZ: initialTile.z,
            rotation: 0,
            isValid,
          },
        });
      },

      startMoveObject: (instanceId) => {
        const state = get();
        const obj = state.placedObjects.find((o) => o.instanceId === instanceId);
        if (!obj) return;
        const item = CATALOG_BY_ID[obj.catalogId];
        if (!item) return;

        const simTile = { x: state.sim.tileX, z: state.sim.tileZ };
        const isValid = isPlacementValid(
          item,
          obj.tileX,
          obj.tileZ,
          obj.rotation,
          state.placedObjects,
          state.walls,
          { excludeInstanceId: obj.instanceId, simTile },
        );

        set({
          buildSelection: {
            mode: 'move_existing',
            catalogId: obj.catalogId,
            movingInstanceId: obj.instanceId,
            originalTileX: obj.tileX,
            originalTileZ: obj.tileZ,
            originalRotation: obj.rotation,
            tileX: obj.tileX,
            tileZ: obj.tileZ,
            rotation: obj.rotation,
            isValid,
          },
        });
      },

      updateBuildGhost: (tileX, tileZ) => {
        set((state) => {
          if (!state.buildSelection) return state;
          const item = CATALOG_BY_ID[state.buildSelection.catalogId];
          if (!item) return state;

          const simTile = { x: state.sim.tileX, z: state.sim.tileZ };
          const isValid = isPlacementValid(
            item,
            tileX,
            tileZ,
            state.buildSelection.rotation,
            state.placedObjects,
            state.walls,
            {
              excludeInstanceId: state.buildSelection.movingInstanceId,
              simTile,
            },
          );

          return {
            buildSelection: {
              ...state.buildSelection,
              tileX,
              tileZ,
              isValid,
            },
          };
        });
      },

      rotateBuildSelection: () => {
        set((state) => {
          if (!state.buildSelection) return state;
          const item = CATALOG_BY_ID[state.buildSelection.catalogId];
          if (!item) return state;

          const nextRot = (((state.buildSelection.rotation + 90) % 360) as RotationDeg);
          const simTile = { x: state.sim.tileX, z: state.sim.tileZ };
          const isValid = isPlacementValid(
            item,
            state.buildSelection.tileX,
            state.buildSelection.tileZ,
            nextRot,
            state.placedObjects,
            state.walls,
            {
              excludeInstanceId: state.buildSelection.movingInstanceId,
              simTile,
            },
          );

          return {
            buildSelection: {
              ...state.buildSelection,
              rotation: nextRot,
              isValid,
            },
          };
        });
      },

      confirmBuildPlacement: () => {
        const state = get();
        const sel = state.buildSelection;
        if (!sel) return false;
        const item = CATALOG_BY_ID[sel.catalogId];
        if (!item) return false;

        const simTile = { x: state.sim.tileX, z: state.sim.tileZ };
        const valid = isPlacementValid(
          item,
          sel.tileX,
          sel.tileZ,
          sel.rotation,
          state.placedObjects,
          state.walls,
          { excludeInstanceId: sel.movingInstanceId, simTile },
        );

        if (!valid) {
          state.addFeedback('Cannot place furniture here', 'negative');
          return false;
        }

        const occupiedSet = item.walkable
          ? new Set<string>()
          : new Set(
              getOccupiedTiles(sel.tileX, sel.tileZ, item.footprint, sel.rotation).map(
                (t) => `${t.x},${t.z}`,
              ),
            );

        if (sel.mode === 'place_new') {
          if (state.funds < item.price) {
            state.addFeedback(`Need §${item.price} Simoleons`, 'negative');
            return false;
          }

          const newObj: PlacedObject = {
            instanceId: nextId('obj'),
            catalogId: sel.catalogId,
            tileX: sel.tileX,
            tileZ: sel.tileZ,
            rotation: sel.rotation,
          };

          // Safely nudge any visiting NPC standing on the newly occupied solid tile
          const nextNpcs = state.npcs.map((n) => {
            if (occupiedSet.has(`${n.tileX},${n.tileZ}`)) {
              syncNpcRuntimeToTile(n.contactId, MAYA_WELCOME_TILE.x, MAYA_WELCOME_TILE.z, 0);
              return {
                ...n,
                tileX: MAYA_WELCOME_TILE.x,
                tileZ: MAYA_WELCOME_TILE.z,
                pose: 'idle' as const,
                activeObjectId: null,
                activeProp: null,
                path: [],
                pathIndex: 0,
                pendingGoal: 'idle' as const,
                pendingObjectId: null,
              };
            }
            return n;
          });

          set({
            funds: state.funds - item.price,
            placedObjects: [...state.placedObjects, newObj],
            messes: state.messes.filter((m) => !occupiedSet.has(`${m.tileX},${m.tileZ}`)),
            npcs: nextNpcs,
            buildSelection: null,
            feedbacks: [
              ...state.feedbacks.slice(-3),
              {
                id: nextId('fb'),
                text: `Placed ${item.name} (-§${item.price})`,
                tone: 'info',
                createdAt: Date.now(),
              },
            ],
          });
          return true;
        }

        // Move existing object
        const movedObjects = state.placedObjects.map((o) =>
          o.instanceId === sel.movingInstanceId
            ? { ...o, tileX: sel.tileX, tileZ: sel.tileZ, rotation: sel.rotation }
            : o,
        );
        const wasUsingMoved = state.sim.activeObjectId === sel.movingInstanceId;
        const filteredQueue = wasUsingMoved
          ? state.actionQueue.filter((a) => a.targetObjectId !== sel.movingInstanceId)
          : state.actionQueue;
        const nextSim = wasUsingMoved
          ? { ...state.sim, pose: 'idle' as const, activeObjectId: null, activeProp: null }
          : state.sim;
        const nextNpcs = state.npcs.map((n) => {
          const affectedByMove =
            n.activeObjectId === sel.movingInstanceId ||
            n.pendingObjectId === sel.movingInstanceId ||
            occupiedSet.has(`${n.tileX},${n.tileZ}`);
          if (!affectedByMove) return n;
          const needsNudge = occupiedSet.has(`${n.tileX},${n.tileZ}`);
          const nextX = needsNudge ? MAYA_WELCOME_TILE.x : n.tileX;
          const nextZ = needsNudge ? MAYA_WELCOME_TILE.z : n.tileZ;
          if (needsNudge) {
            syncNpcRuntimeToTile(n.contactId, nextX, nextZ, 0);
          }
          return {
            ...n,
            tileX: nextX,
            tileZ: nextZ,
            pose: 'idle' as const,
            activeObjectId: null,
            activeProp: null,
            path: [],
            pathIndex: 0,
            pendingGoal: 'idle' as const,
            pendingObjectId: null,
          };
        });
        const nextQueue = preparePathForFrontAction(
          filteredQueue,
          nextSim,
          movedObjects,
          state.walls,
          state.unlockedHouseIds,
          nextNpcs,
        );

        set({
          placedObjects: movedObjects,
          messes: state.messes.filter((m) => !occupiedSet.has(`${m.tileX},${m.tileZ}`)),
          sim: nextSim,
          npcs: nextNpcs,
          actionQueue: nextQueue,
          buildSelection: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Moved ${item.name}`,
              tone: 'info',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      sellSelectedObject: () => {
        const state = get();
        const sel = state.buildSelection;
        if (!sel || sel.mode !== 'move_existing' || !sel.movingInstanceId) return false;
        const item = CATALOG_BY_ID[sel.catalogId];
        if (!item) return false;
        const soldObj = state.placedObjects.find((o) => o.instanceId === sel.movingInstanceId);
        const upgradeBonus = (soldObj?.upgrades?.length ?? 0) > 0 ? 1.1 : 1;
        const refund = Math.round(item.price * 0.8 * upgradeBonus);
        const remainingObjects = state.placedObjects.filter(
          (o) => o.instanceId !== sel.movingInstanceId,
        );
        const wasUsingSold = state.sim.activeObjectId === sel.movingInstanceId;
        const nextSim = wasUsingSold
          ? { ...state.sim, pose: 'idle' as const, activeObjectId: null, activeProp: null }
          : state.sim;
        const nextNpcs = state.npcs.map((n) =>
          n.activeObjectId === sel.movingInstanceId || n.pendingObjectId === sel.movingInstanceId
            ? {
                ...n,
                pose: 'idle' as const,
                activeObjectId: null,
                activeProp: null,
                path: [],
                pathIndex: 0,
                pendingGoal: 'idle' as const,
                pendingObjectId: null,
              }
            : n,
        );
        const remainingQueue = state.actionQueue.filter(
          (a) => a.targetObjectId !== sel.movingInstanceId,
        );
        const nextQueue = preparePathForFrontAction(
          remainingQueue,
          nextSim,
          remainingObjects,
          state.walls,
          state.unlockedHouseIds,
          nextNpcs,
        );

        set({
          funds: state.funds + refund,
          placedObjects: remainingObjects,
          sim: nextSim,
          npcs: nextNpcs,
          actionQueue: nextQueue,
          buildSelection: null,
          feedbacks: [
            ...state.feedbacks.slice(-3),
            {
              id: nextId('fb'),
              text: `Sold ${item.name} (+§${refund})`,
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
        return true;
      },

      cancelBuildSelection: () => set({ buildSelection: null }),

      resetStarterLot: () => {
        const initialSim = createInitialSim();
        const freshContacts = createInitialContacts();
        const freshNpcs = createInitialNpcWorldStates(freshContacts);
        syncRuntimeToTile(initialSim.tileX, initialSim.tileZ, initialSim.facingAngle);
        syncAllNpcsRuntime(freshNpcs);
        set({
          mode: 'live',
          wallMode: 'cutaway',
          wardrobeOpen: false,
          phoneOpen: false,
          phoneApp: 'home',
          phoneCaseId: 'coastal_mint',
          phoneHasBadge: false,
          contacts: freshContacts,
          socialFeed: createInitialSocialFeed(),
          unlockedHouseIds: [],
          npcs: freshNpcs,
          doorbellPrompt: null,
          career: null,
          shiftPrompt: null,
          activeShift: null,
          activeChanceCard: null,
          promotionSummary: null,
          bills: createInitialBillsState(),
          handiness: createInitialHandiness(),
          messes: [],
          speed: 1,
          lastLiveSpeed: 1,
          freeWill: true,
          clock: createInitialClock(),
          funds: INITIAL_FUNDS,
          sim: initialSim,
          walls: STARTER_WALLS,
          placedObjects: STARTER_OBJECTS.map((o) => ({ ...o })),
          actionQueue: [],
          pieMenu: null,
          buildSelection: null,
          idleSimMinutes: 0,
          feedbacks: [
            {
              id: nextId('fb'),
              text: 'Starter Lot Restored',
              tone: 'positive',
              createdAt: Date.now(),
            },
          ],
        });
      },
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage;
        }
        const noopStorage: StateStorage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
        return noopStorage;
      }),
      partialize: (state) => ({
        wallMode: state.wallMode,
        graphicsQuality: state.graphicsQuality,
        freeWill: state.freeWill,
        clock: state.clock,
        funds: state.funds,
        phoneCaseId: state.phoneCaseId,
        contacts: state.contacts,
        socialFeed: state.socialFeed,
        unlockedHouseIds: state.unlockedHouseIds,
        career: state.career,
        bills: state.bills,
        handiness: state.handiness,
        messes: state.messes,
        sim: {
          ...state.sim,
          pose: 'idle' as const,
          activeObjectId: null,
          activeProp: null,
          awayAtWork: false,
          speechBubble: null,
        },
        placedObjects: state.placedObjects,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.graphicsQuality) {
          state.graphicsQuality = 'high';
        }
        if (!state.phoneCaseId) {
          state.phoneCaseId = 'coastal_mint';
        }
        if (!state.bills) {
          state.bills = createInitialBillsState();
        }
        if (!state.handiness) {
          state.handiness = createInitialHandiness();
        }
        if (!Array.isArray(state.messes)) {
          state.messes = [];
        }
        const defaultContacts = createInitialContacts();
        if (!Array.isArray(state.contacts) || state.contacts.length === 0) {
          state.contacts = defaultContacts;
        } else {
          // Backfill romance, homeHouseId, and full 3D appearance onto saved contacts
          const defaultById = Object.fromEntries(defaultContacts.map((c) => [c.id, c]));
          state.contacts = state.contacts.map((c) => {
            const def = defaultById[c.id];
            if (!def) return c;
            return {
              ...def,
              ...c,
              romance: typeof c.romance === 'number' ? c.romance : 0,
              homeHouseId: c.homeHouseId ?? def.homeHouseId,
              appearance: c.appearance ?? { ...def.appearance },
            };
          });
        }
        if (!Array.isArray(state.socialFeed) || state.socialFeed.length === 0) {
          state.socialFeed = createInitialSocialFeed();
        }
        if (!Array.isArray(state.unlockedHouseIds)) {
          state.unlockedHouseIds = [];
        }
        state.npcs = createInitialNpcWorldStates(state.contacts);
        syncAllNpcsRuntime(state.npcs);
        state.doorbellPrompt = null;

        if (state.career === undefined) {
          state.career = null;
        }
        if (state.sim) {
          // Backfill new Phase 2 appearance fields for existing Phase 1 saves
          if (!state.sim.appearance.hairStyle) {
            state.sim.appearance.hairStyle = 'bun';
          }
          if (!state.sim.appearance.eyeColor) {
            state.sim.appearance.eyeColor = '#4c382a';
          }
          state.sim.activeProp = null;
          state.sim.awayAtWork = false;
          state.sim.speechBubble = null;

          // If Maya saved while visiting a neighbor house, keep that house unlocked so she isn't trapped
          const currentHouse = getNeighborHouseContainingTile({
            x: state.sim.tileX,
            z: state.sim.tileZ,
          });
          if (currentHouse && !state.unlockedHouseIds.includes(currentHouse.id)) {
            state.unlockedHouseIds = [...state.unlockedHouseIds, currentHouse.id];
          }

          // Backfill Bedroom Dresser & Arch Mirror if missing and their tiles are unobstructed
          const hasDresser = state.placedObjects.some((o) => o.catalogId === 'oak_dresser');
          const hasMirror = state.placedObjects.some((o) => o.catalogId === 'arch_mirror');
          const simTile = { x: state.sim.tileX, z: state.sim.tileZ };

          if (!hasDresser) {
            const dresserItem = CATALOG_BY_ID.oak_dresser;
            if (
              dresserItem &&
              isPlacementValid(dresserItem, 10, 7, 180, state.placedObjects, state.walls, { simTile })
            ) {
              state.placedObjects.push({
                instanceId: 'obj_dresser_1',
                catalogId: 'oak_dresser',
                tileX: 10,
                tileZ: 7,
                rotation: 180,
              });
            }
          }
          if (!hasMirror) {
            const mirrorItem = CATALOG_BY_ID.arch_mirror;
            if (
              mirrorItem &&
              isPlacementValid(mirrorItem, 9, 4, 90, state.placedObjects, state.walls, { simTile })
            ) {
              state.placedObjects.push({
                instanceId: 'obj_mirror_1',
                catalogId: 'arch_mirror',
                tileX: 9,
                tileZ: 4,
                rotation: 90,
              });
            }
          }

          syncRuntimeToTile(state.sim.tileX, state.sim.tileZ, state.sim.facingAngle);
        }
      },
    },
  ),
);
