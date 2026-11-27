import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import {
  INITIAL_FUNDS,
  STARTER_OBJECTS,
  STARTER_WALLS,
  createInitialClock,
  createInitialSim,
} from '../data/starterLot';
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
import type {
  ActionQueueItem,
  BuildSelection,
  FloatingFeedback,
  GameClock,
  GameMode,
  NeedKey,
  PieMenuTarget,
  PlacedObject,
  RotationDeg,
  SimSpeed,
  SimState,
  TileCoord,
  WallSegment,
  WallViewMode,
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

  // Mode & HUD actions
  setMode: (mode: GameMode) => void;
  cycleWallMode: () => void;
  setSpeed: (speed: SimSpeed) => void;
  toggleFreeWill: () => void;
  openPieMenu: (target: PieMenuTarget) => void;
  closePieMenu: () => void;
  addFeedback: (text: string, tone?: FloatingFeedback['tone']) => void;
  pruneFeedbacks: () => void;
  focusCameraOnSim: () => void;

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

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      mode: 'live',
      wallMode: 'cutaway',
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

      setMode: (mode) => {
        const state = get();
        if (state.mode === mode) return;
        if (mode === 'build') {
          set({
            mode: 'build',
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
              ? { ...state.sim, pose: 'idle', activeObjectId: null }
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
              ? { ...state.sim, pose: 'idle', activeObjectId: null }
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
              sim: { ...state.sim, pose: 'idle', activeObjectId: null },
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
                sim: { ...state.sim, pose: 'idle', activeObjectId: null },
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

          let nextNeeds = decayNeeds(state.sim.needs, simMinutesDelta, state.sim.pose);
          let nextQueue = state.actionQueue;
          let nextSim = state.sim;
          let nextIdle = state.idleSimMinutes;
          let nextFunds = state.funds;
          const nextFeedbacks = [...state.feedbacks];

          // Daily creative stipend at 09:00 on new days (Day 2+)
          const prevDay = state.clock.day;
          if (day > prevDay) {
            nextFunds += 250;
            nextFeedbacks.push({
              id: nextId('fb'),
              text: 'Daily Stipend +§250',
              tone: 'positive',
              createdAt: Date.now(),
            });
          }

          if (nextQueue.length > 0 && nextQueue[0].phase === 'performing') {
            const [front, ...rest] = nextQueue;
            const remaining = Math.max(0, front.durationSimMinutes - front.elapsedSimMinutes);
            const appliedDt = Math.min(simMinutesDelta, remaining);
            const fraction = front.durationSimMinutes > 0 ? appliedDt / front.durationSimMinutes : 1;

            nextNeeds = applyNeedDeltas(nextNeeds, front.needDeltas, fraction);
            const updatedElapsed = front.elapsedSimMinutes + simMinutesDelta;

            if (updatedElapsed >= front.durationSimMinutes) {
              const boost = front.emotionBoost
                ? { type: front.emotionBoost, expiresAtSimMinute: newTotal + 180 }
                : nextSim.emotionBoost;

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

          const nextEmotion = computeEmotion(nextNeeds, nextSim.emotionBoost, newTotal);

          return {
            clock: { day, hour, minute, totalMinutes: newTotal },
            funds: nextFunds,
            feedbacks: nextFeedbacks.slice(-4),
            actionQueue: nextQueue,
            idleSimMinutes: nextIdle,
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
        if (!state.freeWill || state.mode !== 'live' || state.actionQueue.length > 0) return;
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
          ? { ...state.sim, pose: 'idle' as const, activeObjectId: null }
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
          ? { ...state.sim, pose: 'idle' as const, activeObjectId: null }
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
        freeWill: state.freeWill,
        clock: state.clock,
        funds: state.funds,
        sim: {
          ...state.sim,
          pose: 'idle' as const,
          activeObjectId: null,
        },
        placedObjects: state.placedObjects,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.sim) {
          syncRuntimeToTile(state.sim.tileX, state.sim.tileZ, state.sim.facingAngle);
        }
      },
    },
  ),
);
