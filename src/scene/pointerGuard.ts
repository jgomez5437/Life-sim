/**
 * Tracks whether the most recent pointer interaction was a pan/pinch drag gesture
 * so 3D tap handlers ignore accidental clicks after camera movement.
 */
export const pointerGuard = {
  wasDrag: false,
  isMultiTouch: false,
};

export function shouldIgnoreTap(): boolean {
  return pointerGuard.wasDrag || pointerGuard.isMultiTouch;
}
