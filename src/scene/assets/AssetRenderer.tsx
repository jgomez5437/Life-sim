import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { CatalogItem } from '../../types/game';
import { ProceduralFurniture } from './ProceduralFurniture';

interface AssetRendererProps {
  item: CatalogItem;
  isActive?: boolean;
  isNight?: boolean;
  ghostState?: 'valid' | 'invalid';
}

function GlbModelMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if ('isMesh' in child && child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);

  return <primitive object={cloned} />;
}

/**
 * Hybrid asset pipeline: loads external .glb models automatically when `item.modelUrl`
 * is specified, falling back cleanly to lightweight stylized procedural 3D meshes.
 */
export function AssetRenderer({
  item,
  isActive = false,
  isNight = false,
  ghostState,
}: AssetRendererProps) {
  if (item.modelUrl && !ghostState) {
    return (
      <Suspense fallback={<ProceduralFurniture item={item} isActive={isActive} isNight={isNight} />}>
        <GlbModelMesh url={item.modelUrl} />
      </Suspense>
    );
  }

  return (
    <ProceduralFurniture
      item={item}
      isActive={isActive}
      isNight={isNight}
      ghostState={ghostState}
    />
  );
}
