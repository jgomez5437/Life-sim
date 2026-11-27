import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

export function LightingSky() {
  const hour = useGameStore((s) => s.clock.hour);
  const minute = useGameStore((s) => s.clock.minute);

  const lighting = useMemo(() => {
    const h = hour + minute / 60;
    // Daylight factor: 0 at midnight, 1 at noon
    const dayPhase = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const isGolden = (h >= 6 && h <= 8.5) || (h >= 17 && h <= 19.5);

    const skyColor = new THREE.Color('#1a2a44').lerp(
      new THREE.Color(isGolden ? '#f3c7a2' : '#bfe3f7'),
      Math.pow(dayPhase, 0.65),
    );

    const sunAngle = ((h - 6) / 12) * Math.PI;
    const sunX = Math.cos(sunAngle) * 14;
    const sunY = Math.max(4, Math.sin(sunAngle) * 16);
    const sunZ = 9;

    const sunColor = isGolden ? '#ffd199' : dayPhase > 0.15 ? '#fff7e8' : '#7ba6e6';
    const sunIntensity = 0.45 + dayPhase * 1.45;
    const ambientIntensity = 0.42 + dayPhase * 0.38;

    return {
      skyHex: `#${skyColor.getHexString()}`,
      sunPos: [sunX, sunY, sunZ] as [number, number, number],
      sunColor,
      sunIntensity,
      ambientIntensity,
    };
  }, [hour, minute]);

  return (
    <>
      <color attach="background" args={[lighting.skyHex]} />
      <fog attach="fog" args={[lighting.skyHex, 24, 52]} />
      <hemisphereLight
        args={[lighting.skyHex, '#7aa06c', lighting.ambientIntensity]}
      />
      <directionalLight
        position={lighting.sunPos}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={42}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0006}
      />
    </>
  );
}
