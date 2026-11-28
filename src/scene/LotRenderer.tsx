import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_BY_ID } from '../data/catalog';
import {
  MAILBOX_STAND_TILE,
  REPAIR_TECH_COST,
  UPGRADE_PARTS_PACK_COST,
} from '../data/householdData';
import {
  NEIGHBOR_HOUSES,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  getHouseCenterWorld,
  getNeighborHouseContainingTile,
} from '../data/neighborhood';
import { LOT_SIZE, STARTER_ROOMS } from '../data/starterLot';
import {
  getObjectWorldCenter,
  isInLotBounds,
  isInWorldBounds,
  tileToWorld,
  worldToTile,
} from '../engine/grid';
import {
  getAvailableUpgradesForObject,
  getMaintenanceSpecForObject,
  isObjectBlockedByUtility,
} from '../engine/household';
import { simRuntime } from '../engine/simRuntime';
import { useGameStore } from '../store/gameStore';
import type {
  HouseholdMess,
  NeighborHouseDef,
  PlacedObject,
  RoomDef,
  WallSegment,
  WallViewMode,
} from '../types/game';
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

function WallSegmentMesh({
  wall,
  wallMode,
  exteriorColor = '#f6f2e9',
  doorColor,
  isLockedDoor = false,
  onDoorClick,
}: {
  wall: WallSegment;
  wallMode: WallViewMode;
  exteriorColor?: string;
  doorColor?: string;
  isLockedDoor?: boolean;
  onDoorClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
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

  const wallColor = isExterior ? exteriorColor : '#faf6ee';
  const wallMat = (
    <meshStandardMaterial
      color={wallColor}
      map={wallTex?.map ?? null}
      bumpMap={wallTex?.bumpMap ?? null}
      bumpScale={isExterior ? 0.025 : 0.008}
      roughness={0.84}
    />
  );

  const resolvedDoorColor =
    doorColor && isExterior ? doorColor : wall.side === 'south' ? '#498b7c' : '#c69868';

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
        <group onClick={isLockedDoor ? onDoorClick : undefined}>
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
          {/* Wooden architectural door panel: closed when locked, ajar when invited in */}
          <group position={[-0.4, 0, 0]} rotation={[0, isLockedDoor ? 0 : -0.58, 0]}>
            <mesh position={[0.38, 1.0, 0]} castShadow>
              <boxGeometry args={[0.76, 1.96, 0.055]} />
              <meshStandardMaterial color={resolvedDoorColor} roughness={0.62} />
            </mesh>
            <mesh position={[0.66, 0.96, 0.04]}>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color="#e0be70" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0.66, 0.96, -0.04]}>
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

function NeighborHouseRoof({
  house,
  onSelectHouse,
}: {
  house: NeighborHouseDef;
  onSelectHouse: (house: NeighborHouseDef, worldPos: THREE.Vector3) => void;
}) {
  const w = house.houseRect.x2 - house.houseRect.x1 + 1;
  const d = house.houseRect.z2 - house.houseRect.z1 + 1;
  const center = useMemo(() => getHouseCenterWorld(house), [house]);
  const roofHeight = 2.05;
  const overhang = 0.42;

  const gableGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const halfD = d / 2 + 0.08;
    shape.moveTo(-halfD, 0);
    shape.lineTo(halfD, 0);
    shape.lineTo(0, roofHeight);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: w + 0.12,
      bevelEnabled: false,
    });
    geom.translate(0, 0, -(w + 0.12) / 2);
    geom.rotateY(Math.PI / 2);
    geom.computeVertexNormals();
    return geom;
  }, [w, d]);

  useEffect(() => {
    return () => {
      gableGeometry.dispose();
    };
  }, [gableGeometry]);

  const halfRun = d / 2 + overhang;
  const slopeLen = Math.hypot(halfRun, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, halfRun);
  const slopeOffsetY = roofHeight / 2;
  const slopeOffsetZ = halfRun / 2;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    e.stopPropagation();
    onSelectHouse(house, new THREE.Vector3(center.x, WALL_FULL_HEIGHT + 1.2, center.z));
  };

  return (
    <group position={[center.x, WALL_FULL_HEIGHT, center.z]} onClick={handleClick}>
      {/* Gable stucco prism */}
      <mesh geometry={gableGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={house.exteriorColor} roughness={0.86} />
      </mesh>

      {/* North pitched shingle plane */}
      <mesh
        position={[0, slopeOffsetY + 0.06, -slopeOffsetZ]}
        rotation={[-slopeAngle, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w + overhang * 2, 0.14, slopeLen + 0.16]} />
        <meshStandardMaterial color={house.roofColor} roughness={0.78} />
      </mesh>

      {/* South pitched shingle plane */}
      <mesh
        position={[0, slopeOffsetY + 0.06, slopeOffsetZ]}
        rotation={[slopeAngle, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w + overhang * 2, 0.14, slopeLen + 0.16]} />
        <meshStandardMaterial color={house.roofColor} roughness={0.78} />
      </mesh>

      {/* Roof ridge cap beam */}
      <mesh position={[0, roofHeight + 0.11, 0]} castShadow>
        <boxGeometry args={[w + overhang * 2 + 0.06, 0.16, 0.24]} />
        <meshStandardMaterial color="#f2eadc" roughness={0.7} />
      </mesh>

      {/* Coastal stone chimney accent */}
      <mesh position={[w * 0.26, roofHeight * 0.72, -d * 0.16]} castShadow>
        <boxGeometry args={[0.68, 1.55, 0.68]} />
        <meshStandardMaterial color="#d8cfc0" roughness={0.88} />
      </mesh>
      <mesh position={[w * 0.26, roofHeight * 0.72 + 0.82, -d * 0.16]} castShadow>
        <boxGeometry args={[0.78, 0.12, 0.78]} />
        <meshStandardMaterial color="#968978" roughness={0.8} />
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

function NeighborhoodStreetAndPark({
  isNight,
  onGroundClick,
}: {
  isNight: boolean;
  onGroundClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const dashPositions = [-21, -17, -13, -9, -5, 3, 7, 11, 15, 19, 23];
  const lampPositions: Array<[number, number]> = [
    [-19.5, 8.18],
    [-9.5, 8.18],
    [1.8, 8.18],
    [10.5, 8.18],
    [20.5, 8.18],
    [-14.5, 11.82],
    [-5.2, 11.82],
    [5.2, 11.82],
    [15.5, 11.82],
  ];

  return (
    <group>
      {/* Sunnyside Lane asphalt road (tiles z=17..18 -> world z=9..11) */}
      <mesh position={[0, 0.014, 10]} receiveShadow onClick={onGroundClick}>
        <boxGeometry args={[62, 0.025, 2.05]} />
        <meshStandardMaterial color="#586168" roughness={0.92} />
      </mesh>

      {/* Road center dashes */}
      {dashPositions.map((dx, i) => (
        <mesh key={i} position={[dx, 0.032, 10]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.65, 0.1]} />
          <meshStandardMaterial color="#f2e6b6" roughness={0.75} />
        </mesh>
      ))}

      {/* Pedestrian crosswalk connecting Maya's walkway (x=6) & Atelier Sunbeam (x=7) */}
      {[-1.72, -1.24, -0.76, -0.28].map((cx, i) => (
        <mesh key={i} position={[cx, 0.034, 10]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.26, 1.56]} />
          <meshStandardMaterial color="#f5f3ec" roughness={0.7} />
        </mesh>
      ))}

      {/* North & South coastal concrete sidewalks (z=16 -> world 8.5, z=19 -> world 11.5) */}
      <mesh position={[0, 0.026, 8.5]} receiveShadow onClick={onGroundClick}>
        <boxGeometry args={[52, 0.045, 1.02]} />
        <meshStandardMaterial color="#dcd6c8" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.026, 11.5]} receiveShadow onClick={onGroundClick}>
        <boxGeometry args={[52, 0.045, 1.02]} />
        <meshStandardMaterial color="#dcd6c8" roughness={0.86} />
      </mesh>

      {/* Street Lamps along Sunnyside Lane */}
      {lampPositions.map(([lx, lz], i) => (
        <group key={i} position={[lx, 0, lz]}>
          <mesh position={[0, 1.35, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.07, 2.7, 8]} />
            <meshStandardMaterial color="#3c4852" roughness={0.5} metalness={0.45} />
          </mesh>
          <mesh position={[0, 2.75, 0]}>
            <cylinderGeometry args={[0.16, 0.12, 0.34, 8]} />
            <meshStandardMaterial
              color={isNight ? '#ffefc4' : '#e6eef2'}
              emissive={isNight ? '#ffc766' : '#000000'}
              emissiveIntensity={isNight ? 1.5 : 0}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0, 2.98, 0]} castShadow>
            <coneGeometry args={[0.22, 0.16, 8]} />
            <meshStandardMaterial color="#3c4852" roughness={0.5} metalness={0.45} />
          </mesh>
        </group>
      ))}

      {/* Coastal Pocket Park (tiles x:-13..-3, z:21..30 -> world center x:-15.5, z:18) */}
      <group position={[-15.5, 0, 18]}>
        {/* Park circular stone plaza */}
        <mesh position={[0, 0.022, 0]} receiveShadow onClick={onGroundClick}>
          <cylinderGeometry args={[4.1, 4.2, 0.04, 28]} />
          <meshStandardMaterial color="#d2ccbf" roughness={0.88} />
        </mesh>

        {/* Stone entry path connecting north to south sidewalk */}
        <mesh position={[0, 0.02, -4.4]} receiveShadow onClick={onGroundClick}>
          <boxGeometry args={[2.0, 0.04, 3.2]} />
          <meshStandardMaterial color="#d2ccbf" roughness={0.88} />
        </mesh>

        {/* Coastal Fountain centerpiece */}
        <group position={[0, 0, 0.5]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.15, 1.28, 0.48, 18]} />
            <meshStandardMaterial color="#e5ded0" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.43, 0]}>
            <cylinderGeometry args={[0.98, 0.98, 0.08, 18]} />
            <meshStandardMaterial color="#4cb8c4" roughness={0.18} metalness={0.12} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.28, 0.65, 12]} />
            <meshStandardMaterial color="#e5ded0" roughness={0.76} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.52, 0.24, 0.16, 14]} />
            <meshStandardMaterial color="#ece6da" roughness={0.72} />
          </mesh>
        </group>

        {/* Wooden park benches */}
        {[
          [0, 2.9, Math.PI],
          [-2.8, -1.6, Math.PI * 0.28],
          [2.8, -1.6, -Math.PI * 0.28],
        ].map(([bx, bz, rot], idx) => (
          <group key={idx} position={[bx, 0, bz]} rotation={[0, rot, 0]}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[1.45, 0.09, 0.46]} />
              <meshStandardMaterial color="#a8764b" roughness={0.78} />
            </mesh>
            <mesh position={[0, 0.74, -0.18]} rotation={[-0.18, 0, 0]} castShadow>
              <boxGeometry args={[1.45, 0.34, 0.08]} />
              <meshStandardMaterial color="#a8764b" roughness={0.78} />
            </mesh>
            {[-0.58, 0.58].map((lx, j) => (
              <mesh key={j} position={[lx, 0.22, 0]} castShadow>
                <boxGeometry args={[0.08, 0.44, 0.42]} />
                <meshStandardMaterial color="#3c464f" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

function GardenLandscaping() {
  const trees: Array<[number, number, number, number]> = [
    [-22.5, 0, -9.8, 1.15],
    [-10.2, 0, -9.6, 1.05],
    [0.5, 0, -10.2, 1.1],
    [10.4, 0, -9.5, 1.15],
    [22.8, 0, -9.4, 1.05],
    [-9.2, 0, -3.5, 0.9],
    [9.2, 0, -3.2, 0.92],
    [-24.2, 0, 2.0, 1.05],
    [24.4, 0, 1.8, 1.08],
    [-20.4, 0, 14.2, 1.02],
    [-11.0, 0, 22.0, 1.06],
    [-20.2, 0, 22.2, 1.12],
    [-6.8, 0, 24.4, 1.0],
    [6.0, 0, 24.6, 1.05],
    [13.4, 0, 18.6, 1.08],
    [19.2, 0, 22.4, 1.14],
    [23.8, 0, 15.6, 1.08],
  ];

  const shrubs: Array<[number, number, string]> = [
    [-3.9, 3.6, '#e67c73'],
    [-3.2, 3.6, '#f2c86b'],
    [0.6, 3.6, '#87c47a'],
    [1.4, 3.6, '#e67c73'],
    [-5.6, -5.2, '#f2c86b'],
    [5.8, -5.2, '#d589c7'],
    // Neighbor porch accents
    [-19.2, 3.5, '#f2c86b'],
    [-13.8, 3.5, '#e67c73'],
    [13.8, 3.5, '#87c47a'],
    [19.2, 3.5, '#d589c7'],
    [-3.2, 14.5, '#f2c86b'],
    [2.2, 14.5, '#e67c73'],
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

      {/* Blooming garden shrubs flanking houses */}
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

      {/* Sunlit white front picket fence segments along Maya's south lot edge (leaving walkway gap) */}
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

      {/* Neighbor curbside mailboxes (Maya's interactive mailbox is rendered separately) */}
      {[
        [-15.3, 7.2, '#c66f53'],
        [17.7, 7.2, '#4f7796'],
        [0.65, 12.6, '#4e8c7e'],
      ].map(([mx, mz, color], idx) => (
        <group key={idx} position={[mx as number, 0, mz as number]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.09, 0.9, 0.09]} />
            <meshStandardMaterial color="#8c6343" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.36, 12]} />
            <meshStandardMaterial color={color as string} roughness={0.4} metalness={0.25} />
          </mesh>
          <mesh position={[0.12, 0.98, 0.04]}>
            <boxGeometry args={[0.025, 0.14, 0.04]} />
            <meshStandardMaterial color="#e05c4a" roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HomeMailbox({
  hasBillDue,
  isOverdue,
  onSelectMailbox,
}: {
  hasBillDue: boolean;
  isOverdue: boolean;
  onSelectMailbox: (worldPos: THREE.Vector3) => void;
}) {
  const badgeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (badgeRef.current && hasBillDue) {
      const t = clock.getElapsedTime();
      badgeRef.current.position.y = 1.38 + Math.sin(t * 3.4) * 0.08;
      badgeRef.current.rotation.y = t * 1.4;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    e.stopPropagation();
    onSelectMailbox(new THREE.Vector3(-0.38, 1.15, 7.2));
  };

  return (
    <group position={[-0.38, 0, 7.2]} onClick={handleClick}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.09, 0.9, 0.09]} />
        <meshStandardMaterial color="#8c6343" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.38, 12]} />
        <meshStandardMaterial color="#2f8572" roughness={0.38} metalness={0.25} />
      </mesh>
      {/* Red mail flag flips upright when a bill is waiting */}
      <group position={[0.125, 0.94, 0.04]} rotation={[hasBillDue ? 0 : Math.PI * 0.48, 0, 0]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.025, 0.16, 0.05]} />
          <meshStandardMaterial
            color={isOverdue ? '#ff3b30' : '#e05c4a'}
            emissive={hasBillDue ? '#e05c4a' : '#000000'}
            emissiveIntensity={hasBillDue ? 0.6 : 0}
            roughness={0.4}
          />
        </mesh>
      </group>
      {/* Floating glowing mail envelope indicator when a bill is unpaid */}
      {hasBillDue && (
        <group ref={badgeRef} position={[0, 1.38, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.2, 0.05]} />
            <meshStandardMaterial
              color={isOverdue ? '#ff5f56' : '#fff8e7'}
              emissive={isOverdue ? '#ff3b30' : '#f3b644'}
              emissiveIntensity={0.65}
              roughness={0.35}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

function ObjectStatusEffects({
  isDirty,
  isBroken,
  breakEffect,
  hasUpgrades,
}: {
  isDirty: boolean;
  isBroken: boolean;
  breakEffect: 'sparks' | 'leak' | null;
  hasUpgrades: boolean;
}) {
  const dirtyRef = useRef<THREE.Group>(null);
  const brokenRef = useRef<THREE.Group>(null);
  const upgradeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (dirtyRef.current && isDirty) {
      dirtyRef.current.children.forEach((child, i) => {
        const phase = (t * 0.65 + i * 0.33) % 1;
        child.position.y = 0.65 + phase * 0.72;
        child.position.x = Math.sin(t * 2 + i * 2.1) * 0.18;
        const s = 0.55 + Math.sin(phase * Math.PI) * 0.55;
        child.scale.setScalar(s);
      });
    }
    if (brokenRef.current && isBroken) {
      if (breakEffect === 'leak') {
        brokenRef.current.children.forEach((child, i) => {
          const phase = (t * 1.9 + i * 0.33) % 1;
          child.position.y = 0.85 - phase * 0.72 + Math.sin(phase * Math.PI) * 0.18;
          child.position.z = 0.15 + phase * 0.42;
          child.position.x = (i - 1) * 0.12;
        });
      } else {
        brokenRef.current.children.forEach((child, i) => {
          const pulse = Math.sin(t * 18 + i * 2.7);
          child.visible = pulse > 0.1;
          child.position.y = 0.75 + Math.sin(t * 11 + i) * 0.18;
          child.position.x = Math.cos(t * 9 + i * 2) * 0.24;
          child.rotation.z = t * 6;
        });
      }
    }
    if (upgradeRef.current && hasUpgrades && !isBroken) {
      upgradeRef.current.rotation.y = t * 1.6;
      upgradeRef.current.position.y = 1.38 + Math.sin(t * 2.4) * 0.04;
    }
  });

  if (!isDirty && !isBroken && !hasUpgrades) return null;

  return (
    <group>
      {isDirty && (
        <group ref={dirtyRef}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.8, 0]}>
              <sphereGeometry args={[0.11, 8, 8]} />
              <meshStandardMaterial
                color="#7c9c44"
                emissive="#5c7a2c"
                emissiveIntensity={0.35}
                transparent
                opacity={0.55}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      )}

      {isBroken && (
        <group ref={brokenRef}>
          {breakEffect === 'leak'
            ? [0, 1, 2].map((i) => (
                <mesh key={i} position={[0, 0.7, 0.2]}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                  <meshStandardMaterial
                    color="#4cc9e0"
                    emissive="#2aa4c4"
                    emissiveIntensity={0.5}
                    roughness={0.15}
                  />
                </mesh>
              ))
            : [0, 1, 2].map((i) => (
                <mesh key={i} position={[0, 0.8, 0.15]}>
                  <octahedronGeometry args={[0.075, 0]} />
                  <meshBasicMaterial color={i % 2 === 0 ? '#ffe066' : '#56d8ff'} />
                </mesh>
              ))}
        </group>
      )}

      {hasUpgrades && !isBroken && (
        <mesh ref={upgradeRef} position={[0.28, 1.38, 0.18]}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial
            color="#f5cf6e"
            emissive="#f5b83b"
            emissiveIntensity={0.75}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>
      )}
    </group>
  );
}

function HouseholdMessMesh({
  mess,
  onSelectMess,
}: {
  mess: HouseholdMess;
  onSelectMess: (mess: HouseholdMess, worldPos: THREE.Vector3) => void;
}) {
  const pos = useMemo(() => tileToWorld(mess.tileX, mess.tileZ), [mess.tileX, mess.tileZ]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (shouldIgnoreTap()) return;
    e.stopPropagation();
    onSelectMess(mess, new THREE.Vector3(pos.x, 0.35, pos.z));
  };

  return (
    <group position={[pos.x, 0.048, pos.z]} onClick={handleClick}>
      {mess.kind === 'puddle' && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.38, 18]} />
            <meshPhysicalMaterial
              color="#4cc9e0"
              roughness={0.08}
              metalness={0.05}
              transparent
              opacity={0.76}
              clearcoat={1}
            />
          </mesh>
          <mesh position={[0.16, 0.002, 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.17, 12]} />
            <meshPhysicalMaterial
              color="#6cd7eb"
              roughness={0.08}
              transparent
              opacity={0.72}
              clearcoat={1}
            />
          </mesh>
        </group>
      )}

      {mess.kind === 'dirty_dish' && (
        <group>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.19, 0.14, 0.035, 16]} />
            <meshStandardMaterial color="#e8e2d5" roughness={0.5} />
          </mesh>
          <mesh position={[0.02, 0.04, 0.01]}>
            <cylinderGeometry args={[0.12, 0.1, 0.015, 12]} />
            <meshStandardMaterial color="#879e4a" roughness={0.85} />
          </mesh>
          <mesh position={[-0.08, 0.24, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#83a649" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </group>
      )}

      {mess.kind === 'trash_pile' && (
        <group>
          <mesh position={[0, 0.07, 0]} castShadow>
            <dodecahedronGeometry args={[0.15, 0]} />
            <meshStandardMaterial color="#d4c7b0" roughness={0.92} />
          </mesh>
          <mesh position={[0.13, 0.05, 0.08]} castShadow>
            <dodecahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#b59f7e" roughness={0.92} />
          </mesh>
          <mesh position={[-0.1, 0.05, -0.06]} castShadow>
            <dodecahedronGeometry args={[0.085, 0]} />
            <meshStandardMaterial color="#e3dccb" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#83a649" transparent opacity={0.48} depthWrite={false} />
          </mesh>
        </group>
      )}
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
  powerOff = false,
  isSelected,
  isActive,
  isHiddenForMove,
  onSelectObject,
}: {
  obj: PlacedObject;
  isNight: boolean;
  powerOff?: boolean;
  isSelected: boolean;
  isActive: boolean;
  isHiddenForMove: boolean;
  onSelectObject: (obj: PlacedObject, worldPos: THREE.Vector3, hitPoint: THREE.Vector3) => void;
}) {
  const item = CATALOG_BY_ID[obj.catalogId];
  if (!item || isHiddenForMove) return null;

  const center = getObjectWorldCenter(obj.tileX, obj.tileZ, item.footprint, obj.rotation);
  const rotY = (obj.rotation * Math.PI) / 180;
  const spec = !obj.houseId ? getMaintenanceSpecForObject(obj) : null;
  const isDirty = !obj.houseId && (obj.cleanliness ?? 100) < 40;
  const isBroken = Boolean(!obj.houseId && obj.isBroken);
  const hasUpgrades = Boolean(!obj.houseId && obj.upgrades && obj.upgrades.length > 0);

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
      <AssetRenderer
        item={item}
        isActive={isActive && !isBroken && !powerOff}
        isNight={isNight}
        powerOff={powerOff}
      />
      <ObjectStatusEffects
        isDirty={isDirty}
        isBroken={isBroken}
        breakEffect={spec?.breakEffect ?? null}
        hasUpgrades={hasUpgrades}
      />
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
  const unlockedHouseIds = useGameStore((s) => s.unlockedHouseIds);
  const bills = useGameStore((s) => s.bills);
  const handiness = useGameStore((s) => s.handiness);
  const messes = useGameStore((s) => s.messes);
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
  const grassNeighborhoodTex = useMemo(() => getGrassTextureSet(18, 13), []);
  const grassApronTex = useMemo(() => getGrassTextureSet(38, 38), []);

  const isNight = hour >= 19 || hour < 6;

  const worldWidth = WORLD_MAX_X - WORLD_MIN_X + 1;
  const worldDepth = WORLD_MAX_Z - WORLD_MIN_Z + 1;
  const worldCenterX = (WORLD_MIN_X + WORLD_MAX_X + 1) / 2 - LOT_SIZE / 2;
  const worldCenterZ = (WORLD_MIN_Z + WORLD_MAX_Z + 1) / 2 - LOT_SIZE / 2;

  const handleMailboxSelect = (worldPos: THREE.Vector3) => {
    if (wardrobeOpen || mode !== 'live') return;
    const screen = projectToScreen(worldPos, camera, size);
    const options: Array<{
      id: string;
      label: string;
      icon: string;
      cost?: number;
      disabled?: boolean;
      reason?: string;
    }> = [];

    if (bills.amountDue > 0) {
      options.push({
        id: 'mailbox:pay_bills',
        label: 'Pay Bills',
        icon: 'mail',
        cost: bills.amountDue,
        disabled: funds < bills.amountDue,
        reason: funds < bills.amountDue ? `Needs §${bills.amountDue}` : undefined,
      });
    }
    options.push({
      id: 'mailbox:open_home',
      label: 'Bill & Home Info',
      icon: 'home',
    });
    options.push({
      id: 'mailbox:buy_parts',
      label: 'Order 2 Parts',
      icon: 'wrench',
      cost: UPGRADE_PARTS_PACK_COST,
      disabled: funds < UPGRADE_PARTS_PACK_COST,
      reason: funds < UPGRADE_PARTS_PACK_COST ? `Needs §${UPGRADE_PARTS_PACK_COST}` : undefined,
    });

    openPieMenu({
      kind: 'mailbox',
      title: 'Home Mailbox',
      subtitle:
        bills.amountDue > 0
          ? bills.powerShutoff || bills.waterShutoff
            ? `Utilities Shut Off • §${bills.amountDue} Due`
            : `Weekly Bill Due: §${bills.amountDue}`
          : 'All Bills Paid',
      screenX: screen.x,
      screenY: screen.y,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      tile: MAILBOX_STAND_TILE,
      options,
    });
  };

  const handleMessSelect = (mess: HouseholdMess, worldPos: THREE.Vector3) => {
    if (wardrobeOpen || mode !== 'live') return;
    if (useGameStore.getState().sim.awayAtWork) {
      closePieMenu();
      useGameStore.getState().addFeedback('Maya is at work right now!', 'info');
      return;
    }
    const screen = projectToScreen(worldPos, camera, size);
    const title =
      mess.kind === 'puddle'
        ? 'Water Puddle'
        : mess.kind === 'dirty_dish'
          ? 'Dirty Dish'
          : 'Trash Pile';
    const label =
      mess.kind === 'puddle'
        ? 'Mop Up Puddle'
        : mess.kind === 'dirty_dish'
          ? 'Wash Dirty Dish'
          : 'Throw Away Trash';

    openPieMenu({
      kind: 'mess',
      title,
      subtitle: 'Home Care • Clean Up',
      screenX: screen.x,
      screenY: screen.y,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      messId: mess.id,
      tile: { x: mess.tileX, z: mess.tileZ },
      options: [
        {
          id: `clean_mess:${mess.id}`,
          label,
          icon: mess.kind === 'puddle' ? 'droplet' : mess.kind === 'trash_pile' ? 'trash' : 'sparkles',
        },
      ],
    });
  };

  const handleNeighborHouseSelect = (house: NeighborHouseDef, worldPos: THREE.Vector3) => {
    if (wardrobeOpen || mode !== 'live') return;

    if (useGameStore.getState().sim.awayAtWork) {
      closePieMenu();
      useGameStore.getState().addFeedback('Maya is at work right now!', 'info');
      return;
    }

    const screen = projectToScreen(worldPos, camera, size);
    openPieMenu({
      kind: 'house',
      title: house.name,
      subtitle: `${house.subtitle} • ${house.directionLabel}`,
      screenX: screen.x,
      screenY: screen.y,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      houseId: house.id,
      tile: house.knockTile,
      options: [{ id: `knock:${house.id}`, label: 'Knock on Door', icon: 'home' }],
    });
  };

  const handleObjectSelect = (
    obj: PlacedObject,
    worldPos: THREE.Vector3,
    hitPoint: THREE.Vector3,
  ) => {
    if (wardrobeOpen) return;

    if (mode === 'build') {
      if (obj.houseId) {
        useGameStore
          .getState()
          .addFeedback("Build & Buy is only available on Maya's home lot", 'info');
        return;
      }
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

    if (useGameStore.getState().sim.awayAtWork) {
      closePieMenu();
      useGameStore.getState().addFeedback('Maya is at work right now!', 'info');
      return;
    }

    const item = CATALOG_BY_ID[obj.catalogId];
    if (!item) return;

    const screen = projectToScreen(worldPos, camera, size);
    const isHomeObj = !obj.houseId;
    const isBroken = Boolean(isHomeObj && obj.isBroken);
    const cleanliness = obj.cleanliness ?? 100;
    const utilCheck = isHomeObj ? isObjectBlockedByUtility(obj, bills) : { blocked: false };

    const options: Array<{
      id: string;
      label: string;
      icon: string;
      cost?: number;
      disabled?: boolean;
      reason?: string;
    }> = [];

    if (isBroken) {
      options.push({
        id: `repair_obj:${obj.instanceId}`,
        label: 'Repair',
        icon: 'wrench',
      });
      options.push({
        id: 'service:repair_tech',
        label: 'Call Repair Tech',
        icon: 'phone',
        cost: REPAIR_TECH_COST,
        disabled: funds < REPAIR_TECH_COST,
        reason: funds < REPAIR_TECH_COST ? `Needs §${REPAIR_TECH_COST}` : undefined,
      });
    } else {
      for (const inter of item.interactions) {
        const cantAfford = (inter.cost ?? 0) > funds;
        options.push({
          id: inter.id,
          label: inter.label,
          icon: inter.icon,
          cost: inter.cost,
          disabled: utilCheck.blocked || cantAfford,
          reason: utilCheck.blocked
            ? utilCheck.reason
            : cantAfford
              ? `Needs §${inter.cost}`
              : undefined,
        });
      }

      if (isHomeObj && cleanliness < 65) {
        options.push({
          id: `clean_obj:${obj.instanceId}`,
          label: 'Scrub Clean',
          icon: 'sparkles',
        });
      }

      if (isHomeObj) {
        const availUpgrades = getAvailableUpgradesForObject(obj, handiness, funds);
        // Surface up to 2 next upgrades so the radial pie stays sleek & readable
        const slotsLeft = Math.max(0, 6 - options.length);
        for (const u of availUpgrades.slice(0, Math.min(2, slotsLeft))) {
          const disabled = u.lockedBySkill || (!u.canAffordWithParts && !u.canAffordWithFunds);
          options.push({
            id: `upgrade_obj:${obj.instanceId}:${u.upgrade.id}`,
            label: u.canAffordWithParts
              ? `Upgrade: ${u.upgrade.shortLabel} (${u.upgrade.partsCost}p)`
              : `Upgrade: ${u.upgrade.shortLabel}`,
            icon: u.upgrade.icon,
            cost: u.canAffordWithParts ? undefined : u.upgrade.simoleonCost,
            disabled,
            reason: u.reason,
          });
        }
      }
    }

    if (options.length === 0) {
      closePieMenu();
      return;
    }

    const upgradeCount = obj.upgrades?.length ?? 0;
    const statusSubtitle = obj.houseId
      ? `Guest Use • ${item.description}`
      : isBroken
        ? 'Broken • Repair or call Repair Tech'
        : utilCheck.blocked
          ? utilCheck.reason
          : cleanliness < 40
            ? 'Grimy • Needs Scrubbing'
            : upgradeCount > 0
              ? `Upgraded (${upgradeCount}) • ${cleanliness}% Clean`
              : item.description;

    openPieMenu({
      kind: 'object',
      title: item.name,
      subtitle: statusSubtitle,
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

    if (mode === 'build') {
      if (!isInLotBounds(tile.x, tile.z)) {
        closePieMenu();
        return;
      }
      if (buildSelection) {
        updateBuildGhost(tile.x, tile.z);
      }
      return;
    }

    if (!isInWorldBounds(tile.x, tile.z)) {
      closePieMenu();
      return;
    }

    if (useGameStore.getState().sim.awayAtWork) {
      closePieMenu();
      useGameStore.getState().addFeedback('Maya is at work right now!', 'info');
      return;
    }

    const containingHouse = getNeighborHouseContainingTile(tile);
    if (containingHouse && !unlockedHouseIds.includes(containingHouse.id)) {
      handleNeighborHouseSelect(containingHouse, e.point.clone().add(new THREE.Vector3(0, 1.2, 0)));
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
      <mesh position={[0, -0.07, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[128, 128]} />
        <meshStandardMaterial
          color={grassApronTex ? '#e6f0e0' : '#87be74'}
          map={grassApronTex?.map ?? null}
          roughness={0.96}
        />
      </mesh>

      {/* Walkable Sunnyside Neighborhood Lawn */}
      <mesh
        position={[worldCenterX, -0.015, worldCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={handleGroundClick}
      >
        <planeGeometry args={[worldWidth, worldDepth]} />
        <meshStandardMaterial
          color={grassNeighborhoodTex ? '#f2f7ec' : '#8ec477'}
          map={grassNeighborhoodTex?.map ?? null}
          roughness={0.94}
        />
      </mesh>

      {/* Maya's Playable 16x16 textured home lot */}
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

      {/* Subtle landscaped border curb around Maya's home lot */}
      <mesh position={[0, -0.012, 0]} receiveShadow>
        <boxGeometry args={[LOT_SIZE + 0.28, 0.036, LOT_SIZE + 0.28]} />
        <meshStandardMaterial color="#7da868" roughness={0.9} />
      </mesh>

      {/* Sunnyside Lane road, crosswalk, sidewalks, lamps & Coastal Pocket Park */}
      <NeighborhoodStreetAndPark isNight={isNight} onGroundClick={handleGroundClick} />

      {/* Trees, flowerbeds, picket fence & neighbor mailboxes */}
      <GardenLandscaping />

      {/* Interactive Home Mailbox (flag pops up when weekly bills arrive) */}
      <HomeMailbox
        hasBillDue={bills.amountDue > 0}
        isOverdue={bills.powerShutoff || bills.waterShutoff}
        onSelectMailbox={handleMailboxSelect}
      />

      {/* Maya's PBR-textured room floor slabs */}
      {STARTER_ROOMS.map((room) => (
        <RoomFloorSlab key={room.id} room={room} onGroundClick={handleGroundClick} />
      ))}

      {/* Maya's cutaway-aware textured walls (auto-lower during Wardrobe 360° orbit) */}
      {walls.map((wall) => (
        <WallSegmentMesh key={wall.id} wall={wall} wallMode={wardrobeOpen ? 'down' : wallMode} />
      ))}

      {/* Maya's placed furniture items */}
      {placedObjects.map((obj) => (
        <PlacedFurnitureItem
          key={obj.instanceId}
          obj={obj}
          isNight={isNight}
          powerOff={bills.powerShutoff}
          isSelected={pieMenuObjectId === obj.instanceId}
          isActive={activeObjectId === obj.instanceId}
          isHiddenForMove={
            mode === 'build' && buildSelection?.movingInstanceId === obj.instanceId
          }
          onSelectObject={handleObjectSelect}
        />
      ))}

      {/* Interactive 3D Floor Messes (puddles, dirty dishes, trash piles) */}
      {messes.map((mess) => (
        <HouseholdMessMesh key={mess.id} mess={mess} onSelectMess={handleMessSelect} />
      ))}

      {/* 3 Enterable Neighbor Houses: Pitched Roof while locked, Cutaway Interior once invited in */}
      {NEIGHBOR_HOUSES.map((house) => {
        const isUnlocked = unlockedHouseIds.includes(house.id);
        const houseWallMode: WallViewMode = isUnlocked ? wallMode : 'up';
        const visibleWalls = isUnlocked
          ? house.walls
          : house.walls.filter((w) => w.side !== 'interior');

        return (
          <group key={house.id}>
            {/* Neighbor lot lawn curb */}
            <mesh
              position={[
                (house.lotRect.x1 + house.lotRect.x2 + 1) / 2 - LOT_SIZE / 2,
                -0.008,
                (house.lotRect.z1 + house.lotRect.z2 + 1) / 2 - LOT_SIZE / 2,
              ]}
              receiveShadow
            >
              <boxGeometry
                args={[
                  house.lotRect.x2 - house.lotRect.x1 + 1.2,
                  0.026,
                  house.lotRect.z2 - house.lotRect.z1 + 1.2,
                ]}
              />
              <meshStandardMaterial color="#83ae6e" roughness={0.92} />
            </mesh>

            {/* Porch / path always rendered; interior room slabs rendered once unlocked */}
            {house.rooms
              .filter((r) => isUnlocked || r.floorType === 'stone_patio')
              .map((room) => (
                <RoomFloorSlab key={room.id} room={room} onGroundClick={handleGroundClick} />
              ))}

            {/* Exterior + interior walls */}
            {visibleWalls.map((wall) => {
              const isLockedFrontDoor = !isUnlocked && wall.id === house.frontDoorWallId;
              return (
                <WallSegmentMesh
                  key={wall.id}
                  wall={wall}
                  wallMode={houseWallMode}
                  exteriorColor={house.exteriorColor}
                  doorColor={house.doorColor}
                  isLockedDoor={isLockedFrontDoor}
                  onDoorClick={
                    isLockedFrontDoor
                      ? (e) => {
                          if (shouldIgnoreTap()) return;
                          e.stopPropagation();
                          handleNeighborHouseSelect(house, e.point.clone().add(new THREE.Vector3(0, 0.8, 0)));
                        }
                      : undefined
                  }
                />
              );
            })}

            {/* Pitched roof while locked; full interior furniture once invited in */}
            {!isUnlocked ? (
              <NeighborHouseRoof house={house} onSelectHouse={handleNeighborHouseSelect} />
            ) : (
              house.objects.map((obj) => (
                <PlacedFurnitureItem
                  key={obj.instanceId}
                  obj={obj}
                  isNight={isNight}
                  isSelected={pieMenuObjectId === obj.instanceId}
                  isActive={activeObjectId === obj.instanceId}
                  isHiddenForMove={false}
                  onSelectObject={handleObjectSelect}
                />
              ))
            )}
          </group>
        );
      })}

      {/* Walk target feedback ripple */}
      <WalkRipple />
    </group>
  );
}
