import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import { getObjectWorldCenter, rotateLocalVector } from '../engine/grid';
import { simRuntime } from '../engine/simRuntime';
import { getPlumbobColor } from '../engine/simulation';
import { useGameStore } from '../store/gameStore';
import type { HairStyle, HeldPropType } from '../types/game';
import { shouldIgnoreTap } from './pointerGuard';

function createSoftShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(18, 28, 34, 0.34)');
  grad.addColorStop(0.6, 'rgba(18, 28, 34, 0.14)');
  grad.addColorStop(1, 'rgba(18, 28, 34, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function HairSculpt({
  style,
  hairColor,
  accentColor,
}: {
  style: HairStyle;
  hairColor: string;
  accentColor: string;
}) {
  const matProps = { color: hairColor, roughness: 0.62, metalness: 0.04 };

  return (
    <group>
      {/* Base scalp / crown volume */}
      <mesh position={[0, 0.032, -0.012]} scale={[1.05, 1.02, 1.07]} castShadow>
        <sphereGeometry args={[0.128, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Back skull coverage */}
      <mesh position={[0, -0.005, -0.055]} scale={[1.02, 1.0, 0.92]} castShadow>
        <sphereGeometry args={[0.115, 18, 14]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Soft curtain / side-swept bangs */}
      <mesh position={[-0.058, 0.068, 0.088]} rotation={[0.25, 0.35, 0.32]} scale={[1.1, 0.68, 0.72]} castShadow>
        <sphereGeometry args={[0.058, 12, 10]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={[0.056, 0.068, 0.088]} rotation={[0.25, -0.35, -0.32]} scale={[1.1, 0.68, 0.72]} castShadow>
        <sphereGeometry args={[0.058, 12, 10]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {style === 'bun' && (
        <group>
          {/* Elevated plush top bun */}
          <mesh position={[0, 0.165, -0.068]} scale={[1.05, 0.88, 1.0]} castShadow>
            <sphereGeometry args={[0.072, 16, 14]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          {/* Scrunchie / hair tie matching top */}
          <mesh position={[0, 0.125, -0.058]} rotation={[Math.PI * 0.42, 0, 0]} castShadow>
            <torusGeometry args={[0.052, 0.013, 10, 20]} />
            <meshStandardMaterial color={accentColor} roughness={0.65} />
          </mesh>
          {/* Subtle side face-framing wisps */}
          <mesh position={[-0.105, -0.015, 0.036]} rotation={[0, 0, 0.12]} castShadow>
            <capsuleGeometry args={[0.018, 0.06, 6, 8]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0.105, -0.015, 0.036]} rotation={[0, 0, -0.12]} castShadow>
            <capsuleGeometry args={[0.018, 0.06, 6, 8]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      )}

      {style === 'waves' && (
        <group>
          {/* Flowing back wave curtains */}
          <mesh position={[0, -0.12, -0.095]} scale={[1.28, 1.0, 0.58]} castShadow>
            <capsuleGeometry args={[0.095, 0.18, 8, 14]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          {/* Left & right shoulder waves */}
          <mesh position={[-0.108, -0.09, -0.012]} rotation={[0.08, 0, 0.12]} castShadow>
            <capsuleGeometry args={[0.045, 0.19, 8, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0.108, -0.09, -0.012]} rotation={[0.08, 0, -0.12]} castShadow>
            <capsuleGeometry args={[0.045, 0.19, 8, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          {/* Soft wavy lower tips */}
          <mesh position={[-0.12, -0.19, 0.015]} scale={[1.0, 0.85, 0.9]} castShadow>
            <sphereGeometry args={[0.046, 12, 10]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0.12, -0.19, 0.015]} scale={[1.0, 0.85, 0.9]} castShadow>
            <sphereGeometry args={[0.046, 12, 10]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      )}

      {style === 'bob' && (
        <group>
          {/* Sleek curved chin-length bob */}
          <mesh position={[-0.106, -0.04, -0.01]} rotation={[0, 0, 0.06]} castShadow>
            <capsuleGeometry args={[0.042, 0.11, 8, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0.106, -0.04, -0.01]} rotation={[0, 0, -0.06]} castShadow>
            <capsuleGeometry args={[0.042, 0.11, 8, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, -0.065, -0.085]} scale={[1.2, 0.95, 0.62]} castShadow>
            <capsuleGeometry args={[0.09, 0.09, 8, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          {/* Curved inward jaw tips */}
          <mesh position={[-0.09, -0.1, 0.02]} rotation={[0, 0, -0.3]} castShadow>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0.09, -0.1, 0.02]} rotation={[0, 0, 0.3]} castShadow>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      )}

      {style === 'pixie' && (
        <group>
          {/* Textured swept crown volume */}
          <mesh position={[0.012, 0.115, 0.025]} rotation={[0.15, 0.1, -0.22]} scale={[1.25, 0.65, 1.1]} castShadow>
            <sphereGeometry args={[0.078, 14, 12]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[-0.045, 0.105, 0.04]} rotation={[0.1, 0.2, 0.25]} scale={[1.0, 0.58, 0.95]} castShadow>
            <sphereGeometry args={[0.062, 12, 10]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function HeldPropMesh({ prop }: { prop: HeldPropType | null }) {
  if (!prop) return null;

  switch (prop) {
    case 'phone':
      return (
        <group position={[0, -0.05, 0.05]} rotation={[-0.5, -0.15, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.065, 0.115, 0.012]} />
            <meshStandardMaterial color="#252c36" roughness={0.25} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.007]}>
            <planeGeometry args={[0.054, 0.098]} />
            <meshStandardMaterial
              color="#7cd4f8"
              emissive="#48b8f0"
              emissiveIntensity={0.85}
              roughness={0.1}
            />
          </mesh>
        </group>
      );

    case 'mug':
      return (
        <group position={[0, -0.05, 0.05]} rotation={[0.2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.042, 0.036, 0.092, 14]} />
            <meshStandardMaterial color="#e07a5f" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.042, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.008, 12]} />
            <meshStandardMaterial color="#c99b6d" roughness={0.4} />
          </mesh>
          <mesh position={[0.042, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.022, 0.006, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#e07a5f" roughness={0.3} />
          </mesh>
        </group>
      );

    case 'plate':
      return (
        <group position={[-0.04, -0.03, 0.08]} rotation={[0.15, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.075, 0.032, 16]} />
            <meshStandardMaterial color="#faf6f0" roughness={0.25} />
          </mesh>
          {/* Fresh salad greens + tomatoes */}
          <mesh position={[0, 0.024, 0]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color="#59a85d" roughness={0.75} />
          </mesh>
          <mesh position={[0.03, 0.038, 0.02]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#e05646" roughness={0.45} />
          </mesh>
          <mesh position={[-0.026, 0.038, -0.016]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshStandardMaterial color="#f2c14e" roughness={0.5} />
          </mesh>
        </group>
      );

    case 'book':
      return (
        <group position={[-0.03, -0.04, 0.07]} rotation={[-0.4, 0.15, 0]}>
          <mesh position={[-0.045, 0, 0]} rotation={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.09, 0.13, 0.012]} />
            <meshStandardMaterial color="#3c7a72" roughness={0.7} />
          </mesh>
          <mesh position={[0.045, 0, 0]} rotation={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.09, 0.13, 0.012]} />
            <meshStandardMaterial color="#3c7a72" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <boxGeometry args={[0.16, 0.118, 0.006]} />
            <meshStandardMaterial color="#fbf6ec" roughness={0.85} />
          </mesh>
        </group>
      );
  }
}

export function SimCharacter() {
  const { camera, size } = useThree();
  const sim = useGameStore((s) => s.sim);
  const mode = useGameStore((s) => s.mode);
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);
  const placedObjects = useGameStore((s) => s.placedObjects);
  const openPieMenu = useGameStore((s) => s.openPieMenu);

  const rootRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const leftHipRef = useRef<THREE.Group>(null);
  const rightHipRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);

  const leftShoulderRef = useRef<THREE.Group>(null);
  const rightShoulderRef = useRef<THREE.Group>(null);
  const leftElbowRef = useRef<THREE.Group>(null);
  const rightElbowRef = useRef<THREE.Group>(null);

  const leftLidRef = useRef<THREE.Mesh>(null);
  const rightLidRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const plumbobRef = useRef<THREE.Group>(null);

  const blinkState = useRef({ nextBlinkAt: 2.8, blinkEndAt: 0 });
  const shadowTex = useMemo(() => createSoftShadowTexture(), []);

  const plumbobColor = getPlumbobColor(sim.needs, sim.emotion);
  const isNegativeMood =
    sim.emotion === 'uncomfortable' || sim.emotion === 'tense' || sim.emotion === 'exhausted';
  const isPositiveMood =
    sim.emotion === 'happy' || sim.emotion === 'inspired' || sim.emotion === 'energized';

  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.position.set(simRuntime.worldX, 0.04, simRuntime.worldZ);
      rootRef.current.rotation.y = simRuntime.facingAngle;
    }
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const smooth = 1 - Math.exp(-dt * 15);
    if (!rootRef.current || !pelvisRef.current) return;

    let targetX = simRuntime.worldX;
    let targetY = 0.04;
    let targetZ = simRuntime.worldZ;
    let targetRotY = simRuntime.facingAngle;

    if ((sim.pose === 'sit' || sim.pose === 'sleep' || sim.pose === 'wash') && sim.activeObjectId) {
      const obj = placedObjects.find((o) => o.instanceId === sim.activeObjectId);
      const item = obj ? CATALOG_BY_ID[obj.catalogId] : null;
      if (obj && item?.poseOffset) {
        const center = getObjectWorldCenter(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
        const { rx, rz } = rotateLocalVector(item.poseOffset[0], item.poseOffset[2], obj.rotation);
        targetX = center.x + rx;
        targetY = 0.04 + item.poseOffset[1];
        targetZ = center.z + rz;
        targetRotY = (obj.rotation * Math.PI) / 180;
      }
    }

    rootRef.current.position.x = THREE.MathUtils.lerp(rootRef.current.position.x, targetX, smooth);
    rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, targetY, smooth);
    rootRef.current.position.z = THREE.MathUtils.lerp(rootRef.current.position.z, targetZ, smooth);

    let angleDiff = targetRotY - rootRef.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    rootRef.current.rotation.y += angleDiff * smooth;

    // Anatomical joint kinematics
    const moving = simRuntime.isMoving && !wardrobeOpen;
    const stride = simRuntime.walkCycle * 1.95;

    let pelvisY = 0.85;
    let pelvisRotX = 0;
    let pelvisRotZ = 0;
    let torsoRotY = 0;
    let torsoRotX = 0;
    let headRotY = Math.sin(t * 0.85) * 0.07;
    let headRotX = Math.sin(t * 1.3) * 0.03;

    let lHipX = 0;
    let rHipX = 0;
    let lKneeX = 0;
    let rKneeX = 0;

    let lShX = 0;
    let rShX = 0;
    let lShZ = 0.1;
    let rShZ = -0.1;
    let lElbX = -0.16;
    let rElbX = -0.16;

    if (sim.pose === 'sleep') {
      pelvisY = 0.15;
      pelvisRotX = -Math.PI / 2;
      lShZ = 0.18;
      rShZ = -0.18;
      headRotY = 0.14;
      headRotX = 0;
    } else if (sim.pose === 'sit') {
      pelvisY = 0.44;
      lHipX = -1.45;
      rHipX = -1.45;
      lKneeX = 1.42;
      rKneeX = 1.42;
      torsoRotX = 0.04;
      if (sim.activeProp === 'phone' || sim.activeProp === 'book') {
        rShX = -0.78;
        rElbX = -0.82;
        lShX = -0.58;
        lElbX = -0.75;
        headRotX = 0.24;
      } else {
        lShX = -0.25;
        rShX = -0.25;
        lElbX = -0.62;
        rElbX = -0.62;
      }
    } else if (moving) {
      const s = Math.sin(stride);
      pelvisY = 0.85 + Math.abs(Math.cos(stride)) * 0.032;
      pelvisRotZ = s * 0.045;
      torsoRotY = -s * 0.09;
      torsoRotX = 0.04;

      lHipX = s * 0.56;
      rHipX = -s * 0.56;
      // Lift knee cleanly during forward swing phase
      lKneeX = Math.max(0, -Math.cos(stride)) * 0.65;
      rKneeX = Math.max(0, Math.cos(stride)) * 0.65;

      lShX = -s * 0.44;
      rShX = s * 0.44;
      lElbX = -0.24 - Math.max(0, s) * 0.3;
      rElbX = -0.24 - Math.max(0, -s) * 0.3;
      headRotY = 0;
    } else if (sim.pose === 'phone') {
      rShX = -0.85;
      rShZ = -0.15;
      rElbX = -0.95;
      lShX = -0.35;
      lElbX = -0.65;
      headRotX = 0.25;
      headRotY = Math.sin(t * 2.2) * 0.08;
    } else if (sim.pose === 'eat') {
      const sip = Math.sin(t * 3.4) * 0.22;
      rShX = -0.72 + sip;
      rElbX = -0.92 + sip * 0.5;
      lShX = -0.45;
      lElbX = -0.82;
      headRotX = 0.14;
    } else if (sim.pose === 'stand_use' || sim.pose === 'wash') {
      const work = Math.sin(t * 5.2) * 0.22;
      if (sim.activeProp === 'book') {
        lShX = -0.68;
        rShX = -0.68;
        lElbX = -0.85;
        rElbX = -0.85;
        headRotX = 0.26;
      } else {
        lShX = -0.62 + work;
        rShX = -0.62 - work;
        lElbX = -0.75;
        rElbX = -0.75;
      }
    } else {
      // Relaxed breathing & gentle weight shift while idle or admiring in Wardrobe
      const breath = Math.sin(t * 2.0);
      pelvisY = 0.85 + breath * 0.009;
      pelvisRotZ = wardrobeOpen ? Math.sin(t * 0.9) * 0.03 : 0;
      lShZ = 0.11 + breath * 0.015;
      rShZ = -0.11 - breath * 0.015;
      if (wardrobeOpen) {
        headRotY = Math.sin(t * 0.75) * 0.16;
        headRotX = -0.02 + Math.sin(t * 1.1) * 0.03;
      }
    }

    pelvisRef.current.position.y = THREE.MathUtils.lerp(pelvisRef.current.position.y, pelvisY, smooth);
    pelvisRef.current.rotation.x = THREE.MathUtils.lerp(pelvisRef.current.rotation.x, pelvisRotX, smooth);
    pelvisRef.current.rotation.z = THREE.MathUtils.lerp(pelvisRef.current.rotation.z, pelvisRotZ, smooth);

    if (torsoRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.lerp(torsoRef.current.rotation.y, torsoRotY, smooth);
      torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, torsoRotX, smooth);
    }
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, headRotY, smooth);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, headRotX, smooth);
    }

    if (leftHipRef.current && rightHipRef.current) {
      leftHipRef.current.rotation.x = THREE.MathUtils.lerp(leftHipRef.current.rotation.x, lHipX, smooth);
      rightHipRef.current.rotation.x = THREE.MathUtils.lerp(rightHipRef.current.rotation.x, rHipX, smooth);
    }
    if (leftKneeRef.current && rightKneeRef.current) {
      leftKneeRef.current.rotation.x = THREE.MathUtils.lerp(leftKneeRef.current.rotation.x, lKneeX, smooth);
      rightKneeRef.current.rotation.x = THREE.MathUtils.lerp(rightKneeRef.current.rotation.x, rKneeX, smooth);
    }
    if (leftShoulderRef.current && rightShoulderRef.current) {
      leftShoulderRef.current.rotation.x = THREE.MathUtils.lerp(leftShoulderRef.current.rotation.x, lShX, smooth);
      rightShoulderRef.current.rotation.x = THREE.MathUtils.lerp(rightShoulderRef.current.rotation.x, rShX, smooth);
      leftShoulderRef.current.rotation.z = THREE.MathUtils.lerp(leftShoulderRef.current.rotation.z, lShZ, smooth);
      rightShoulderRef.current.rotation.z = THREE.MathUtils.lerp(rightShoulderRef.current.rotation.z, rShZ, smooth);
    }
    if (leftElbowRef.current && rightElbowRef.current) {
      leftElbowRef.current.rotation.x = THREE.MathUtils.lerp(leftElbowRef.current.rotation.x, lElbX, smooth);
      rightElbowRef.current.rotation.x = THREE.MathUtils.lerp(rightElbowRef.current.rotation.x, rElbX, smooth);
    }

    // Natural randomized eyelid blinking (or peacefully closed while sleeping)
    if (leftLidRef.current && rightLidRef.current) {
      let lidScale = 0.06;
      if (sim.pose === 'sleep') {
        lidScale = 1.05;
      } else {
        if (t >= blinkState.current.nextBlinkAt) {
          blinkState.current.blinkEndAt = t + 0.14;
          blinkState.current.nextBlinkAt = t + 2.8 + Math.random() * 2.8;
        }
        if (t < blinkState.current.blinkEndAt) {
          lidScale = 1.05;
        }
      }
      leftLidRef.current.scale.y = THREE.MathUtils.lerp(leftLidRef.current.scale.y, lidScale, 0.45);
      rightLidRef.current.scale.y = THREE.MathUtils.lerp(rightLidRef.current.scale.y, lidScale, 0.45);
    }

    // Gentle animated talking mouth while on phone
    if (mouthRef.current) {
      const talkScale = sim.pose === 'phone' ? 1 + Math.abs(Math.sin(t * 10)) * 0.8 : 1;
      mouthRef.current.scale.y = talkScale;
    }

    // Dual-layer crystal Plumbob
    if (plumbobRef.current) {
      plumbobRef.current.rotation.y = t * 1.45;
      plumbobRef.current.position.y =
        (sim.pose === 'sleep' ? 1.15 : 2.15) + Math.sin(t * 3.1) * 0.065;
    }
  });

  const handleSimTap = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap() || mode !== 'live' || wardrobeOpen) return;
    e.stopPropagation();

    const worldPos = new THREE.Vector3(
      rootRef.current ? rootRef.current.position.x : simRuntime.worldX,
      1.35,
      rootRef.current ? rootRef.current.position.z : simRuntime.worldZ,
    );
    const projected = worldPos.clone().project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * size.width;
    const screenY = (-projected.y * 0.5 + 0.5) * size.height;

    openPieMenu({
      kind: 'sim',
      title: sim.name,
      subtitle: sim.traits.join(' • '),
      screenX,
      screenY,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      tile: { x: sim.tileX, z: sim.tileZ },
      options: SELF_INTERACTIONS.map((inter) => ({
        id: `self:${inter.id}`,
        label: inter.label,
        icon: inter.icon,
        cost: inter.cost,
      })),
    });
  };

  const { skinColor, hairColor, eyeColor, topColor, bottomColor, shoeColor, hairStyle } =
    sim.appearance;

  const browTilt = sim.emotion === 'tense' ? 0.24 : isNegativeMood ? -0.14 : isPositiveMood ? 0.06 : 0;
  const browY = isPositiveMood ? 0.056 : isNegativeMood ? 0.048 : 0.052;

  return (
    <group ref={rootRef} onClick={handleSimTap}>
      {/* Grounded contact shadow beneath Sim when standing/walking */}
      {sim.pose !== 'sleep' && sim.pose !== 'sit' && shadowTex && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.74, 0.74]} />
          <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
        </mesh>
      )}

      {/* Pelvis / Root anatomical rig */}
      <group ref={pelvisRef} position={[0, 0.85, 0]}>
        {/* Sculpted hips / trouser waist */}
        <mesh position={[0, 0.0, 0]} scale={[1.18, 0.86, 0.88]} castShadow>
          <sphereGeometry args={[0.135, 16, 14]} />
          <meshStandardMaterial color={bottomColor} roughness={0.78} />
        </mesh>
        {/* Subtle waistband belt */}
        <mesh position={[0, 0.065, 0]} scale={[1.12, 1, 0.84]} castShadow>
          <cylinderGeometry args={[0.128, 0.132, 0.04, 16]} />
          <meshStandardMaterial color="#3c332d" roughness={0.65} />
        </mesh>

        {/* ======================== LEFT LEG ======================== */}
        <group ref={leftHipRef} position={[-0.088, -0.02, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.064, 0.27, 8, 12]} />
            <meshStandardMaterial color={bottomColor} roughness={0.78} />
          </mesh>
          {/* Knee Pivot */}
          <group ref={leftKneeRef} position={[0, -0.39, 0]}>
            {/* Calf */}
            <mesh position={[0, -0.19, 0]} castShadow>
              <capsuleGeometry args={[0.051, 0.27, 8, 12]} />
              <meshStandardMaterial color={bottomColor} roughness={0.78} />
            </mesh>
            {/* Ankle skin peek */}
            <mesh position={[0, -0.355, 0]} castShadow>
              <cylinderGeometry args={[0.036, 0.034, 0.05, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.68} />
            </mesh>
            {/* Sculpted two-tone sneaker */}
            <group position={[0, -0.395, 0.032]}>
              <mesh position={[0, -0.015, 0]} castShadow>
                <boxGeometry args={[0.095, 0.032, 0.195]} />
                <meshStandardMaterial color="#ffffff" roughness={0.55} />
              </mesh>
              <mesh position={[0, 0.014, -0.01]} castShadow>
                <boxGeometry args={[0.09, 0.042, 0.165]} />
                <meshStandardMaterial color={shoeColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.008, 0.072]} scale={[1, 0.65, 1]} castShadow>
                <sphereGeometry args={[0.044, 10, 8]} />
                <meshStandardMaterial color={shoeColor} roughness={0.58} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ======================== RIGHT LEG ======================== */}
        <group ref={rightHipRef} position={[0.088, -0.02, 0]}>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.064, 0.27, 8, 12]} />
            <meshStandardMaterial color={bottomColor} roughness={0.78} />
          </mesh>
          <group ref={rightKneeRef} position={[0, -0.39, 0]}>
            <mesh position={[0, -0.19, 0]} castShadow>
              <capsuleGeometry args={[0.051, 0.27, 8, 12]} />
              <meshStandardMaterial color={bottomColor} roughness={0.78} />
            </mesh>
            <mesh position={[0, -0.355, 0]} castShadow>
              <cylinderGeometry args={[0.036, 0.034, 0.05, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.68} />
            </mesh>
            <group position={[0, -0.395, 0.032]}>
              <mesh position={[0, -0.015, 0]} castShadow>
                <boxGeometry args={[0.095, 0.032, 0.195]} />
                <meshStandardMaterial color="#ffffff" roughness={0.55} />
              </mesh>
              <mesh position={[0, 0.014, -0.01]} castShadow>
                <boxGeometry args={[0.09, 0.042, 0.165]} />
                <meshStandardMaterial color={shoeColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.008, 0.072]} scale={[1, 0.65, 1]} castShadow>
                <sphereGeometry args={[0.044, 10, 8]} />
                <meshStandardMaterial color={shoeColor} roughness={0.58} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ======================== UPPER BODY / TORSO ======================== */}
        <group ref={torsoRef} position={[0, 0.08, 0]}>
          {/* Tapered knit sweater / blouse torso */}
          <mesh position={[0, 0.19, 0]} scale={[1.18, 1.0, 0.78]} castShadow>
            <cylinderGeometry args={[0.145, 0.118, 0.37, 18]} />
            <meshStandardMaterial color={topColor} roughness={0.74} />
          </mesh>
          {/* Rounded shoulder yoke */}
          <mesh position={[0, 0.365, 0]} scale={[1.32, 0.56, 0.8]} castShadow>
            <sphereGeometry args={[0.142, 16, 12]} />
            <meshStandardMaterial color={topColor} roughness={0.74} />
          </mesh>
          {/* Soft crew-neck collar trim */}
          <mesh position={[0, 0.415, 0.005]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.068, 0.014, 10, 20]} />
            <meshStandardMaterial color={topColor} roughness={0.68} />
          </mesh>
          {/* Shirt hem accent */}
          <mesh position={[0, 0.012, 0]} scale={[1.16, 1, 0.8]}>
            <cylinderGeometry args={[0.123, 0.126, 0.032, 16]} />
            <meshStandardMaterial color="#f5f0e8" roughness={0.8} />
          </mesh>

          {/* ======================== LEFT ARM ======================== */}
          <group ref={leftShoulderRef} position={[-0.205, 0.36, 0]}>
            {/* Rolled short sleeve cap */}
            <mesh position={[0, -0.055, 0]} castShadow>
              <capsuleGeometry args={[0.053, 0.09, 8, 12]} />
              <meshStandardMaterial color={topColor} roughness={0.75} />
            </mesh>
            {/* Upper arm */}
            <mesh position={[0, -0.145, 0]} castShadow>
              <capsuleGeometry args={[0.041, 0.15, 8, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.66} />
            </mesh>
            {/* Elbow Pivot */}
            <group ref={leftElbowRef} position={[0, -0.255, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.035, 0.15, 8, 10]} />
                <meshStandardMaterial color={skinColor} roughness={0.66} />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.225, 0.01]} scale={[0.85, 1.05, 1.05]} castShadow>
                <sphereGeometry args={[0.039, 10, 10]} />
                <meshStandardMaterial color={skinColor} roughness={0.66} />
              </mesh>
            </group>
          </group>

          {/* ======================== RIGHT ARM + PROP SOCKET ======================== */}
          <group ref={rightShoulderRef} position={[0.205, 0.36, 0]}>
            <mesh position={[0, -0.055, 0]} castShadow>
              <capsuleGeometry args={[0.053, 0.09, 8, 12]} />
              <meshStandardMaterial color={topColor} roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.145, 0]} castShadow>
              <capsuleGeometry args={[0.041, 0.15, 8, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.66} />
            </mesh>
            <group ref={rightElbowRef} position={[0, -0.255, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.035, 0.15, 8, 10]} />
                <meshStandardMaterial color={skinColor} roughness={0.66} />
              </mesh>
              <group position={[0, -0.225, 0.01]}>
                <mesh scale={[0.85, 1.05, 1.05]} castShadow>
                  <sphereGeometry args={[0.039, 10, 10]} />
                  <meshStandardMaterial color={skinColor} roughness={0.66} />
                </mesh>
                <HeldPropMesh prop={sim.activeProp} />
              </group>
            </group>
          </group>

          {/* ======================== NECK & SCULPTED HEAD ======================== */}
          <mesh position={[0, 0.455, 0]} castShadow>
            <cylinderGeometry args={[0.046, 0.054, 0.1, 14]} />
            <meshStandardMaterial color={skinColor} roughness={0.66} />
          </mesh>

          <group ref={headRef} position={[0, 0.61, 0.006]}>
            {/* Sculpted head cranium + soft oval jaw */}
            <mesh scale={[0.96, 1.08, 0.98]} castShadow>
              <sphereGeometry args={[0.125, 22, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.62} />
            </mesh>

            {/* Ears */}
            <mesh position={[-0.116, -0.005, -0.008]} scale={[0.55, 1.0, 0.72]} castShadow>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.64} />
            </mesh>
            <mesh position={[0.116, -0.005, -0.008]} scale={[0.55, 1.0, 0.72]} castShadow>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.64} />
            </mesh>

            {/* Subtle sculpted nose */}
            <mesh position={[0, -0.012, 0.122]} scale={[0.85, 1.15, 0.85]}>
              <sphereGeometry args={[0.015, 10, 10]} />
              <meshStandardMaterial color={skinColor} roughness={0.62} />
            </mesh>

            {/* Warm cheek blush */}
            <mesh position={[-0.064, -0.022, 0.102]} rotation={[0, -0.45, 0]}>
              <circleGeometry args={[0.022, 12]} />
              <meshBasicMaterial color="#e68a8a" transparent opacity={0.28} />
            </mesh>
            <mesh position={[0.064, -0.022, 0.102]} rotation={[0, 0.45, 0]}>
              <circleGeometry args={[0.022, 12]} />
              <meshBasicMaterial color="#e68a8a" transparent opacity={0.28} />
            </mesh>

            {/* ======================== LEFT & RIGHT EXPRESSIVE EYES ======================== */}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.044, 0.016, 0.104]}>
                {/* Sclera */}
                <mesh scale={[1.05, 0.92, 0.72]}>
                  <sphereGeometry args={[0.022, 14, 12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.18} />
                </mesh>
                {/* Iris */}
                <mesh position={[0, 0, 0.011]} scale={[1, 1, 0.5]}>
                  <sphereGeometry args={[0.0135, 12, 10]} />
                  <meshStandardMaterial color={eyeColor} roughness={0.14} metalness={0.08} />
                </mesh>
                {/* Pupil */}
                <mesh position={[0, 0, 0.0155]} scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.0075, 10, 8]} />
                  <meshStandardMaterial color="#12161c" roughness={0.1} />
                </mesh>
                {/* Specular catchlight */}
                <mesh position={[0.005, 0.006, 0.0185]}>
                  <sphereGeometry args={[0.0032, 6, 6]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* Animated upper eyelid */}
                <mesh
                  ref={side === -1 ? leftLidRef : rightLidRef}
                  position={[0, 0.012, 0.012]}
                  scale={[1.1, 0.06, 0.8]}
                >
                  <sphereGeometry args={[0.023, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial color={skinColor} roughness={0.62} />
                </mesh>
              </group>
            ))}

            {/* Emotion-reactive eyebrows */}
            <mesh
              position={[-0.046, browY, 0.112]}
              rotation={[0, -0.18, Math.PI / 2 - browTilt]}
            >
              <capsuleGeometry args={[0.0055, 0.028, 4, 8]} />
              <meshStandardMaterial color={hairColor} roughness={0.7} />
            </mesh>
            <mesh
              position={[0.046, browY, 0.112]}
              rotation={[0, 0.18, Math.PI / 2 + browTilt]}
            >
              <capsuleGeometry args={[0.0055, 0.028, 4, 8]} />
              <meshStandardMaterial color={hairColor} roughness={0.7} />
            </mesh>

            {/* Emotion-reactive curved mouth */}
            <mesh
              ref={mouthRef}
              position={[0, isNegativeMood ? -0.056 : -0.044, 0.113]}
              rotation={[0, 0, isNegativeMood ? Math.PI * 0.075 : Math.PI + Math.PI * 0.075]}
            >
              <torusGeometry args={[0.019, 0.0042, 8, 16, Math.PI * 0.85]} />
              <meshStandardMaterial color="#a85c52" roughness={0.48} />
            </mesh>

            {/* Sculpted 3D Hairstyle */}
            <HairSculpt style={hairStyle} hairColor={hairColor} accentColor={topColor} />
          </group>
        </group>
      </group>

      {/* Dual-layer crystalline Sims Plumbob (hidden during Wardrobe close-up) */}
      {!wardrobeOpen && (
        <group ref={plumbobRef} position={[0, 2.15, 0]} scale={[0.72, 1.32, 0.72]}>
          {/* Glowing faceted core */}
          <mesh scale={0.58}>
            <octahedronGeometry args={[0.19, 0]} />
            <meshStandardMaterial
              color={plumbobColor}
              emissive={plumbobColor}
              emissiveIntensity={1.25}
              roughness={0.2}
            />
          </mesh>
          {/* Translucent glossy outer crystal shell */}
          <mesh>
            <octahedronGeometry args={[0.19, 0]} />
            <meshPhysicalMaterial
              color={plumbobColor}
              emissive={plumbobColor}
              emissiveIntensity={0.25}
              roughness={0.08}
              metalness={0.12}
              clearcoat={1}
              clearcoatRoughness={0.06}
              transparent
              opacity={0.68}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
