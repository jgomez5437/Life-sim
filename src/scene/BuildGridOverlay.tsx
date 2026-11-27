import { CATALOG_BY_ID } from '../data/catalog';
import { LOT_SIZE } from '../data/starterLot';
import { getEffectiveFootprint, getObjectWorldCenter } from '../engine/grid';
import { useGameStore } from '../store/gameStore';
import { AssetRenderer } from './assets/AssetRenderer';

export function BuildGridOverlay() {
  const mode = useGameStore((s) => s.mode);
  const buildSelection = useGameStore((s) => s.buildSelection);

  if (mode !== 'build') return null;

  const item = buildSelection ? CATALOG_BY_ID[buildSelection.catalogId] : null;
  const ghostCenter =
    buildSelection && item
      ? getObjectWorldCenter(
          buildSelection.tileX,
          buildSelection.tileZ,
          item.footprint,
          buildSelection.rotation,
        )
      : null;
  const effSize =
    buildSelection && item
      ? getEffectiveFootprint(item.footprint, buildSelection.rotation)
      : null;

  return (
    <group>
      {/* Crisp 16x16 Build Mode grid */}
      <gridHelper
        args={[LOT_SIZE, LOT_SIZE, '#1e8e6e', '#ffffff']}
        position={[0, 0.055, 0]}
      />

      {/* Ghost furniture placement preview */}
      {buildSelection && item && ghostCenter && effSize && (
        <group position={[ghostCenter.x, 0.06, ghostCenter.z]}>
          {/* Footprint highlight pad */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[effSize[0] - 0.06, effSize[1] - 0.06]} />
            <meshBasicMaterial
              color={buildSelection.isValid ? '#25c678' : '#e74c3c'}
              transparent
              opacity={0.38}
            />
          </mesh>

          {/* Rotated ghost 3D mesh + front direction chevron */}
          <group rotation={[0, (buildSelection.rotation * Math.PI) / 180, 0]}>
            <AssetRenderer
              item={item}
              ghostState={buildSelection.isValid ? 'valid' : 'invalid'}
            />
            {/* Front arrow indicating interaction side (+Z) */}
            <mesh
              position={[0, 0.04, item.footprint[1] / 2 + 0.25]}
              rotation={[-Math.PI / 2, 0, Math.PI]}
            >
              <coneGeometry args={[0.16, 0.28, 3]} />
              <meshBasicMaterial
                color={buildSelection.isValid ? '#1ea866' : '#e74c3c'}
              />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
