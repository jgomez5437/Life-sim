import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { BuildGridOverlay } from './BuildGridOverlay';
import { CameraRig } from './CameraRig';
import { LightingSky } from './LightingSky';
import { LotRenderer } from './LotRenderer';
import { NpcCharacters } from './NpcCharacters';
import { SimCharacter } from './SimCharacter';
import { SimulationDriver } from './SimulationDriver';

export function GameCanvas() {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const dpr: [number, number] = graphicsQuality === 'high' ? [1, 2] : [1, 1.35];

  return (
    <div className="canvas-viewport" id="game-canvas-container">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ fov: 39, near: 0.2, far: 165, position: [9, 10, 10] }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.06,
        }}
      >
        <LightingSky />
        <CameraRig />
        <SimulationDriver />
        <LotRenderer />
        <BuildGridOverlay />
        <SimCharacter />
        <NpcCharacters />
      </Canvas>
    </div>
  );
}
