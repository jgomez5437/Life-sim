import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_BY_ID } from '../data/catalog';
import { LOT_SIZE, STARTER_ROOMS } from '../data/starterLot';
import { getObjectWorldCenter, isInLotBounds, worldToTile } from '../engine/grid';
import { simRuntime } from '../engine/simRuntime';
import { useGameStore } from '../store/gameStore';
import type { PlacedObject, RoomDef, WallSegment, WallViewMode } from '../types/game';
import { AssetRenderer } from './assets/AssetRenderer';
import { shouldIgnoreTap } from './pointerGuard';

const WALL_FULL_HEIGHT = 2.55;
const WALL_DOWN_HEIGHT = 0.28;
const WALL_THICKNESS = 0.12;

const FLOOR_COLORS: Record<RoomDef['floorType'], string> = {
  wood_warm: '#cfa273',
  wood_light: '#dfc198',
  tile_kitchen: '#ece4d5',
  tile_bath: '#d4e8e6',
  stone_patio: '#c8c4ba',
};

function projectToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number },
): { x: number; y: number } {
  const projected = worldPos.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * size.width,
    y: (-projected.y * 0.5 + 0.5) * size.height,
  };
}

function shouldWallLower(side: WallSegment['side'], wallMode: WallViewMode, azimuth: number): boolean {
  if (wallMode === 'up') return false;
  if (wallMode === 'down') return true;

  // Camera sits in direction (sin(az), cos(az)) relative to lot center
  const camDirX = Math.sin(azimuth);
  const camDirZ = Math.cos(azimuth);

  if (side === 'south') return camDirZ > -0.15;
  if (side === 'north') return camDirZ < 0.15;
  if (side === 'east') return camDirX > -0.15;
  if (side === 'west') return camDirX < 0.15;
  return true; // Interior walls stay low in cutaway for crisp room visibility
}

function WallSegmentMesh({ wall, wallMode }: { wall: WallSegment; wallMode: WallViewMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const currentScaleY = useRef(1);

  const pos = useMemo<[number, number, number]>(() => {
    if (wall.orientation === 'horizontal') {
      return [wall.x - LOT_SIZE / 2 + 0.5, 0, wall.z - LOT_SIZE / 2];
    }
    return [wall.x - LOT_SIZE / 2, 0, wall.z - LOT_SIZE / 2 + 0.5];
  }, [wall]);

  const rotationY = wall.orientation === 'horizontal' ? 0 : Math.PI / 2;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const lowered = shouldWallLower(wall.side, wallMode, simRuntime.cameraAzimuth);
    const targetScale = lowered ? WALL_DOWN_HEIGHT / WALL_FULL_HEIGHT : 1;
    currentScaleY.current = THREE.MathUtils.lerp(
      currentScaleY.current,
      targetScale,
      1 - Math.exp(-Math.min(delta, 0.05) * 14),
    );
    groupRef.current.scale.y = currentScaleY.current;
  });

  const wallColor = wall.side === 'interior' ? '#f5efe6' : '#f2ede3';

  return (
    <group ref={groupRef} position={pos} rotation={[0, rotationY, 0]}>
      {wall.kind === 'solid' && (
        <mesh position={[0, WALL_FULL_HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.04, WALL_FULL_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial color={wallColor} roughness={0.85} />
        </mesh>
      )}

      {wall.kind === 'window' && (
        <group>
          {/* Lower sill wall */}
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.9, WALL_THICKNESS]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {/* Upper header */}
          <mesh position={[0, 2.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.54, WALL_THICKNESS]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {/* Side mullions */}
          <mesh position={[-0.44, 1.45, 0]} castShadow>
            <boxGeometry args={[0.16, 1.12, WALL_THICKNESS]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          <mesh position={[0.44, 1.45, 0]} castShadow>
            <boxGeometry args={[0.16, 1.12, WALL_THICKNESS]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {/* Window trim & glass pane */}
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.74, 1.1, 0.04]} />
            <meshStandardMaterial
              color="#c8ebfa"
              transparent
              opacity={0.38}
              roughness={0.1}
              metalness={0.15}
            />
          </mesh>
          <mesh position={[0, 0.91, 0]}>
            <boxGeometry args={[0.78, 0.06, 0.16]} />
            <meshStandardMaterial color="#b3885c" roughness={0.65} />
          </mesh>
        </group>
      )}

      {wall.kind === 'door' && (
        <group>
          {/* Door header */}
          <mesh position={[0, 2.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.54, WALL_THICKNESS]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {/* Wood jambs */}
          <mesh position={[-0.46, 1.0, 0]} castShadow>
            <boxGeometry args={[0.1, 2.02, 0.16]} />
            <meshStandardMaterial color="#9e7249" roughness={0.7} />
          </mesh>
          <mesh position={[0.46, 1.0, 0]} castShadow>
            <boxGeometry args={[0.1, 2.02, 0.16]} />
            <meshStandardMaterial color="#9e7249" roughness={0.7} />
          </mesh>
          {/* Threshold mat */}
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[0.88, 0.03, 0.22]} />
            <meshStandardMaterial color="#8f6743" roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* Subtle wood baseboard trim */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.02, 0.14, WALL_THICKNESS + 0.03]} />
        <meshStandardMaterial color="#b8936a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function WalkRipple() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const ripple = simRuntime.walkRipple;
    if (!meshRef.current || !matRef.current) return;
    if (!ripple) {
      meshRef.current.visible = false;
      return;
    }

    const elapsed = (performance.now() - ripple.startedAt) / 650;
    if (elapsed >= 1) {
      simRuntime.walkRipple = null;
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    meshRef.current.position.set(ripple.x, 0.05, ripple.z);
    const scale = 0.3 + elapsed * 0.9;
    meshRef.current.scale.set(scale, scale, 1);
    matRef.current.opacity = (1 - elapsed) * 0.85;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.32, 0.44, 28]} />
      <meshBasicMaterial ref={matRef} color="#26c478" transparent opacity={0.8} />
    </mesh>
  );
}

function DecorativeTrees() {
  const trees: Array<[number, number, number]> = [
    [-10.5, 0, -9.5],
    [10.2, 0, -9.8],
    [-10.8, 0, 2.5],
    [10.6, 0, 5.2],
    [-9.6, 0, 9.8],
    [9.8, 0, 10.2],
  ];

  return (
    <group>
      {trees.map(([tx, ty, tz], i) => (
        <group key={i} position={[tx, ty, tz]}>
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.24, 1.6, 8]} />
            <meshStandardMaterial color="#876143" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.0, 0]} castShadow>
            <dodecahedronGeometry args={[1.05, 1]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#5ea663' : '#70b36a'} roughness={0.85} />
          </mesh>
          <mesh position={[0.45, 2.45, 0.2]} castShadow>
            <dodecahedronGeometry args={[0.72, 1]} />
            <meshStandardMaterial color="#7bc272" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PlacedFurnitureItem({
  obj,
  isNight,
  isSelected,
  isActive,
  isHiddenForMove,
  onSelectObject,
}: {
  obj: PlacedObject;
  isNight: boolean;
  isSelected: boolean;
  isActive: boolean;
  isHiddenForMove: boolean;
  onSelectObject: (obj: PlacedObject, worldPos: THREE.Vector3) => void;
}) {
  const item = CATALOG_BY_ID[obj.catalogId];
  if (!item || isHiddenForMove) return null;

  const center = getObjectWorldCenter(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
  const rotY = (obj.rotation * Math.PI) / 180;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    // Allow clicking through walkable rugs to walk on them
    if (item.walkable && useGameStore.getState().mode === 'live') return;
    e.stopPropagation();
    onSelectObject(obj, new THREE.Vector3(center.x, 1.1, center.z));
  };

  return (
    <group
      position={[center.x, 0.03, center.z]}
      rotation={[0, rotY, 0]}
      onClick={handleClick}
    >
      <AssetRenderer item={item} isActive={isActive} isNight={isNight} />
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.56, 0.68, 28]} />
          <meshBasicMaterial color="#26c478" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

export function LotRenderer() {
  const { camera, size } = useThree();
  const mode = useGameStore((s) => s.mode);
  const wallMode = useGameStore((s) => s.wallMode);
  const walls = useGameStore((s) => s.walls);
  const placedObjects = useGameStore((s) => s.placedObjects);
  const activeObjectId = useGameStore((s) => s.sim.activeObjectId);
  const pieMenuObjectId = useGameStore((s) => s.pieMenu?.objectId);
  const buildSelection = useGameStore((s) => s.buildSelection);
  const funds = useGameStore((s) => s.funds);
  const hour = useGameStore((s) => s.clock.hour);

  const openPieMenu = useGameStore((s) => s.openPieMenu);
  const closePieMenu = useGameStore((s) => s.closePieMenu);
  const startMoveObject = useGameStore((s) => s.startMoveObject);
  const updateBuildGhost = useGameStore((s) => s.updateBuildGhost);

  const isNight = hour >= 19 || hour < 6;

  const handleObjectSelect = (obj: PlacedObject, worldPos: THREE.Vector3) => {
    if (mode === 'build') {
      startMoveObject(obj.instanceId);
      return;
    }

    const item = CATALOG_BY_ID[obj.catalogId];
    if (!item) return;

    const screen = projectToScreen(worldPos, camera, size);
    const options = item.interactions.map((inter) => ({
      id: inter.id,
      label: inter.label,
      icon: inter.icon,
      cost: inter.cost,
      disabled: (inter.cost ?? 0) > funds,
      reason: (inter.cost ?? 0) > funds ? `Needs §${inter.cost}` : undefined,
    }));

    if (options.length === 0) {
      closePieMenu();
      return;
    }

    openPieMenu({
      kind: 'object',
      title: item.name,
      subtitle: item.description,
      screenX: screen.x,
      screenY: screen.y,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      objectId: obj.instanceId,
      tile: { x: obj.tileX, z: obj.tileZ },
      options,
    });
  };

  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    e.stopPropagation();

    const tile = worldToTile(e.point.x, e.point.z);
    if (!isInLotBounds(tile.x, tile.z)) {
      closePieMenu();
      return;
    }

    if (mode === 'build') {
      if (buildSelection) {
        updateBuildGhost(tile.x, tile.z);
      }
      return;
    }

    const screen = projectToScreen(e.point, camera, size);
    openPieMenu({
      kind: 'floor',
      title: 'Ground',
      screenX: screen.x,
      screenY: screen.y,
      worldPos: [e.point.x, 0.1, e.point.z],
      tile,
      options: [
        { id: 'walk_here', label: 'Walk Here', icon: 'footprints' },
        { id: 'self:call_friend', label: 'Chat with Bestie', icon: 'phone' },
      ],
    });
  };

  return (
    <group>
      {/* Surrounding countryside apron */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#87be74" roughness={0.95} />
      </mesh>

      {/* Playable 16x16 lawn lot */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={handleGroundClick}
      >
        <planeGeometry args={[LOT_SIZE, LOT_SIZE]} />
        <meshStandardMaterial color="#92c97a" roughness={0.92} />
      </mesh>

      {/* Subtle wooden lot border curb */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <boxGeometry args={[LOT_SIZE + 0.25, 0.04, LOT_SIZE + 0.25]} />
        <meshStandardMaterial color="#7da868" roughness={0.9} />
      </mesh>

      {/* Cozy decorative perimeter trees */}
      <DecorativeTrees />

      {/* Room floor slabs */}
      {STARTER_ROOMS.map((room) => {
        const w = room.x2 - room.x1 + 1;
        const d = room.z2 - room.z1 + 1;
        const cx = room.x1 + w / 2 - LOT_SIZE / 2;
        const cz = room.z1 + d / 2 - LOT_SIZE / 2;

        return (
          <mesh
            key={room.id}
            position={[cx, 0.02, cz]}
            receiveShadow
            onClick={handleGroundClick}
          >
            <boxGeometry args={[w, 0.04, d]} />
            <meshStandardMaterial color={FLOOR_COLORS[room.floorType]} roughness={0.82} />
          </mesh>
        );
      })}

      {/* Cutaway-aware house walls */}
      {walls.map((wall) => (
        <WallSegmentMesh key={wall.id} wall={wall} wallMode={wallMode} />
      ))}

      {/* Placed furniture items */}
      {placedObjects.map((obj) => (
        <PlacedFurnitureItem
          key={obj.instanceId}
          obj={obj}
          isNight={isNight}
          isSelected={pieMenuObjectId === obj.instanceId}
          isActive={activeObjectId === obj.instanceId}
          isHiddenForMove={
            mode === 'build' && buildSelection?.movingInstanceId === obj.instanceId
          }
          onSelectObject={handleObjectSelect}
        />
      ))}

      {/* Walk target feedback ripple */}
      <WalkRipple />
    </group>
  );
}
