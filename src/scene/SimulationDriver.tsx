import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { tileToWorld } from '../engine/grid';
import { simRuntime } from '../engine/simRuntime';
import { useGameStore } from '../store/gameStore';

/** Sim minutes elapsed per real-world second at 1x speed. */
const SIM_MINUTES_PER_REAL_SEC = 2.0;
/** Base walking speed in tiles per real-world second at 1x speed. */
const WALK_TILES_PER_SEC = 2.25;

export function SimulationDriver() {
  const simMinuteAccumulator = useRef(0);
  const autonomyTimer = useRef(0);
  const feedbackPruneTimer = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);
    const state = useGameStore.getState();

    // Prune expired floating toasts occasionally
    feedbackPruneTimer.current += dt;
    if (feedbackPruneTimer.current > 0.6) {
      feedbackPruneTimer.current = 0;
      state.pruneFeedbacks();
    }

    if (
      state.mode !== 'live' ||
      state.speed === 0 ||
      state.activeChanceCard ||
      state.promotionSummary
    ) {
      simRuntime.isMoving = false;
      return;
    }

    const scaledDt = dt * state.speed;

    // 1. Advance active Sim movement along A* waypoints at 60 FPS
    const front = state.actionQueue[0];
    if (!state.sim.awayAtWork && front && front.phase === 'routing') {
      if (front.pathIndex >= front.path.length) {
        simRuntime.isMoving = false;
        state.beginPerformingActiveAction();
      } else {
        const nextTile = front.path[front.pathIndex];
        const targetWorld = tileToWorld(nextTile.x, nextTile.z);
        const dx = targetWorld.x - simRuntime.worldX;
        const dz = targetWorld.z - simRuntime.worldZ;
        const dist = Math.hypot(dx, dz);
        const step = WALK_TILES_PER_SEC * scaledDt;

        simRuntime.isMoving = true;
        simRuntime.walkCycle += scaledDt * 4.5;

        if (dist > 0.001) {
          simRuntime.facingAngle = Math.atan2(dx, dz);
        }

        if (dist <= step) {
          simRuntime.worldX = targetWorld.x;
          simRuntime.worldZ = targetWorld.z;
          const nextIdx = front.pathIndex + 1;
          state.updateSimTile(nextTile, simRuntime.facingAngle, nextIdx);
          if (nextIdx >= front.path.length) {
            simRuntime.isMoving = false;
            useGameStore.getState().beginPerformingActiveAction();
          }
        } else {
          simRuntime.worldX += (dx / dist) * step;
          simRuntime.worldZ += (dz / dist) * step;
        }
      }
    } else {
      simRuntime.isMoving = false;
    }

    // 2. Batch Sim-minute clock & needs updates (~4 Hz) so React HUD stays lean
    simMinuteAccumulator.current += scaledDt * SIM_MINUTES_PER_REAL_SEC;
    if (simMinuteAccumulator.current >= 0.45) {
      const chunk = simMinuteAccumulator.current;
      simMinuteAccumulator.current = 0;
      useGameStore.getState().tickSimMinutes(chunk);
    }

    // 3. Periodic Free Will autonomy check when idle and on-lot
    autonomyTimer.current += dt;
    if (autonomyTimer.current >= 1.2) {
      autonomyTimer.current = 0;
      if (!useGameStore.getState().sim.awayAtWork) {
        useGameStore.getState().tryAutonomousDecision();
      }
    }
  });

  return null;
}
