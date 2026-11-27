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
import { getFloorTextureSet, getGrassTextureSet, getWallTextureSet } from './textures';

const WALL_FULL_HEIGHT = 2.55;
const WALL_DOWN_HEIGHT = 0.28;
const WALL_THICKNESS = 0.12;

const FLOOR_FALLBACK_COLORS: Record<RoomDef['floorType'], string> = {
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

  const camDirX = Math.sin(azimuth);
  const camDirZ = Math.cos(azimuth);

  if (side === 'south') return camDirZ > -0.15;
  if (side === 'north') return camDirZ < 0.15;
  if (side === 'east') return camDirX > -0.15;
  if (side === 'west') return camDirX < 0.15;
  return true;
}

function WallSegmentMesh({ wall, wallMode }: { wall: WallSegment; wallMode: WallViewMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const currentScaleY = useRef(1);

  const isExterior = wall.side !== 'interior';
  const wallTex = useMemo(() => getWallTextureSet(isExterior), [isExterior]);

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

  const wallColor = isExterior ? '#f6f2e9' : '#faf6ee';
  const wallMat = (
    <meshStandardMaterial
      color={wallColor}
      map={wallTex?.map ?? null}
      bumpMap={wallTex?.bumpMap ?? null}
      bumpScale={isExterior ? 0.025 : 0.008}
      roughness={0.84}
    />
  );

  // Flowerbox facing outward on exterior windows
  const flowerBoxZ =
    wall.side === 'south' || wall.side === 'east' ? 0.13 : -0.13;

  return (
    <group ref={groupRef} position={pos} rotation={[0, rotationY, 0]}>
      {wall.kind === 'solid' && (
        <mesh position={[0, WALL_FULL_HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.04, WALL_FULL_HEIGHT, WALL_THICKNESS]} />
          {wallMat}
        </mesh>
      )}

      {wall.kind === 'window' && (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.9, WALL_THICKNESS]} />
            {wallMat}
          </mesh>
          <mesh position={[0, 2.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.54, WALL_THICKNESS]} />
            {wallMat}
          </mesh>
          <mesh position={[-0.44, 1.45, 0]} castShadow>
            <boxGeometry args={[0.16, 1.12, WALL_THICKNESS]} />
            {wallMat}
          </mesh>
          <mesh position={[0.44, 1.45, 0]} castShadow>
            <boxGeometry args={[0.16, 1.12, WALL_THICKNESS]} />
            {wallMat}
          </mesh>
          {/* Reflective glass pane + crisp muntin crossbars */}
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.74, 1.1, 0.035]} />
            <meshPhysicalMaterial
              color="#d4f1fc"
              transparent
              opacity={0.34}
              roughness={0.06}
              metalness={0.14}
              clearcoat={1}
            />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.74, 0.03, 0.06]} />
            <meshStandardMaterial color="#f5efe6" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.03, 1.1, 0.06]} />
            <meshStandardMaterial color="#f5efe6" roughness={0.6} />
          </mesh>
          {/* Wood sill */}
          <mesh position={[0, 0.91, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.17]} />
            <meshStandardMaterial color="#b3885c" roughness={0.62} />
          </mesh>
          {/* Exterior cedar window flower box with colorful blooms */}
          {isExterior && (
            <group position={[0, 0.84, flowerBoxZ]}>
              <mesh castShadow>
                <boxGeometry args={[0.72, 0.14, 0.16]} />
                <meshStandardMaterial color="#9c6f46" roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.09, 0]}>
                <boxGeometry args={[0.66, 0.08, 0.12]} />
                <meshStandardMaterial color="#4e9458" roughness={0.85} />
              </mesh>
              {[-0.2, 0, 0.2].map((fx, i) => (
                <mesh key={i} position={[fx, 0.15, 0]}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                  <meshStandardMaterial
                    color={i === 1 ? '#f5cf6e' : '#e6786e'}
                    roughness={0.6}
                  />
                </mesh>
              ))}
            </group>
          )}
        </group>
      )}

      {wall.kind === 'door' && (
        <group>
          <mesh position={[0, 2.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.54, WALL_THICKNESS]} />
            {wallMat}
          </mesh>
          <mesh position={[-0.46, 1.0, 0]} castShadow>
            <boxGeometry args={[0.1, 2.02, 0.16]} />
            <meshStandardMaterial color="#9e7249" roughness={0.66} />
          </mesh>
          <mesh position={[0.46, 1.0, 0]} castShadow>
            <boxGeometry args={[0.1, 2.02, 0.16]} />
            <meshStandardMaterial color="#9e7249" roughness={0.66} />
          </mesh>
          {/* Slightly ajar wooden architectural door panel with brass knob */}
          <group position={[-0.4, 0, 0]} rotation={[0, -0.58, 0]}>
            <mesh position={[0.38, 1.0, 0]} castShadow>
              <boxGeometry args={[0.74, 1.96, 0.045]} />
              <meshStandardMaterial
                color={wall.side === 'south' ? '#498b7c' : '#c69868'}
                roughness={0.62}
              />
            </mesh>
            <mesh position={[0.66, 0.96, 0.038]}>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color="#e0be70" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0.66, 0.96, -0.038]}>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color="#e0be70" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[0.88, 0.03, 0.22]} />
            <meshStandardMaterial color="#8f6743" roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* Wood baseboard & top crown trim */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.02, 0.14, WALL_THICKNESS + 0.03]} />
        <meshStandardMaterial color="#b8936a" roughness={0.68} />
      </mesh>
      <mesh position={[0, WALL_FULL_HEIGHT - 0.04, 0]}>
        <boxGeometry args={[1.03, 0.08, WALL_THICKNESS + 0.03]} />
        <meshStandardMaterial color="#e4dac8" roughness={0.7} />
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
    meshRef.current.position.set(ripple.x, 0.055, ripple.z);
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

function GardenLandscaping() {
  const trees: Array<[number, number, number, number]> = [
    [-10.4, 0, -9.4, 1.05],
    [10.2, 0, -9.8, 1.15],
    [-10.8, 0, 2.5, 0.95],
    [10.6, 0, 5.2, 1.0],
    [-9.6, 0, 9.8, 1.1],
    [9.8, 0, 10.2, 0.92],
  ];

  const shrubs: Array<[number, number, string]> = [
    [-3.9, 3.6, '#e67c73'],
    [-3.2, 3.6, '#f2c86b'],
    [0.6, 3.6, '#87c47a'],
    [1.4, 3.6, '#e67c73'],
    [-5.6, -5.2, '#f2c86b'],
    [5.8, -5.2, '#d589c7'],
  ];

  return (
    <group>
      {/* Multi-layered stylized shade trees */}
      {trees.map(([tx, ty, tz, s], i) => (
        <group key={i} position={[tx, ty, tz]} scale={s}>
          <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.24, 1.7, 10]} />
            <meshStandardMaterial color="#876143" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.05, 0]} castShadow>
            <dodecahedronGeometry args={[1.05, 1]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#5ea663' : '#6cb368'} roughness={0.82} />
          </mesh>
          <mesh position={[0.48, 2.48, 0.22]} castShadow>
            <dodecahedronGeometry args={[0.72, 1]} />
            <meshStandardMaterial color="#7cc472" roughness={0.82} />
          </mesh>
          <mesh position={[-0.42, 2.32, -0.24]} castShadow>
            <dodecahedronGeometry args={[0.64, 1]} />
            <meshStandardMaterial color="#519657" roughness={0.84} />
          </mesh>
        </group>
      ))}

      {/* Blooming garden shrubs flanking the house */}
      {shrubs.map(([sx, sz, bloom], i) => (
        <group key={i} position={[sx, 0, sz]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.32, 1]} />
            <meshStandardMaterial color="#569c5c" roughness={0.85} />
          </mesh>
          <mesh position={[0.12, 0.36, 0.14]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={bloom} roughness={0.6} />
          </mesh>
          <mesh position={[-0.12, 0.34, 0.1]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fff4d6" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Sunlit white front picket fence segments along south lot edge (leaving walkway gap) */}
      {[-6.5, -5.0, -3.5, 0.5, 2.0, 3.5, 5.0, 6.5].map((fx, i) => (
        <group key={i} position={[fx, 0, 7.82]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[1.38, 0.08, 0.06]} />
            <meshStandardMaterial color="#f6f3ec" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[1.38, 0.08, 0.06]} />
            <meshStandardMaterial color="#f6f3ec" roughness={0.75} />
          </mesh>
          {[-0.52, -0.18, 0.18, 0.52].map((px, j) => (
            <mesh key={j} position={[px, 0.3, 0]} castShadow>
              <boxGeometry args={[0.1, 0.58, 0.07]} />
              <meshStandardMaterial color="#fbf9f3" roughness={0.72} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Charming curbside mailbox beside the front stone path */}
      <group position={[-0.38, 0, 7.2]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.09, 0.9, 0.09]} />
          <meshStandardMaterial color="#8c6343" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.36, 12]} />
          <meshStandardMaterial color="#2f8572" roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[0.12, 0.98, 0.04]}>
          <boxGeometry args={[0.025, 0.14, 0.04]} />
          <meshStandardMaterial color="#e05c4a" roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

function RoomFloorSlab({
  room,
  onGroundClick,
}: {
  room: RoomDef;
  onGroundClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const w = room.x2 - room.x1 + 1;
  const d = room.z2 - room.z1 + 1;
  const cx = room.x1 + w / 2 - LOT_SIZE / 2;
  const cz = room.z1 + d / 2 - LOT_SIZE / 2;

  const texSet = useMemo(() => getFloorTextureSet(room.floorType, w, d), [room.floorType, w, d]);
  const isGlazed = room.floorType === 'tile_kitchen' || room.floorType === 'tile_bath';

  return (
    <mesh position={[cx, 0.02, cz]} receiveShadow onClick={onGroundClick}>
      <boxGeometry args={[w, 0.04, d]} />
      <meshStandardMaterial
        color={texSet ? '#ffffff' : FLOOR_FALLBACK_COLORS[room.floorType]}
        map={texSet?.map ?? null}
        bumpMap={texSet?.bumpMap ?? null}
        bumpScale={isGlazed ? 0.015 : 0.022}
        roughness={isGlazed ? 0.38 : 0.72}
        metalness={isGlazed ? 0.06 : 0.02}
      />
    </mesh>
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
  onSelectObject: (obj: PlacedObject, worldPos: THREE.Vector3, hitPoint: THREE.Vector3) => void;
}) {
  const item = CATALOG_BY_ID[obj.catalogId];
  if (!item || isHiddenForMove) return null;

  const center = getObjectWorldCenter(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
  const rotY = (obj.rotation * Math.PI) / 180;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    if (item.walkable && useGameStore.getState().mode === 'live') return;
    e.stopPropagation();
    onSelectObject(obj, new THREE.Vector3(center.x, 1.1, center.z), e.point);
  };

  return (
    <group
      position={[center.x, 0.035, center.z]}
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
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);
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

  const grassLotTex = useMemo(() => getGrassTextureSet(6, 6), []);
  const grassApronTex = useMemo(() => getGrassTextureSet(24, 24), []);

  const isNight = hour >= 19 || hour < 6;

  const handleObjectSelect = (
    obj: PlacedObject,
    worldPos: THREE.Vector3,
    hitPoint: THREE.Vector3,
  ) => {
    if (wardrobeOpen) return;

    if (mode === 'build') {
      if (buildSelection) {
        const tile = worldToTile(hitPoint.x, hitPoint.z);
        if (isInLotBounds(tile.x, tile.z)) {
          updateBuildGhost(tile.x, tile.z);
        }
        return;
      }
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
    if (shouldIgnoreTap() || wardrobeOpen) return;
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
      {/* Surrounding sunlit meadow countryside */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[68, 68]} />
        <meshStandardMaterial
          color={grassApronTex ? '#e9f2e4' : '#87be74'}
          map={grassApronTex?.map ?? null}
          roughness={0.96}
        />
      </mesh>

      {/* Playable 16x16 textured lawn */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={handleGroundClick}
      >
        <planeGeometry args={[LOT_SIZE, LOT_SIZE]} />
        <meshStandardMaterial
          color={grassLotTex ? '#ffffff' : '#92c97a'}
          map={grassLotTex?.map ?? null}
          bumpMap={grassLotTex?.bumpMap ?? null}
          bumpScale={0.025}
          roughness={0.92}
        />
      </mesh>

      {/* Subtle landscaped border curb */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <boxGeometry args={[LOT_SIZE + 0.28, 0.04, LOT_SIZE + 0.28]} />
        <meshStandardMaterial color="#7da868" roughness={0.9} />
      </mesh>

      {/* Trees, flowerbeds, picket fence & mailbox */}
      <GardenLandscaping />

      {/* PBR-textured room floor slabs */}
      {STARTER_ROOMS.map((room) => (
        <RoomFloorSlab key={room.id} room={room} onGroundClick={handleGroundClick} />
      ))}

      {/* Cutaway-aware textured walls with flower boxes & doors (auto-lower during Wardrobe 360° orbit) */}
      {walls.map((wall) => (
        <WallSegmentMesh key={wall.id} wall={wall} wallMode={wardrobeOpen ? 'down' : wallMode} />
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
