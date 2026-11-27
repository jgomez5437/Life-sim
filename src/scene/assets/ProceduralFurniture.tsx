import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CatalogItem } from '../../types/game';

interface ProceduralFurnitureProps {
  item: CatalogItem;
  isActive?: boolean;
  isNight?: boolean;
  ghostState?: 'valid' | 'invalid';
}

export function ProceduralFurniture({
  item,
  isActive = false,
  isNight = false,
  ghostState,
}: ProceduralFurnitureProps) {
  const screenRef = useRef<THREE.MeshStandardMaterial>(null);
  const effectRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (screenRef.current && isActive) {
      const hue = (t * 0.08) % 1;
      screenRef.current.emissive.setHSL(0.54 + Math.sin(hue * Math.PI * 2) * 0.08, 0.72, 0.55);
      screenRef.current.emissiveIntensity = 0.85 + Math.sin(t * 4) * 0.15;
    }
    if (effectRef.current && isActive) {
      effectRef.current.position.y = Math.sin(t * 5) * 0.06;
      effectRef.current.rotation.y = t * 1.4;
    }
  });

  const ghostColor = ghostState === 'valid' ? '#25c678' : ghostState === 'invalid' ? '#e74c3c' : null;
  const mat = (color: string, roughness = 0.68, metalness = 0.05) =>
    ghostColor ? (
      <meshStandardMaterial
        color={ghostColor}
        transparent
        opacity={0.58}
        roughness={0.5}
      />
    ) : (
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    );

  const castShadow = !ghostState;
  const receiveShadow = !ghostState;

  switch (item.proceduralType) {
    case 'bed':
      return (
        <group>
          {/* Wooden bed frame */}
          <mesh position={[0, 0.18, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.82, 0.24, 1.9]} />
            {mat('#b38254', 0.75)}
          </mesh>
          {/* Headboard at north (-Z) */}
          <mesh position={[0, 0.62, -0.88]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.86, 0.92, 0.12]} />
            {mat('#9a6b42', 0.75)}
          </mesh>
          {/* Mattress */}
          <mesh position={[0, 0.36, 0.02]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.68, 0.22, 1.72]} />
            {mat(item.secondaryColor, 0.85)}
          </mesh>
          {/* Duvet / Quilt */}
          <mesh position={[0, 0.42, 0.26]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.72, 0.16, 1.24]} />
            {mat(item.primaryColor, 0.82)}
          </mesh>
          {/* Accent throw stripe */}
          <mesh position={[0, 0.48, 0.62]} castShadow={castShadow}>
            <boxGeometry args={[1.74, 0.07, 0.32]} />
            {mat('#df9b6d', 0.8)}
          </mesh>
          {/* Two plush pillows */}
          <mesh position={[-0.44, 0.52, -0.56]} castShadow={castShadow}>
            <boxGeometry args={[0.64, 0.16, 0.36]} />
            {mat('#ffffff', 0.9)}
          </mesh>
          <mesh position={[0.44, 0.52, -0.56]} castShadow={castShadow}>
            <boxGeometry args={[0.64, 0.16, 0.36]} />
            {mat('#ffffff', 0.9)}
          </mesh>
        </group>
      );

    case 'sofa':
      return (
        <group>
          {/* Legs */}
          {[-0.78, 0.78].map((lx) =>
            [-0.32, 0.32].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.08, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.04, 0.03, 0.16, 8]} />
                {mat('#7c5638')}
              </mesh>
            )),
          )}
          {/* Base & Seat Cushions */}
          <mesh position={[0, 0.28, 0.04]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.76, 0.24, 0.78]} />
            {mat(item.primaryColor, 0.85)}
          </mesh>
          {/* Backrest (-Z) */}
          <mesh position={[0, 0.58, -0.28]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.76, 0.52, 0.22]} />
            {mat(item.primaryColor, 0.85)}
          </mesh>
          {/* Left & Right Armrests */}
          <mesh position={[-0.82, 0.44, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.18, 0.38, 0.78]} />
            {mat(item.primaryColor, 0.85)}
          </mesh>
          <mesh position={[0.82, 0.44, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.18, 0.38, 0.78]} />
            {mat(item.primaryColor, 0.85)}
          </mesh>
          {/* Accent throw pillows */}
          <mesh position={[-0.56, 0.52, -0.08]} rotation={[0, 0.22, 0.15]} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.28, 0.12]} />
            {mat(item.secondaryColor, 0.9)}
          </mesh>
          <mesh position={[0.56, 0.52, -0.08]} rotation={[0, -0.22, -0.15]} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.28, 0.12]} />
            {mat('#7ab8ad', 0.9)}
          </mesh>
        </group>
      );

    case 'fridge':
      return (
        <group>
          {/* Main mint cabinet */}
          <mesh position={[0, 0.86, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.82, 1.72, 0.78]} />
            {mat(item.primaryColor, 0.32, 0.15)}
          </mesh>
          {/* Door divider groove */}
          <mesh position={[0, 1.15, 0.4]} castShadow={castShadow}>
            <boxGeometry args={[0.78, 0.03, 0.03]} />
            {mat('#5e9c8e', 0.4)}
          </mesh>
          {/* Chrome handles */}
          <mesh position={[-0.28, 1.4, 0.42]} castShadow={castShadow}>
            <boxGeometry args={[0.04, 0.28, 0.06]} />
            {mat('#dfe6e9', 0.2, 0.7)}
          </mesh>
          <mesh position={[-0.28, 0.78, 0.42]} castShadow={castShadow}>
            <boxGeometry args={[0.04, 0.4, 0.06]} />
            {mat('#dfe6e9', 0.2, 0.7)}
          </mesh>
        </group>
      );

    case 'stove':
      return (
        <group>
          {/* Range body */}
          <mesh position={[0, 0.44, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.88, 0.88, 0.82]} />
            {mat(item.primaryColor, 0.35, 0.18)}
          </mesh>
          {/* Oven glass window */}
          <mesh position={[0, 0.38, 0.42]}>
            <boxGeometry args={[0.62, 0.42, 0.03]} />
            {mat(item.secondaryColor, 0.2, 0.3)}
          </mesh>
          {/* Back splash panel */}
          <mesh position={[0, 0.98, -0.34]} castShadow={castShadow}>
            <boxGeometry args={[0.88, 0.24, 0.12]} />
            {mat(item.primaryColor, 0.35)}
          </mesh>
          {/* Burners */}
          {[
            [-0.22, -0.16],
            [0.22, -0.16],
            [-0.22, 0.18],
            [0.22, 0.18],
          ].map(([bx, bz], idx) => (
            <mesh key={idx} position={[bx, 0.895, bz]}>
              <cylinderGeometry args={[0.13, 0.13, 0.025, 16]} />
              {isActive && idx === 2 && !ghostState ? (
                <meshStandardMaterial color="#ff6b35" emissive="#ff5722" emissiveIntensity={1.6} />
              ) : (
                mat('#2d3436', 0.4, 0.5)
              )}
            </mesh>
          ))}
          {/* Cooking pot when active */}
          {isActive && !ghostState && (
            <group ref={effectRef} position={[-0.22, 0.96, 0.18]}>
              <mesh position={[0, 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.14, 0.12, 0.16, 14]} />
                <meshStandardMaterial color="#d48c55" metalness={0.4} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.55} />
              </mesh>
            </group>
          )}
        </group>
      );

    case 'coffee_station':
      return (
        <group>
          {/* Base kitchen cabinet */}
          <mesh position={[0, 0.43, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.92, 0.86, 0.84]} />
            {mat('#f2ede4', 0.6)}
          </mesh>
          {/* Butcher block countertop */}
          <mesh position={[0, 0.88, 0.02]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.96, 0.07, 0.88]} />
            {mat(item.primaryColor, 0.65)}
          </mesh>
          {/* Espresso machine body */}
          <mesh position={[-0.14, 1.08, -0.1]} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.34, 0.28]} />
            {mat(item.secondaryColor, 0.3, 0.45)}
          </mesh>
          {/* Brass trim + ceramic mug */}
          <mesh position={[-0.14, 1.0, 0.08]} castShadow={castShadow}>
            <cylinderGeometry args={[0.05, 0.045, 0.1, 10]} />
            {mat('#e07a5f', 0.4)}
          </mesh>
          <mesh position={[0.24, 0.97, 0.05]} castShadow={castShadow}>
            <cylinderGeometry args={[0.07, 0.06, 0.12, 10]} />
            {mat('#8fc1b5', 0.45)}
          </mesh>
        </group>
      );

    case 'dining_table':
      return (
        <group>
          {/* Tabletop */}
          <mesh position={[0, 0.74, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.64, 0.09, 0.84]} />
            {mat(item.primaryColor, 0.62)}
          </mesh>
          {/* Table legs */}
          {[-0.72, 0.72].map((lx) =>
            [-0.32, 0.32].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.37, lz]} castShadow={castShadow}>
                <boxGeometry args={[0.08, 0.74, 0.08]} />
                {mat('#9c6e44', 0.7)}
              </mesh>
            )),
          )}
          {/* Two tucked chairs */}
          {[-0.42, 0.42].map((cx, i) => (
            <group key={i} position={[cx, 0, i === 0 ? 0.36 : -0.36]}>
              <mesh position={[0, 0.42, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.42, 0.07, 0.4]} />
                {mat(item.secondaryColor, 0.8)}
              </mesh>
              <mesh position={[0, 0.68, i === 0 ? 0.18 : -0.18]} castShadow={castShadow}>
                <boxGeometry args={[0.42, 0.46, 0.06]} />
                {mat('#a8794f', 0.72)}
              </mesh>
            </group>
          ))}
          {/* Centerpiece fruit bowl */}
          <mesh position={[0, 0.83, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.16, 0.1, 0.09, 14]} />
            {mat('#f7f2e7', 0.4)}
          </mesh>
        </group>
      );

    case 'tv_stand':
      return (
        <group>
          {/* Mid-century media console */}
          <mesh position={[0, 0.28, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.72, 0.42, 0.56]} />
            {mat(item.primaryColor, 0.65)}
          </mesh>
          {/* TV Stand Pedestal */}
          <mesh position={[0, 0.56, -0.02]} castShadow={castShadow}>
            <boxGeometry args={[0.26, 0.16, 0.14]} />
            {mat('#2c3338', 0.4, 0.4)}
          </mesh>
          {/* Bezel */}
          <mesh position={[0, 0.96, -0.02]} castShadow={castShadow}>
            <boxGeometry args={[1.42, 0.76, 0.07]} />
            {mat(item.secondaryColor, 0.3, 0.35)}
          </mesh>
          {/* Screen facing +Z */}
          <mesh position={[0, 0.96, 0.02]}>
            <planeGeometry args={[1.32, 0.66]} />
            {ghostColor ? (
              <meshStandardMaterial color={ghostColor} transparent opacity={0.55} />
            ) : (
              <meshStandardMaterial
                ref={screenRef}
                color={isActive ? '#48cae4' : '#1b242c'}
                emissive={isActive ? '#38bdf8' : '#000000'}
                emissiveIntensity={isActive ? 0.9 : 0}
                roughness={0.2}
              />
            )}
          </mesh>
        </group>
      );

    case 'bookshelf':
      return (
        <group>
          {/* Frame */}
          <mesh position={[0, 0.88, -0.06]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.84, 1.76, 0.42]} />
            {mat(item.primaryColor, 0.72)}
          </mesh>
          {/* Colorful book rows */}
          {[0.38, 0.82, 1.26, 1.56].map((y, row) => (
            <group key={row} position={[0, y, 0.04]}>
              <mesh position={[-0.22, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.18, 0.24, 0.24]} />
                {mat(row % 2 === 0 ? '#3e8e7e' : '#e07a5f', 0.7)}
              </mesh>
              <mesh position={[0.02, 0.01, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.22, 0.26, 0.24]} />
                {mat(row % 2 === 0 ? '#f2cc8f' : '#5e81ac', 0.7)}
              </mesh>
              <mesh position={[0.25, -0.01, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.16, 0.22, 0.24]} />
                {mat('#d96b6b', 0.7)}
              </mesh>
            </group>
          ))}
        </group>
      );

    case 'toilet':
      return (
        <group>
          {/* Pedestal base */}
          <mesh position={[0, 0.2, 0.06]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.22, 0.17, 0.4, 16]} />
            {mat(item.primaryColor, 0.25)}
          </mesh>
          {/* Bowl seat */}
          <mesh position={[0, 0.42, 0.08]} castShadow={castShadow}>
            <cylinderGeometry args={[0.25, 0.23, 0.06, 16]} />
            {mat('#ffffff', 0.2)}
          </mesh>
          {/* Tank (-Z) */}
          <mesh position={[0, 0.58, -0.22]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.46, 0.56, 0.24]} />
            {mat(item.primaryColor, 0.25)}
          </mesh>
        </group>
      );

    case 'shower':
      return (
        <group>
          {/* Tray */}
          <mesh position={[0, 0.06, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.92, 0.12, 0.92]} />
            {mat('#eef4f5', 0.35)}
          </mesh>
          {/* Back tiled wall (-Z) */}
          <mesh position={[0, 1.05, -0.42]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.9, 1.9, 0.06]} />
            {mat(item.secondaryColor, 0.35)}
          </mesh>
          {/* Side glass panels */}
          <mesh position={[-0.43, 1.02, 0]}>
            <boxGeometry args={[0.04, 1.84, 0.88]} />
            <meshStandardMaterial
              color={ghostColor ?? '#bfe6ea'}
              transparent
              opacity={ghostColor ? 0.5 : 0.34}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0.43, 1.02, 0]}>
            <boxGeometry args={[0.04, 1.84, 0.88]} />
            <meshStandardMaterial
              color={ghostColor ?? '#bfe6ea'}
              transparent
              opacity={ghostColor ? 0.5 : 0.34}
              roughness={0.12}
            />
          </mesh>
          {/* Rain showerhead */}
          <mesh position={[0, 1.86, -0.18]} castShadow={castShadow}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 14]} />
            {mat('#cfd8dc', 0.2, 0.8)}
          </mesh>
          {/* Steamy shower droplets when active */}
          {isActive && !ghostState && (
            <group ref={effectRef} position={[0, 1.25, -0.05]}>
              {[-0.12, 0, 0.12].map((dx, i) => (
                <mesh key={i} position={[dx, 0, (i - 1) * 0.08]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.95, 6]} />
                  <meshStandardMaterial color="#b4ecff" transparent opacity={0.55} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      );

    case 'sink':
      return (
        <group>
          {/* Vanity cabinet */}
          <mesh position={[0, 0.4, -0.06]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.74, 0.8, 0.54]} />
            {mat(item.secondaryColor, 0.55)}
          </mesh>
          {/* Ceramic basin top */}
          <mesh position={[0, 0.82, -0.05]} castShadow={castShadow}>
            <boxGeometry args={[0.78, 0.08, 0.58]} />
            {mat(item.primaryColor, 0.22)}
          </mesh>
          {/* Faucet */}
          <mesh position={[0, 0.94, -0.22]} castShadow={castShadow}>
            <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
            {mat('#cfd8dc', 0.2, 0.8)}
          </mesh>
          {/* Wall mirror */}
          <mesh position={[0, 1.44, -0.32]} castShadow={castShadow}>
            <boxGeometry args={[0.62, 0.72, 0.05]} />
            {mat('#d7eef2', 0.1, 0.6)}
          </mesh>
        </group>
      );

    case 'plant':
      return (
        <group>
          {/* Terracotta pot */}
          <mesh position={[0, 0.22, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.24, 0.18, 0.44, 14]} />
            {mat(item.secondaryColor, 0.75)}
          </mesh>
          {/* Soil */}
          <mesh position={[0, 0.43, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.04, 12]} />
            {mat('#5a4332', 0.95)}
          </mesh>
          {/* Layered monstera leaves */}
          {[
            [0, 0.68, 0, 0.24],
            [-0.18, 0.78, 0.12, 0.18],
            [0.2, 0.82, -0.08, 0.19],
            [0.05, 0.94, 0.16, 0.16],
            [-0.14, 0.86, -0.16, 0.17],
          ].map(([lx, ly, lz, r], idx) => (
            <mesh key={idx} position={[lx, ly, lz]} castShadow={castShadow}>
              <dodecahedronGeometry args={[r, 0]} />
              {mat(idx % 2 === 0 ? item.primaryColor : '#51ad75', 0.65)}
            </mesh>
          ))}
        </group>
      );

    case 'rug':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.86, 0.03, 1.86]} />
            {mat(item.primaryColor, 0.92)}
          </mesh>
          <mesh position={[0, 0.038, 0]} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.52, 0.01, 1.52]} />
            {mat(item.secondaryColor, 0.92)}
          </mesh>
          <mesh position={[0, 0.045, 0]} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.1, 0.01, 1.1]} />
            {mat('#f7f0e2', 0.92)}
          </mesh>
        </group>
      );

    case 'floor_lamp':
      return (
        <group>
          {/* Base */}
          <mesh position={[0, 0.04, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.2, 0.22, 0.08, 16]} />
            {mat(item.secondaryColor, 0.5)}
          </mesh>
          {/* Stem */}
          <mesh position={[0, 0.76, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.03, 0.035, 1.4, 10]} />
            {mat(item.secondaryColor, 0.5)}
          </mesh>
          {/* Warm linen shade */}
          <mesh position={[0, 1.48, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.17, 0.26, 0.36, 16]} />
            {ghostColor ? (
              <meshStandardMaterial color={ghostColor} transparent opacity={0.58} />
            ) : (
              <meshStandardMaterial
                color={item.primaryColor}
                emissive={isNight ? '#ffbe6b' : '#ffe3b3'}
                emissiveIntensity={isNight ? 1.1 : 0.15}
                roughness={0.7}
              />
            )}
          </mesh>
          {isNight && !ghostState && (
            <pointLight
              position={[0, 1.45, 0]}
              color="#ffd28c"
              intensity={4.2}
              distance={6.5}
              decay={2}
            />
          )}
        </group>
      );
  }
}
