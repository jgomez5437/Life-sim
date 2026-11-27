import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

function DriftingClouds({ dayPhase }: { dayPhase: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const opacity = 0.25 + dayPhase * 0.62;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.x = Math.sin(t * 0.03) * 6;
  });

  const clouds: Array<[number, number, number, number]> = [
    [-16, 15, -20, 1.3],
    [4, 17, -24, 1.6],
    [20, 14.5, -18, 1.15],
    [-22, 16, 4, 1.2],
  ];

  return (
    <group ref={groupRef}>
      {clouds.map(([cx, cy, cz, scale], i) => (
        <group key={i} position={[cx, cy, cz]} scale={scale}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[1.4, 12, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={opacity} />
          </mesh>
          <mesh position={[1.2, -0.2, 0.2]}>
            <sphereGeometry args={[1.05, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={opacity} />
          </mesh>
          <mesh position={[-1.1, -0.25, -0.1]}>
            <sphereGeometry args={[1.0, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={opacity} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function LightingSky() {
  const { gl, scene } = useThree();
  const hour = useGameStore((s) => s.clock.hour);
  const minute = useGameStore((s) => s.clock.minute);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);

  // Build a lightweight procedural sky/ground PMREM reflection environment once
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();

    const domeGeo = new THREE.SphereGeometry(20, 24, 16);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#6bb8eb');
      grad.addColorStop(0.45, '#d8f0fc');
      grad.addColorStop(0.52, '#fff4df');
      grad.addColorStop(0.65, '#9ec384');
      grad.addColorStop(1, '#587049');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const envTex = new THREE.CanvasTexture(canvas);
    envTex.colorSpace = THREE.SRGBColorSpace;
    const domeMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(domeGeo, domeMat));

    // Bright soft sun spot inside env dome for crisp specular catchlights on eyes, mirrors & crystal
    const sunDot = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#fff7e0' }),
    );
    sunDot.position.set(8, 10, 8);
    envScene.add(sunDot);

    const rt = pmrem.fromScene(envScene, 0.04);
    scene.environment = rt.texture;

    return () => {
      scene.environment = null;
      rt.dispose();
      envTex.dispose();
      domeGeo.dispose();
      domeMat.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  const lighting = useMemo(() => {
    const h = hour + minute / 60;
    const dayPhase = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const isGolden = (h >= 5.5 && h <= 8.5) || (h >= 17 && h <= 19.5);

    const skyColor = new THREE.Color('#192842').lerp(
      new THREE.Color(isGolden ? '#f4c59e' : '#b7e1f7'),
      Math.pow(dayPhase, 0.62),
    );

    const sunAngle = ((h - 6) / 12) * Math.PI;
    const sunX = Math.cos(sunAngle) * 14.5;
    const sunY = Math.max(4.5, Math.sin(sunAngle) * 17);
    const sunZ = 9.5;

    const sunColor = isGolden ? '#ffc88c' : dayPhase > 0.15 ? '#fff6e6' : '#7ea8e6';
    const sunIntensity = 0.5 + dayPhase * 1.55;
    const ambientIntensity = 0.48 + dayPhase * 0.42;

    return {
      dayPhase,
      skyHex: `#${skyColor.getHexString()}`,
      sunPos: [sunX, sunY, sunZ] as [number, number, number],
      sunColor,
      sunIntensity,
      ambientIntensity,
    };
  }, [hour, minute]);

  const shadowMapSize = graphicsQuality === 'high' ? 2048 : 1024;

  return (
    <>
      <color attach="background" args={[lighting.skyHex]} />
      <fog attach="fog" args={[lighting.skyHex, 26, 58]} />

      <hemisphereLight
        args={[lighting.skyHex, '#7ca26c', lighting.ambientIntensity]}
      />

      {/* Primary sunlit directional shadow caster */}
      <directionalLight
        key={shadowMapSize}
        position={lighting.sunPos}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={46}
        shadow-camera-left={-12.5}
        shadow-camera-right={12.5}
        shadow-camera-top={12.5}
        shadow-camera-bottom={-12.5}
        shadow-bias={-0.00045}
        shadow-normalBias={0.025}
      />

      {/* Soft opposite-side sky bounce fill so shaded faces stay vibrant like Sims 4 */}
      <directionalLight
        position={[-10, 7, -8]}
        intensity={0.28 + lighting.dayPhase * 0.25}
        color="#d7ecff"
      />

      {graphicsQuality === 'high' && <DriftingClouds dayPhase={lighting.dayPhase} />}
    </>
  );
}
