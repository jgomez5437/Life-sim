import { Canvas } from '@react-three/fiber';
import { BuildGridOverlay } from './BuildGridOverlay';
import { CameraRig } from './CameraRig';
import { LightingSky } from './LightingSky';
import { LotRenderer } from './LotRenderer';
import { SimCharacter } from './SimCharacter';
import { SimulationDriver } from './SimulationDriver';

export function GameCanvas() {
  return (
    <div className="canvas-viewport" id="game-canvas-container">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.2, far: 120, position: [9, 10, 10] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <LightingSky />
        <CameraRig />
        <SimulationDriver />
        <LotRenderer />
        <BuildGridOverlay />
        <SimCharacter />
      </Canvas>
    </div>
  );
}
