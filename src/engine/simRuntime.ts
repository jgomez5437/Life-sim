import { tileToWorld } from './grid';

export interface SimRuntimeState {
  worldX: number;
  worldZ: number;
  facingAngle: number;
  walkCycle: number;
  isMoving: boolean;
  /** Camera azimuth in radians (0 = looking from +Z toward -Z). Used by cutaway walls. */
  cameraAzimuth: number;
  /** Set to trigger smooth camera focus onto Sim's current world position. */
  focusSimRequested: boolean;
  /** Optional world-space point to smoothly pan camera toward (e.g., Visit Neighbor House). */
  focusWorldTarget: { x: number; z: number } | null;
  /** Temporary ground ripple feedback when tapping to walk. */
  walkRipple: { x: number; z: number; startedAt: number } | null;
}

const initialPos = tileToWorld(6, 7);

/**
 * High-frequency mutable state updated inside R3F's useFrame at 60 FPS without causing React re-renders.
 */
export const simRuntime: SimRuntimeState = {
  worldX: initialPos.x,
  worldZ: initialPos.z,
  facingAngle: 0,
  walkCycle: 0,
  isMoving: false,
  cameraAzimuth: Math.PI * 0.25,
  focusSimRequested: false,
  focusWorldTarget: null,
  walkRipple: null,
};

export function syncRuntimeToTile(tileX: number, tileZ: number, facingAngle = 0): void {
  const world = tileToWorld(tileX, tileZ);
  simRuntime.worldX = world.x;
  simRuntime.worldZ = world.z;
  simRuntime.facingAngle = facingAngle;
  simRuntime.isMoving = false;
}
