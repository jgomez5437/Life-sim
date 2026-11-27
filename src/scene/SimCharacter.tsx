import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import { getObjectWorldCenter, rotateLocalVector } from '../engine/grid';
import { simRuntime } from '../engine/simRuntime';
import { getPlumbobColor } from '../engine/simulation';
import { useGameStore } from '../store/gameStore';
import { shouldIgnoreTap } from './pointerGuard';

export function SimCharacter() {
  const { camera, size } = useThree();
  const sim = useGameStore((s) => s.sim);
  const mode = useGameStore((s) => s.mode);
  const placedObjects = useGameStore((s) => s.placedObjects);
  const openPieMenu = useGameStore((s) => s.openPieMenu);

  const rootRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const plumbobRef = useRef<THREE.Mesh>(null);

  const plumbobColor = getPlumbobColor(sim.needs, sim.emotion);

  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.position.set(simRuntime.worldX, 0.04, simRuntime.worldZ);
      rootRef.current.rotation.y = simRuntime.facingAngle;
    }
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!rootRef.current || !bodyGroupRef.current) return;

    let targetX = simRuntime.worldX;
    let targetY = 0.04;
    let targetZ = simRuntime.worldZ;
    let targetRotY = simRuntime.facingAngle;

    // Align Sim onto furniture when sitting, sleeping, or stepping inside a shower stall
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

    const smooth = 1 - Math.exp(-Math.min(delta, 0.05) * 16);
    rootRef.current.position.x = THREE.MathUtils.lerp(rootRef.current.position.x, targetX, smooth);
    rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, targetY, smooth);
    rootRef.current.position.z = THREE.MathUtils.lerp(rootRef.current.position.z, targetZ, smooth);

    // Shortest-arc angle interpolation
    let angleDiff = targetRotY - rootRef.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    rootRef.current.rotation.y += angleDiff * smooth;

    // Body posture animations
    if (sim.pose === 'sleep') {
      bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyGroupRef.current.rotation.x,
        -Math.PI / 2,
        smooth,
      );
      bodyGroupRef.current.position.y = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.y,
        0.16,
        smooth,
      );
    } else if (sim.pose === 'sit') {
      bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyGroupRef.current.rotation.x,
        0,
        smooth,
      );
      bodyGroupRef.current.position.y = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.y,
        -0.22,
        smooth,
      );
    } else {
      bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyGroupRef.current.rotation.x,
        0,
        smooth,
      );
      const bob = simRuntime.isMoving
        ? Math.abs(Math.sin(simRuntime.walkCycle * 2)) * 0.045
        : Math.sin(t * 2.2) * 0.012;
      bodyGroupRef.current.position.y = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.y,
        bob,
        smooth,
      );
    }

    // Limb swings
    const swing = simRuntime.isMoving ? Math.sin(simRuntime.walkCycle * 2) * 0.55 : 0;
    const useSwing =
      sim.pose === 'stand_use' || sim.pose === 'wash' || sim.pose === 'eat'
        ? Math.sin(t * 6.5) * 0.35 - 0.75
        : sim.pose === 'phone'
          ? -0.95
          : 0;

    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = sim.pose === 'sit' ? -1.15 : swing;
      rightLegRef.current.rotation.x = sim.pose === 'sit' ? -1.15 : -swing;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = simRuntime.isMoving ? -swing * 0.8 : useSwing * 0.5;
      rightArmRef.current.rotation.x = simRuntime.isMoving ? swing * 0.8 : useSwing;
    }

    // Floating spinning Plumbob crystal
    if (plumbobRef.current) {
      plumbobRef.current.rotation.y = t * 1.45;
      plumbobRef.current.position.y =
        (sim.pose === 'sleep' ? 1.15 : 2.18) + Math.sin(t * 3.1) * 0.07;
    }
  });

  const handleSimTap = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap() || mode !== 'live') return;
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

  return (
    <group ref={rootRef} onClick={handleSimTap}>
      {/* Articulated character rig */}
      <group ref={bodyGroupRef}>
        {/* Left & Right Legs */}
        <mesh ref={leftLegRef} position={[-0.1, 0.34, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.38, 6, 10]} />
          <meshStandardMaterial color={sim.appearance.bottomColor} roughness={0.8} />
        </mesh>
        <mesh ref={rightLegRef} position={[0.1, 0.34, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.38, 6, 10]} />
          <meshStandardMaterial color={sim.appearance.bottomColor} roughness={0.8} />
        </mesh>

        {/* Torso / Cozy Knit Top */}
        <mesh position={[0, 0.88, 0]} castShadow>
          <capsuleGeometry args={[0.19, 0.34, 8, 12]} />
          <meshStandardMaterial color={sim.appearance.topColor} roughness={0.75} />
        </mesh>

        {/* Left & Right Arms */}
        <mesh ref={leftArmRef} position={[-0.25, 0.88, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.32, 6, 10]} />
          <meshStandardMaterial color={sim.appearance.skinColor} roughness={0.7} />
        </mesh>
        <mesh ref={rightArmRef} position={[0.25, 0.88, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.32, 6, 10]} />
          <meshStandardMaterial color={sim.appearance.skinColor} roughness={0.7} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.36, 0]} castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial color={sim.appearance.skinColor} roughness={0.65} />
        </mesh>

        {/* Hair cap + cozy top bun */}
        <mesh position={[0, 1.43, -0.02]} castShadow>
          <sphereGeometry args={[0.2, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color={sim.appearance.hairColor} roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.56, -0.1]} castShadow>
          <sphereGeometry args={[0.095, 12, 12]} />
          <meshStandardMaterial color={sim.appearance.hairColor} roughness={0.75} />
        </mesh>

        {/* Expressive eyes facing +Z */}
        <mesh position={[-0.065, 1.37, 0.168]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1f2428" roughness={0.2} />
        </mesh>
        <mesh position={[0.065, 1.37, 0.168]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1f2428" roughness={0.2} />
        </mesh>
      </group>

      {/* Iconic Sims-style spinning Plumbob */}
      <mesh ref={plumbobRef} position={[0, 2.18, 0]} scale={[0.72, 1.28, 0.72]}>
        <octahedronGeometry args={[0.19, 0]} />
        <meshStandardMaterial
          color={plumbobColor}
          emissive={plumbobColor}
          emissiveIntensity={0.45}
          roughness={0.18}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}
