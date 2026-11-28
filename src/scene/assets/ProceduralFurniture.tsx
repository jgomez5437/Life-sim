import { useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CatalogItem } from '../../types/game';

interface ProceduralFurnitureProps {
  item: CatalogItem;
  isActive?: boolean;
  isNight?: boolean;
  powerOff?: boolean;
  ghostState?: 'valid' | 'invalid';
}

function GroundShadowPad({ w, d }: { w: number; d: number }) {
  return (
    <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color="#182226" transparent opacity={0.14} depthWrite={false} />
    </mesh>
  );
}

export function ProceduralFurniture({
  item,
  isActive = false,
  isNight = false,
  powerOff = false,
  ghostState,
}: ProceduralFurnitureProps) {
  const screenRef = useRef<THREE.MeshStandardMaterial>(null);
  const effectRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (screenRef.current && isActive && !powerOff) {
      const hue = (t * 0.08) % 1;
      screenRef.current.emissive.setHSL(0.54 + Math.sin(hue * Math.PI * 2) * 0.08, 0.72, 0.55);
      screenRef.current.emissiveIntensity = 0.85 + Math.sin(t * 4) * 0.15;
    }
    if (effectRef.current && isActive) {
      effectRef.current.position.y = Math.sin(t * 5) * 0.06;
      effectRef.current.rotation.y = t * 1.4;
    }
  });

  const ghostColor =
    ghostState === 'valid' ? '#25c678' : ghostState === 'invalid' ? '#e74c3c' : null;

  const mat = (color: string, roughness = 0.65, metalness = 0.06) =>
    ghostColor ? (
      <meshStandardMaterial color={ghostColor} transparent opacity={0.56} roughness={0.5} />
    ) : (
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    );

  const mirrorMat = () =>
    ghostColor ? (
      <meshStandardMaterial color={ghostColor} transparent opacity={0.56} />
    ) : (
      <meshStandardMaterial color="#e8f5fa" roughness={0.05} metalness={0.94} />
    );

  const castShadow = !ghostState;
  const receiveShadow = !ghostState;

  switch (item.proceduralType) {
    case 'bed':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={1.92} d={1.96} />}
          {/* Tapered legs */}
          {[-0.82, 0.82].map((lx) =>
            [-0.86, 0.86].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.08, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.042, 0.028, 0.16, 10]} />
                {mat('#8d5f39', 0.7)}
              </mesh>
            )),
          )}
          {/* Beveled wood frame */}
          <RoundedBox
            args={[1.84, 0.22, 1.92]}
            radius={0.04}
            smoothness={3}
            position={[0, 0.21, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat('#b38254', 0.68)}
          </RoundedBox>
          {/* Rounded headboard */}
          <RoundedBox
            args={[1.88, 0.94, 0.13]}
            radius={0.05}
            smoothness={3}
            position={[0, 0.64, -0.89]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat('#9a6b42', 0.66)}
          </RoundedBox>
          {/* Upholstered headboard cushion */}
          <RoundedBox
            args={[1.66, 0.56, 0.08]}
            radius={0.035}
            smoothness={3}
            position={[0, 0.72, -0.81]}
            castShadow={castShadow}
          >
            {mat('#e8dfd1', 0.86)}
          </RoundedBox>
          {/* Plush mattress */}
          <RoundedBox
            args={[1.7, 0.22, 1.74]}
            radius={0.06}
            smoothness={3}
            position={[0, 0.37, 0.02]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.secondaryColor, 0.86)}
          </RoundedBox>
          {/* Soft quilted duvet */}
          <RoundedBox
            args={[1.76, 0.18, 1.24]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.43, 0.28]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.84)}
          </RoundedBox>
          {/* Folded throw blanket */}
          <RoundedBox
            args={[1.78, 0.09, 0.34]}
            radius={0.04}
            smoothness={3}
            position={[0, 0.48, 0.64]}
            castShadow={castShadow}
          >
            {mat('#df9b6d', 0.84)}
          </RoundedBox>
          {/* Two puffy rounded pillows */}
          <RoundedBox
            args={[0.66, 0.17, 0.38]}
            radius={0.075}
            smoothness={3}
            position={[-0.44, 0.53, -0.56]}
            rotation={[0.14, 0, 0]}
            castShadow={castShadow}
          >
            {mat('#ffffff', 0.88)}
          </RoundedBox>
          <RoundedBox
            args={[0.66, 0.17, 0.38]}
            radius={0.075}
            smoothness={3}
            position={[0.44, 0.53, -0.56]}
            rotation={[0.14, 0, 0]}
            castShadow={castShadow}
          >
            {mat('#ffffff', 0.88)}
          </RoundedBox>
        </group>
      );

    case 'sofa':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={1.88} d={0.92} />}
          {/* Tapered wood legs */}
          {[-0.78, 0.78].map((lx) =>
            [-0.32, 0.32].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.08, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.04, 0.025, 0.16, 10]} />
                {mat('#7c5638', 0.68)}
              </mesh>
            )),
          )}
          {/* Wood plinth trim */}
          <RoundedBox args={[1.78, 0.08, 0.8]} radius={0.02} position={[0, 0.17, 0.02]} castShadow={castShadow}>
            {mat('#946742', 0.68)}
          </RoundedBox>
          {/* Twin plump seat cushions */}
          {[-0.4, 0.4].map((cx, i) => (
            <RoundedBox
              key={i}
              args={[0.78, 0.2, 0.74]}
              radius={0.075}
              smoothness={3}
              position={[cx, 0.3, 0.05]}
              castShadow={castShadow}
              receiveShadow={receiveShadow}
            >
              {mat(item.primaryColor, 0.86)}
            </RoundedBox>
          ))}
          {/* Curved backrest cushions */}
          <RoundedBox
            args={[1.76, 0.54, 0.24]}
            radius={0.08}
            smoothness={3}
            position={[0, 0.58, -0.28]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.86)}
          </RoundedBox>
          {/* Rounded armrests */}
          {[-0.82, 0.82].map((ax, i) => (
            <RoundedBox
              key={i}
              args={[0.2, 0.4, 0.82]}
              radius={0.075}
              smoothness={3}
              position={[ax, 0.43, 0.04]}
              castShadow={castShadow}
            >
              {mat(item.primaryColor, 0.86)}
            </RoundedBox>
          ))}
          {/* Accent throw pillows */}
          <RoundedBox
            args={[0.32, 0.3, 0.13]}
            radius={0.055}
            smoothness={3}
            position={[-0.56, 0.52, -0.07]}
            rotation={[0, 0.22, 0.14]}
            castShadow={castShadow}
          >
            {mat(item.secondaryColor, 0.9)}
          </RoundedBox>
          <RoundedBox
            args={[0.32, 0.3, 0.13]}
            radius={0.055}
            smoothness={3}
            position={[0.56, 0.52, -0.07]}
            rotation={[0, -0.22, -0.14]}
            castShadow={castShadow}
          >
            {mat('#7ab8ad', 0.9)}
          </RoundedBox>
        </group>
      );

    case 'dresser':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.94} d={0.68} />}
          {/* Tapered legs */}
          {[-0.36, 0.36].map((lx) =>
            [-0.22, 0.22].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.08, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.032, 0.02, 0.16, 10]} />
                {mat('#7c5638', 0.65)}
              </mesh>
            )),
          )}
          {/* Main oak cabinet */}
          <RoundedBox
            args={[0.88, 0.86, 0.58]}
            radius={0.035}
            smoothness={3}
            position={[0, 0.58, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.62)}
          </RoundedBox>
          {/* Three beveled drawer fronts + brass pulls */}
          {[0.32, 0.58, 0.84].map((dy, i) => (
            <group key={i} position={[0, dy, 0.295]}>
              <RoundedBox args={[0.78, 0.22, 0.03]} radius={0.012} castShadow={castShadow}>
                {mat('#c79664', 0.58)}
              </RoundedBox>
              <mesh position={[0, 0, 0.026]} castShadow={castShadow}>
                <boxGeometry args={[0.2, 0.024, 0.024]} />
                {mat(item.secondaryColor, 0.22, 0.78)}
              </mesh>
            </group>
          ))}
          {/* Ceramic vase & trinket tray on top */}
          <mesh position={[-0.24, 1.11, -0.04]} castShadow={castShadow}>
            <cylinderGeometry args={[0.055, 0.075, 0.2, 14]} />
            {mat('#79b4a9', 0.3)}
          </mesh>
          <RoundedBox args={[0.24, 0.025, 0.16]} radius={0.01} position={[0.18, 1.025, 0.02]}>
            {mat('#f5ede0', 0.4)}
          </RoundedBox>
        </group>
      );

    case 'mirror':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.74} d={0.52} />}
          {/* Rear brushed-brass kickstand */}
          <mesh position={[0, 0.68, -0.18]} rotation={[0.26, 0, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.018, 0.018, 1.38, 10]} />
            {mat(item.primaryColor, 0.26, 0.8)}
          </mesh>
          {/* Tilted full-length arch mirror frame */}
          <group position={[0, 0.88, 0.02]} rotation={[-0.08, 0, 0]}>
            {/* Rectangular lower brass frame */}
            <RoundedBox args={[0.64, 1.32, 0.05]} radius={0.024} position={[0, -0.14, 0]} castShadow={castShadow}>
              {mat(item.primaryColor, 0.24, 0.82)}
            </RoundedBox>
            {/* Arched top brass crown */}
            <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={castShadow}>
              <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
              {mat(item.primaryColor, 0.24, 0.82)}
            </mesh>
            {/* Reflective mirror glass */}
            <mesh position={[0, -0.14, 0.028]}>
              <planeGeometry args={[0.56, 1.24]} />
              {mirrorMat()}
            </mesh>
            <mesh position={[0, 0.48, 0.028]}>
              <circleGeometry args={[0.28, 24]} />
              {mirrorMat()}
            </mesh>
          </group>
        </group>
      );

    case 'fridge':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.9} d={0.86} />}
          {/* Rounded retro fridge cabinet */}
          <RoundedBox
            args={[0.84, 1.72, 0.78]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.88, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.24, 0.16)}
          </RoundedBox>
          {/* Door seal groove */}
          <mesh position={[0, 1.16, 0.395]}>
            <boxGeometry args={[0.78, 0.028, 0.02]} />
            {mat('#5a988a', 0.4)}
          </mesh>
          {/* Retro chrome badge */}
          <mesh position={[0, 1.54, 0.4]}>
            <boxGeometry args={[0.24, 0.036, 0.015]} />
            {mat('#eef4f7', 0.15, 0.88)}
          </mesh>
          {/* Sculpted chrome handles */}
          <RoundedBox args={[0.045, 0.28, 0.07]} radius={0.018} position={[-0.28, 1.4, 0.42]} castShadow={castShadow}>
            {mat('#e8eef2', 0.14, 0.88)}
          </RoundedBox>
          <RoundedBox args={[0.045, 0.42, 0.07]} radius={0.018} position={[-0.28, 0.78, 0.42]} castShadow={castShadow}>
            {mat('#e8eef2', 0.14, 0.88)}
          </RoundedBox>
        </group>
      );

    case 'stove':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.94} d={0.88} />}
          {/* Range cabinet */}
          <RoundedBox
            args={[0.88, 0.88, 0.82]}
            radius={0.03}
            smoothness={3}
            position={[0, 0.44, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.3, 0.18)}
          </RoundedBox>
          {/* Oven glass door + handle */}
          <RoundedBox args={[0.64, 0.42, 0.03]} radius={0.015} position={[0, 0.38, 0.415]}>
            {isActive && !ghostState ? (
              <meshStandardMaterial color="#423226" emissive="#ff9234" emissiveIntensity={0.45} roughness={0.15} />
            ) : (
              mat(item.secondaryColor, 0.15, 0.4)
            )}
          </RoundedBox>
          <RoundedBox args={[0.58, 0.035, 0.05]} radius={0.015} position={[0, 0.65, 0.435]}>
            {mat('#dfe6ea', 0.16, 0.85)}
          </RoundedBox>
          {/* Control knobs */}
          {[-0.26, -0.09, 0.09, 0.26].map((kx, i) => (
            <mesh key={i} position={[kx, 0.78, 0.425]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.03, 12]} />
              {mat('#2f353b', 0.3, 0.6)}
            </mesh>
          ))}
          {/* Back splash panel */}
          <RoundedBox args={[0.88, 0.26, 0.11]} radius={0.025} position={[0, 0.99, -0.35]} castShadow={castShadow}>
            {mat(item.primaryColor, 0.3)}
          </RoundedBox>
          {/* Cast-iron burners */}
          {[
            [-0.22, -0.16],
            [0.22, -0.16],
            [-0.22, 0.18],
            [0.22, 0.18],
          ].map(([bx, bz], idx) => (
            <mesh key={idx} position={[bx, 0.895, bz]}>
              <cylinderGeometry args={[0.135, 0.135, 0.028, 18]} />
              {isActive && idx === 2 && !ghostState ? (
                <meshStandardMaterial color="#ff6b35" emissive="#ff5722" emissiveIntensity={1.65} />
              ) : (
                mat('#2d3436', 0.38, 0.55)
              )}
            </mesh>
          ))}
          {/* Active sizzling copper pot + rising steam */}
          {isActive && !ghostState && (
            <group ref={effectRef} position={[-0.22, 0.96, 0.18]}>
              <mesh position={[0, 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.145, 0.125, 0.16, 16]} />
                <meshStandardMaterial color="#d48c55" metalness={0.55} roughness={0.24} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <sphereGeometry args={[0.07, 10, 10]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.55} />
              </mesh>
              <mesh position={[0.04, 0.4, -0.02]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
              </mesh>
            </group>
          )}
        </group>
      );

    case 'coffee_station':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.96} d={0.9} />}
          <RoundedBox
            args={[0.92, 0.86, 0.84]}
            radius={0.025}
            position={[0, 0.43, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat('#f2ede4', 0.58)}
          </RoundedBox>
          <RoundedBox
            args={[0.96, 0.075, 0.88]}
            radius={0.02}
            position={[0, 0.885, 0.02]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.58)}
          </RoundedBox>
          <RoundedBox args={[0.31, 0.35, 0.28]} radius={0.03} position={[-0.14, 1.09, -0.1]} castShadow={castShadow}>
            {mat(item.secondaryColor, 0.25, 0.52)}
          </RoundedBox>
          {/* Brass portafilter bar */}
          <mesh position={[-0.14, 1.12, 0.08]}>
            <boxGeometry args={[0.16, 0.03, 0.06]} />
            {mat('#d4af6a', 0.22, 0.82)}
          </mesh>
          <mesh position={[-0.14, 0.99, 0.08]} castShadow={castShadow}>
            <cylinderGeometry args={[0.05, 0.045, 0.1, 12]} />
            {mat('#e07a5f', 0.32)}
          </mesh>
          <mesh position={[0.24, 0.98, 0.05]} castShadow={castShadow}>
            <cylinderGeometry args={[0.07, 0.06, 0.13, 12]} />
            {mat('#8fc1b5', 0.35)}
          </mesh>
        </group>
      );

    case 'dining_table':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={1.76} d={1.1} />}
          <RoundedBox
            args={[1.66, 0.09, 0.86]}
            radius={0.03}
            smoothness={3}
            position={[0, 0.74, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.56)}
          </RoundedBox>
          {[-0.72, 0.72].map((lx) =>
            [-0.32, 0.32].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.37, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.04, 0.028, 0.74, 10]} />
                {mat('#9c6e44', 0.65)}
              </mesh>
            )),
          )}
          {[-0.42, 0.42].map((cx, i) => (
            <group key={i} position={[cx, 0, i === 0 ? 0.36 : -0.36]}>
              <RoundedBox args={[0.42, 0.075, 0.4]} radius={0.028} position={[0, 0.42, 0]} castShadow={castShadow}>
                {mat(item.secondaryColor, 0.82)}
              </RoundedBox>
              <RoundedBox
                args={[0.42, 0.46, 0.065]}
                radius={0.025}
                position={[0, 0.68, i === 0 ? 0.18 : -0.18]}
                castShadow={castShadow}
              >
                {mat('#a8794f', 0.66)}
              </RoundedBox>
            </group>
          ))}
          {/* Ceramic fruit bowl with oranges */}
          <mesh position={[0, 0.83, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.16, 0.1, 0.09, 16]} />
            {mat('#f7f2e7', 0.3)}
          </mesh>
          <mesh position={[-0.04, 0.89, 0.02]} castShadow={castShadow}>
            <sphereGeometry args={[0.042, 10, 10]} />
            {mat('#f29c46', 0.45)}
          </mesh>
          <mesh position={[0.05, 0.89, -0.02]} castShadow={castShadow}>
            <sphereGeometry args={[0.038, 10, 10]} />
            {mat('#8cc45c', 0.45)}
          </mesh>
        </group>
      );

    case 'tv_stand':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={1.82} d={0.68} />}
          {[-0.74, 0.74].map((lx) =>
            [-0.2, 0.2].map((lz) => (
              <mesh key={`${lx}_${lz}`} position={[lx, 0.06, lz]} castShadow={castShadow}>
                <cylinderGeometry args={[0.03, 0.02, 0.12, 8]} />
                {mat('#6e533c', 0.68)}
              </mesh>
            )),
          )}
          <RoundedBox
            args={[1.74, 0.38, 0.56]}
            radius={0.03}
            position={[0, 0.3, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.6)}
          </RoundedBox>
          <mesh position={[0, 0.56, -0.02]} castShadow={castShadow}>
            <boxGeometry args={[0.26, 0.16, 0.14]} />
            {mat('#2c3338', 0.35, 0.5)}
          </mesh>
          <RoundedBox args={[1.44, 0.78, 0.065]} radius={0.024} position={[0, 0.96, -0.02]} castShadow={castShadow}>
            {mat(item.secondaryColor, 0.25, 0.42)}
          </RoundedBox>
          <mesh position={[0, 0.96, 0.018]}>
            <planeGeometry args={[1.34, 0.68]} />
            {ghostColor ? (
              <meshStandardMaterial color={ghostColor} transparent opacity={0.55} />
            ) : (
              <meshStandardMaterial
                ref={screenRef}
                color={isActive ? '#48cae4' : '#18222a'}
                emissive={isActive ? '#38bdf8' : '#000000'}
                emissiveIntensity={isActive ? 0.9 : 0}
                roughness={0.12}
                metalness={0.35}
              />
            )}
          </mesh>
        </group>
      );

    case 'bookshelf':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.9} d={0.52} />}
          <RoundedBox
            args={[0.84, 1.76, 0.42]}
            radius={0.028}
            position={[0, 0.88, -0.06]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.66)}
          </RoundedBox>
          {[0.38, 0.82, 1.26, 1.56].map((y, row) => (
            <group key={row} position={[0, y, 0.05]}>
              <RoundedBox args={[0.18, 0.24, 0.24]} radius={0.012} position={[-0.22, 0, 0]} castShadow={castShadow}>
                {mat(row % 2 === 0 ? '#3e8e7e' : '#e07a5f', 0.68)}
              </RoundedBox>
              <RoundedBox args={[0.22, 0.26, 0.24]} radius={0.012} position={[0.02, 0.01, 0]} castShadow={castShadow}>
                {mat(row % 2 === 0 ? '#f2cc8f' : '#5e81ac', 0.68)}
              </RoundedBox>
              <RoundedBox
                args={[0.16, 0.22, 0.24]}
                radius={0.012}
                position={[0.25, -0.01, 0]}
                rotation={[0, 0, row === 1 ? 0.14 : 0]}
                castShadow={castShadow}
              >
                {mat('#d96b6b', 0.68)}
              </RoundedBox>
            </group>
          ))}
        </group>
      );

    case 'toilet':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.62} d={0.76} />}
          <mesh position={[0, 0.2, 0.06]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.22, 0.17, 0.4, 18]} />
            {mat(item.primaryColor, 0.16, 0.08)}
          </mesh>
          <mesh position={[0, 0.42, 0.08]} castShadow={castShadow}>
            <cylinderGeometry args={[0.25, 0.23, 0.06, 18]} />
            {mat('#ffffff', 0.14, 0.08)}
          </mesh>
          <RoundedBox
            args={[0.46, 0.56, 0.24]}
            radius={0.04}
            position={[0, 0.58, -0.22]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.primaryColor, 0.16, 0.08)}
          </RoundedBox>
          {/* Chrome flush button */}
          <mesh position={[0, 0.87, -0.22]}>
            <cylinderGeometry args={[0.035, 0.035, 0.02, 12]} />
            {mat('#e3ebee', 0.12, 0.9)}
          </mesh>
        </group>
      );

    case 'shower':
      return (
        <group>
          <RoundedBox
            args={[0.92, 0.12, 0.92]}
            radius={0.02}
            position={[0, 0.06, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat('#f2f7f8', 0.24)}
          </RoundedBox>
          <mesh position={[0, 1.05, -0.42]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.9, 1.9, 0.06]} />
            {mat(item.secondaryColor, 0.28)}
          </mesh>
          {/* Sleek tempered glass panels with metallic framing */}
          {[-0.43, 0.43].map((gx, i) => (
            <mesh key={i} position={[gx, 1.02, 0]}>
              <boxGeometry args={[0.035, 1.84, 0.88]} />
              <meshPhysicalMaterial
                color={ghostColor ?? '#cdeef2'}
                transparent
                opacity={ghostColor ? 0.5 : 0.3}
                roughness={0.08}
                metalness={0.12}
                clearcoat={1}
              />
            </mesh>
          ))}
          {/* Chrome rain showerhead & mixer */}
          <mesh position={[0, 1.86, -0.18]} castShadow={castShadow}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
            {mat('#e2eaed', 0.12, 0.9)}
          </mesh>
          <mesh position={[0, 1.12, -0.37]}>
            <cylinderGeometry args={[0.04, 0.04, 0.05, 12]} />
            {mat('#e2eaed', 0.12, 0.9)}
          </mesh>
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
          {!ghostState && <GroundShadowPad w={0.8} d={0.62} />}
          <RoundedBox
            args={[0.74, 0.8, 0.54]}
            radius={0.025}
            position={[0, 0.4, -0.06]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            {mat(item.secondaryColor, 0.5)}
          </RoundedBox>
          <RoundedBox args={[0.78, 0.08, 0.58]} radius={0.025} position={[0, 0.82, -0.05]} castShadow={castShadow}>
            {mat(item.primaryColor, 0.16, 0.08)}
          </RoundedBox>
          {/* Curved chrome faucet + soap pump */}
          <mesh position={[0, 0.94, -0.22]} castShadow={castShadow}>
            <cylinderGeometry args={[0.028, 0.028, 0.18, 10]} />
            {mat('#e2eaed', 0.12, 0.9)}
          </mesh>
          <mesh position={[0.24, 0.92, -0.14]} castShadow={castShadow}>
            <cylinderGeometry args={[0.036, 0.036, 0.11, 10]} />
            {mat('#e08b63', 0.3)}
          </mesh>
          {/* Brass-trimmed reflective vanity mirror */}
          <RoundedBox args={[0.66, 0.76, 0.045]} radius={0.025} position={[0, 1.46, -0.32]} castShadow={castShadow}>
            {mat('#d4af6a', 0.24, 0.82)}
          </RoundedBox>
          <mesh position={[0, 1.46, -0.294]}>
            <planeGeometry args={[0.58, 0.68]} />
            {mirrorMat()}
          </mesh>
        </group>
      );

    case 'plant':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.56} d={0.56} />}
          {/* Rimmed terracotta planter */}
          <mesh position={[0, 0.21, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.23, 0.17, 0.42, 16]} />
            {mat(item.secondaryColor, 0.72)}
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.255, 0.245, 0.07, 16]} />
            {mat(item.secondaryColor, 0.72)}
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.04, 14]} />
            {mat('#5a4332', 0.95)}
          </mesh>
          {/* Organic arched stems + sculpted botanical leaves */}
          {[
            { angle: 0.2, tilt: 0.45, h: 0.46, s: 1.05, c: item.primaryColor },
            { angle: 1.45, tilt: 0.55, h: 0.42, s: 0.95, c: '#4ea971' },
            { angle: 2.65, tilt: 0.5, h: 0.52, s: 1.1, c: item.primaryColor },
            { angle: 3.9, tilt: 0.48, h: 0.44, s: 0.92, c: '#58b47b' },
            { angle: 5.15, tilt: 0.58, h: 0.38, s: 0.88, c: '#3a8c5c' },
          ].map((leaf, idx) => (
            <group key={idx} position={[0, 0.43, 0]} rotation={[0, leaf.angle, 0]}>
              <mesh position={[0, leaf.h * 0.48, 0.06]} rotation={[leaf.tilt * 0.45, 0, 0]} castShadow={castShadow}>
                <cylinderGeometry args={[0.012, 0.016, leaf.h, 6]} />
                {mat('#367c52', 0.7)}
              </mesh>
              <mesh
                position={[0, leaf.h, 0.18]}
                rotation={[leaf.tilt + 0.55, 0, 0]}
                scale={[0.17 * leaf.s, 0.22 * leaf.s, 0.025]}
                castShadow={castShadow}
              >
                <sphereGeometry args={[1, 12, 10]} />
                {mat(leaf.c, 0.55)}
              </mesh>
            </group>
          ))}
        </group>
      );

    case 'rug':
      return (
        <group>
          <RoundedBox args={[1.88, 0.028, 1.88]} radius={0.01} position={[0, 0.016, 0]} receiveShadow={receiveShadow}>
            {mat(item.primaryColor, 0.92)}
          </RoundedBox>
          <mesh position={[0, 0.032, 0]} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.54, 0.008, 1.54]} />
            {mat(item.secondaryColor, 0.92)}
          </mesh>
          <mesh position={[0, 0.038, 0]} receiveShadow={receiveShadow}>
            <boxGeometry args={[1.12, 0.008, 1.12]} />
            {mat('#f7f0e2', 0.92)}
          </mesh>
        </group>
      );

    case 'floor_lamp':
      return (
        <group>
          {!ghostState && <GroundShadowPad w={0.5} d={0.5} />}
          <mesh position={[0, 0.04, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <cylinderGeometry args={[0.2, 0.22, 0.08, 18]} />
            {mat(item.secondaryColor, 0.4)}
          </mesh>
          <mesh position={[0, 0.76, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.026, 0.032, 1.4, 12]} />
            {mat('#c8a366', 0.28, 0.75)}
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.17, 0.26, 0.36, 20]} />
            {ghostColor ? (
              <meshStandardMaterial color={ghostColor} transparent opacity={0.58} />
            ) : (
              <meshStandardMaterial
                color={powerOff ? '#c7beac' : item.primaryColor}
                emissive={powerOff ? '#000000' : isNight ? '#ffbe6b' : '#ffe3b3'}
                emissiveIntensity={powerOff ? 0 : isNight ? 1.25 : 0.18}
                roughness={0.68}
              />
            )}
          </mesh>
          {isNight && !powerOff && !ghostState && (
            <pointLight
              position={[0, 1.45, 0]}
              color="#ffd28c"
              intensity={4.5}
              distance={6.8}
              decay={2}
            />
          )}
        </group>
      );
  }
}
