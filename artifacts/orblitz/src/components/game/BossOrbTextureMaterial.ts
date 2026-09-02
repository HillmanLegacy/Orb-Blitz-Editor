import * as THREE from "three";

type TexturedMaterialSource = THREE.Material & {
  map?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  aoMap?: THREE.Texture | null;
};

function getMaterialTexture(material: THREE.Material): THREE.Texture | null {
  const source = material as TexturedMaterialSource;
  return source.map ?? source.emissiveMap ?? source.aoMap ?? null;
}

/**
 * Find the authored texture embedded in a boss-orb GLB.
 * The first available map is shared as the fallback for additional material
 * groups, matching the established Fire boss texture path.
 */
export function findBossOrbTexture(scene: THREE.Object3D): THREE.Texture | null {
  let texture: THREE.Texture | null = null;
  scene.traverse((child) => {
    if (texture || !(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const candidate = getMaterialTexture(material);
      if (candidate) {
        texture = candidate;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        break;
      }
    }
  });
  return texture;
}

/**
 * Boss orb textures are authored as finished color artwork. Use an unlit
 * material so the same colors remain vibrant in every scene and instance.
 */
export function createBossOrbTextureMaterial(
  sourceMaterial: THREE.Material,
  fallbackTexture?: THREE.Texture | null,
): THREE.MeshBasicMaterial {
  const source = sourceMaterial as TexturedMaterialSource;
  const map = source.map ?? fallbackTexture ?? undefined;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  return new THREE.MeshBasicMaterial({
    map,
    color: new THREE.Color("#ffffff"),
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
  });
}