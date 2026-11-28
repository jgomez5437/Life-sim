import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { simRuntime } from '../engine/simRuntime';
import { useGameStore } from '../store/gameStore';
import { pointerGuard } from './pointerGuard';

const MIN_RADIUS = 7.2;
const MAX_RADIUS = 34.0;
const MIN_POLAR = 0.46;
const MAX_POLAR = 1.15;
const PAN_MIN_X = -19.5;
const PAN_MAX_X = 20.5;
const PAN_MIN_Z = -4.5;
const PAN_MAX_Z = 21.5;
const DRAG_THRESHOLD_PX = 8;

interface ActivePointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  button: number;
}

export function CameraRig() {
  const { camera, gl } = useThree();
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);

  // Live/Build camera target & spherical orbit state
  const target = useRef(new THREE.Vector3(0.2, 0, -0.4));
  const currentTarget = useRef(new THREE.Vector3(0.2, 0, -0.4));

  const desiredSpherical = useRef({
    radius: 13.8,
    azimuth: Math.PI * 0.22,
    polar: 0.92,
  });
  const currentSpherical = useRef({
    radius: 13.8,
    azimuth: Math.PI * 0.22,
    polar: 0.92,
  });

  // Wardrobe close-up framing state
  const wardrobeAzimuth = useRef(0.35);
  const wardrobeOpenRef = useRef(wardrobeOpen);
  const focusTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (wardrobeOpen && !wardrobeOpenRef.current) {
      // Face Maya's front cleanly from a flattering 3/4 portrait angle
      wardrobeAzimuth.current = simRuntime.facingAngle + 0.22;
    }
    wardrobeOpenRef.current = wardrobeOpen;
  }, [wardrobeOpen]);

  useEffect(() => {
    const dom = gl.domElement;
    const pointers = new Map<number, ActivePointer>();
    let prevPinchDist = 0;
    let prevPinchAngle = 0;
    let prevMidY = 0;

    const getTwoPointers = (): [ActivePointer, ActivePointer] | null => {
      if (pointers.size !== 2) return null;
      const arr = Array.from(pointers.values());
      return [arr[0], arr[1]];
    };

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        button: e.button,
      });

      if (pointers.size === 1) {
        pointerGuard.wasDrag = false;
        pointerGuard.isMultiTouch = false;
      } else if (pointers.size >= 2) {
        pointerGuard.isMultiTouch = true;
        pointerGuard.wasDrag = true;
        const pair = getTwoPointers();
        if (pair) {
          const [a, b] = pair;
          prevPinchDist = Math.hypot(b.x - a.x, b.y - a.y);
          prevPinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
          prevMidY = (a.y + b.y) * 0.5;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;

      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;

      const totalTravel = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (totalTravel > DRAG_THRESHOLD_PX) {
        pointerGuard.wasDrag = true;
      }

      // In Wardrobe Studio, 1-finger drag orbits 360° around Maya to inspect hairstyles & outfits
      if (wardrobeOpenRef.current) {
        if (pointers.size === 1) {
          wardrobeAzimuth.current -= dx * 0.011;
        }
        return;
      }

      if (pointers.size === 1) {
        if (p.button === 2 || e.shiftKey) {
          desiredSpherical.current.azimuth -= dx * 0.0075;
          desiredSpherical.current.polar = THREE.MathUtils.clamp(
            desiredSpherical.current.polar - dy * 0.006,
            MIN_POLAR,
            MAX_POLAR,
          );
          return;
        }

        const az = currentSpherical.current.azimuth;
        const panScale = currentSpherical.current.radius * 0.00145;

        const rightX = Math.cos(az);
        const rightZ = -Math.sin(az);
        const forwardX = -Math.sin(az);
        const forwardZ = -Math.cos(az);

        const nextX = target.current.x - dx * panScale * rightX + dy * panScale * forwardX;
        const nextZ = target.current.z - dx * panScale * rightZ + dy * panScale * forwardZ;

        target.current.x = THREE.MathUtils.clamp(nextX, PAN_MIN_X, PAN_MAX_X);
        target.current.z = THREE.MathUtils.clamp(nextZ, PAN_MIN_Z, PAN_MAX_Z);
      } else if (pointers.size === 2) {
        const pair = getTwoPointers();
        if (!pair) return;
        const [a, b] = pair;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const midY = (a.y + b.y) * 0.5;

        if (prevPinchDist > 10 && dist > 10) {
          const zoomDelta = (prevPinchDist - dist) * 0.035;
          desiredSpherical.current.radius = THREE.MathUtils.clamp(
            desiredSpherical.current.radius + zoomDelta,
            MIN_RADIUS,
            MAX_RADIUS,
          );
        }

        let angleDelta = angle - prevPinchAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        desiredSpherical.current.azimuth -= angleDelta * 1.15;

        const tiltDelta = (midY - prevMidY) * 0.004;
        desiredSpherical.current.polar = THREE.MathUtils.clamp(
          desiredSpherical.current.polar - tiltDelta,
          MIN_POLAR,
          MAX_POLAR,
        );

        prevPinchDist = dist;
        prevPinchAngle = angle;
        prevMidY = midY;
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        window.setTimeout(() => {
          pointerGuard.isMultiTouch = false;
        }, 0);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (wardrobeOpenRef.current) return;
      e.preventDefault();
      desiredSpherical.current.radius = THREE.MathUtils.clamp(
        desiredSpherical.current.radius + e.deltaY * 0.012,
        MIN_RADIUS,
        MAX_RADIUS,
      );
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUpOrCancel);
    window.addEventListener('pointercancel', onPointerUpOrCancel);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUpOrCancel);
      window.removeEventListener('pointercancel', onPointerUpOrCancel);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const lerpFactor = 1 - Math.exp(-dt * 10);

    if (wardrobeOpenRef.current) {
      // Frame Maya cleanly on the left side of the mobile landscape viewport while WardrobePanel sits on the right
      const az = wardrobeAzimuth.current;
      const rightX = Math.cos(az);
      const rightZ = -Math.sin(az);

      focusTargetRef.current.set(
        simRuntime.worldX + rightX * 0.62,
        1.02,
        simRuntime.worldZ + rightZ * 0.62,
      );
      currentTarget.current.lerp(focusTargetRef.current, lerpFactor);
      currentSpherical.current.radius = THREE.MathUtils.lerp(
        currentSpherical.current.radius,
        3.25,
        lerpFactor,
      );
      currentSpherical.current.azimuth = THREE.MathUtils.lerp(
        currentSpherical.current.azimuth,
        az,
        lerpFactor,
      );
      currentSpherical.current.polar = THREE.MathUtils.lerp(
        currentSpherical.current.polar,
        1.34,
        lerpFactor,
      );
    } else {
      if (simRuntime.focusSimRequested) {
        target.current.x = THREE.MathUtils.clamp(simRuntime.worldX, PAN_MIN_X, PAN_MAX_X);
        target.current.z = THREE.MathUtils.clamp(simRuntime.worldZ, PAN_MIN_Z, PAN_MAX_Z);
        simRuntime.focusSimRequested = false;
      }

      if (simRuntime.focusWorldTarget) {
        target.current.x = THREE.MathUtils.clamp(
          simRuntime.focusWorldTarget.x,
          PAN_MIN_X,
          PAN_MAX_X,
        );
        target.current.z = THREE.MathUtils.clamp(
          simRuntime.focusWorldTarget.z,
          PAN_MIN_Z,
          PAN_MAX_Z,
        );
        simRuntime.focusWorldTarget = null;
      }

      currentTarget.current.lerp(target.current, lerpFactor);
      currentSpherical.current.radius = THREE.MathUtils.lerp(
        currentSpherical.current.radius,
        desiredSpherical.current.radius,
        lerpFactor,
      );
      currentSpherical.current.azimuth = THREE.MathUtils.lerp(
        currentSpherical.current.azimuth,
        desiredSpherical.current.azimuth,
        lerpFactor,
      );
      currentSpherical.current.polar = THREE.MathUtils.lerp(
        currentSpherical.current.polar,
        desiredSpherical.current.polar,
        lerpFactor,
      );
    }

    const { radius, azimuth, polar } = currentSpherical.current;
    const sinP = Math.sin(polar);

    camera.position.set(
      currentTarget.current.x + radius * sinP * Math.sin(azimuth),
      currentTarget.current.y + radius * Math.cos(polar),
      currentTarget.current.z + radius * sinP * Math.cos(azimuth),
    );
    camera.lookAt(currentTarget.current);

    simRuntime.cameraAzimuth = azimuth;
  });

  return null;
}
