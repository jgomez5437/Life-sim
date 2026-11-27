import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { CAREERS_BY_ID } from '../data/careers';
import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import {
  DELIVERY_ITEMS,
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
  getNextCareerLevel,
  getShiftWindowForDay,
  isWorkday,
  pickChanceCardForCareer,
} from '../engine/careers';
import {
  getBestInteractionSlot,
  isInLotBounds,
  isPlacementValid,
  tileToWorld,
} from '../engine/grid';
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
  FloatingFeedback,
  GameClock,
  GameMode,
  GraphicsQuality,
  NeedKey,
  NpcContact,
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

  // Career & Job System state
  career: SimCareerState | null;
  shiftPrompt: ShiftPromptState | null;
  activeShift: ActiveShiftState | null;
  activeChanceCard: ActiveChanceCardState | null;
  promotionSummary: PromotionSummary | null;

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
): ActionQueueItem[] {
  let remaining = queue;
  const simTile = { x: sim.tileX, z: sim.tileZ };

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

    if (front.kind === 'object' && front.targetObjectId) {
      const obj = placedObjects.find((o) => o.instanceId === front.targetObjectId);
      const item = obj ? CATALOG_BY_ID[obj.catalogId] : null;
      if (!obj || !item) {
        remaining = rest;
        continue;
      }
      const slot = getBestInteractionSlot(obj, item, placedObjects, walls, simTile);
      if (!slot) {
        remaining = rest;
        continue;
      }
      targetTile = slot.tile;
      facingAngle = slot.facingAngle;
    }

    const path = findPath(simTile, targetTile, placedObjects, walls);
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
): ActionQueueItem | null {
  const startTile = { x: sim.tileX, z: sim.tileZ };
  const path = findPath(startTile, COMMUTE_STREET_TILE, placedObjects, walls);
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
): ActionQueueItem[] {
  const path = findPath(COMMUTE_STREET_TILE, RETURN_HOME_TILE, placedObjects, walls);
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
      contacts: createInitialContacts(),
      socialFeed: createInitialSocialFeed(),

      // Career & Job System state
      career: null,
      shiftPrompt: null,
      activeShift: null,
      activeChanceCard: null,
      promotionSummary: null,

      setMode: (mode) => {
        const state = get();
        if (state.mode === mode) return;
        if (mode === 'build') {
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
        set({
          shiftPrompt: null,
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

      openPieMenu: (target) => set({ pieMenu: target }),
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
        simRuntime.focusSimRequested = true;
      },

      enqueueWalk: (tile) => {
        const state = get();
        if (state.sim.awayAtWork) {
          state.addFeedback('Maya is at work right now!', 'info');
          return false;
        }
        if (!isInLotBounds(tile.x, tile.z)) return false;
        if (state.actionQueue.length >= MAX_QUEUE_LENGTH) {
          state.addFeedback('Action queue is full', 'info');
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const path = findPath(startTile, tile, state.placedObjects, state.walls);
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

        const obj = state.placedObjects.find((o) => o.instanceId === objectId);
        if (!obj) return false;
        const item = CATALOG_BY_ID[obj.catalogId];
        if (!item) return false;
        const interaction = item.interactions.find((i) => i.id === interactionId);
        if (!interaction) return false;

        const cost = interaction.cost ?? 0;
        if (cost > state.funds) {
          state.addFeedback(`Need §${cost} Simoleons`, 'negative');
          return false;
        }

        const startTile =
          state.actionQueue.length > 0
            ? state.actionQueue[state.actionQueue.length - 1].targetTile
            : { x: state.sim.tileX, z: state.sim.tileZ };

        const slot = getBestInteractionSlot(obj, item, state.placedObjects, state.walls, startTile);
        if (!slot) {
          state.addFeedback(`${item.name} is blocked!`, 'negative');
          return false;
        }

        const path = findPath(startTile, slot.tile, state.placedObjects, state.walls);
        if (path === null) {
          state.addFeedback(`Cannot reach ${item.name}`, 'negative');
          return false;
        }

        const action: ActionQueueItem = {
          id: nextId('act'),
          kind: 'object',
          label: interaction.label,
          icon: interaction.icon,
          targetObjectId: objectId,
          interactionId,
          targetTile: slot.tile,
          facingAngle: slot.facingAngle,
          durationSimMinutes: interaction.durationSimMinutes,
          elapsedSimMinutes: 0,
          cost,
          costPaid: false,
          needDeltas: interaction.needDeltas,
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
          const isFront = state.actionQueue[0]?.id === actionId;
          const remaining = state.actionQueue.filter((a) => a.id !== actionId);
          const nextQueue = isFront
            ? preparePathForFrontAction(remaining, state.sim, state.placedObjects, state.walls)
            : remaining;
          return {
            actionQueue: nextQueue,
            sim: isFront
              ? { ...state.sim, pose: 'idle', activeObjectId: null, activeProp: null }
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

            return {
              actionQueue: [],
              shiftPrompt: null,
              pieMenu: null,
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

          // Deduct interaction cost if not already paid
          let nextFunds = state.funds;
          const nextFeedbacks = [...state.feedbacks];
          if (!front.costPaid && front.cost > 0) {
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

          const facingAngle = front.facingAngle ?? state.sim.facingAngle;
          simRuntime.facingAngle = facingAngle;

          return {
            funds: nextFunds,
            feedbacks: nextFeedbacks.slice(-4),
            sim: {
              ...state.sim,
              facingAngle,
              pose: front.animationPose,
              activeObjectId: front.targetObjectId ?? null,
              activeProp: front.heldProp ?? null,
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
            if (!canPromote(careerSnapshot, curLevelDef)) return careerSnapshot;
            const nextLevelDef = getNextCareerLevel(careerSnapshot.careerId, careerSnapshot.level);
            if (!nextLevelDef) return careerSnapshot;

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

          // Midnight rollover (new day): reset daily shift state & check low-funds safety net
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

                // Social Contact relationship gain & Social Bunny post
                if (front.contactId && front.relationshipDelta) {
                  const targetContact = nextContacts.find((c) => c.id === front.contactId);
                  if (targetContact) {
                    const updatedRel = clampRelationship(
                      targetContact.relationship + front.relationshipDelta,
                    );
                    nextContacts = nextContacts.map((c) =>
                      c.id === front.contactId
                        ? { ...c, relationship: updatedRel, lastInteractedDay: day }
                        : c,
                    );
                    pushFeedback(
                      `+${front.relationshipDelta} Friendship with ${targetContact.name.split(' ')[0]}`,
                      'positive',
                    );
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
                  state.placedObjects,
                  state.walls,
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

                // Auto-commute once shift start hour hits (unless WFH / PTO / Sick already chosen)
                const alreadyCommuting = nextQueue.some((a) => a.kind === 'commute');
                if (
                  !alreadyCommuting &&
                  (nextCareer.shiftChoiceForDay === null ||
                    nextCareer.shiftChoiceForDay === 'rabbit_hole') &&
                  newTotal >= startTotalMinutes &&
                  newTotal < endTotalMinutes - 30
                ) {
                  const commute = buildCommuteAction(
                    nextSim,
                    state.placedObjects,
                    state.walls,
                    careerDef.name,
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

          const nextEmotion = computeEmotion(nextNeeds, nextSim.emotionBoost, newTotal);

          return {
            clock: nextClock,
            funds: nextFunds,
            speed: nextSpeed,
            lastLiveSpeed: nextLastLiveSpeed,
            feedbacks: nextFeedbacks.slice(-4),
            actionQueue: nextQueue,
            idleSimMinutes: nextIdle,
            contacts: nextContacts,
            socialFeed: nextSocialFeed,
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

          set({
            funds: state.funds - item.price,
            placedObjects: [...state.placedObjects, newObj],
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
        const nextQueue = preparePathForFrontAction(
          filteredQueue,
          nextSim,
          movedObjects,
          state.walls,
        );

        set({
          placedObjects: movedObjects,
          sim: nextSim,
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

        const refund = Math.round(item.price * 0.8);
        const remainingObjects = state.placedObjects.filter(
          (o) => o.instanceId !== sel.movingInstanceId,
        );
        const wasUsingSold = state.sim.activeObjectId === sel.movingInstanceId;
        const nextSim = wasUsingSold
          ? { ...state.sim, pose: 'idle' as const, activeObjectId: null, activeProp: null }
          : state.sim;
        const remainingQueue = state.actionQueue.filter(
          (a) => a.targetObjectId !== sel.movingInstanceId,
        );
        const nextQueue = preparePathForFrontAction(
          remainingQueue,
          nextSim,
          remainingObjects,
          state.walls,
        );

        set({
          funds: state.funds + refund,
          placedObjects: remainingObjects,
          sim: nextSim,
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
        syncRuntimeToTile(initialSim.tileX, initialSim.tileZ, initialSim.facingAngle);
        set({
          mode: 'live',
          wallMode: 'cutaway',
          wardrobeOpen: false,
          phoneOpen: false,
          phoneApp: 'home',
          phoneCaseId: 'coastal_mint',
          phoneHasBadge: false,
          contacts: createInitialContacts(),
          socialFeed: createInitialSocialFeed(),
          career: null,
          shiftPrompt: null,
          activeShift: null,
          activeChanceCard: null,
          promotionSummary: null,
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
        career: state.career,
        sim: {
          ...state.sim,
          pose: 'idle' as const,
          activeObjectId: null,
          activeProp: null,
          awayAtWork: false,
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
        if (!Array.isArray(state.contacts) || state.contacts.length === 0) {
          state.contacts = createInitialContacts();
        }
        if (!Array.isArray(state.socialFeed) || state.socialFeed.length === 0) {
          state.socialFeed = createInitialSocialFeed();
        }
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
