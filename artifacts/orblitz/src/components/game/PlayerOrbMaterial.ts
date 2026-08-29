import * as THREE from "three";

const PLAYER_ORB_TEXTURE_PROPERTIES = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "bumpMap",
  "alphaMap",
  "displacementMap",
] as const;

/**
 * Creates the material used by both the player orb and pooled projectile orbs.
 * Geometry instances may share the returned material, but callers own and must
 * dispose the clone. Texture objects remain owned by the GLTF cache.
 */
export function clonePlayerOrbMaterial({
  baseMaterial,
  textureMaterial = baseMaterial,
  coreColor,
  glowColor,
}: {
  baseMaterial: THREE.Material;
  textureMaterial?: THREE.Material;
  coreColor: string;
  glowColor: string;
}): THREE.Material {
  const material = baseMaterial.clone();
  const target = material as THREE.MeshStandardMaterial;
  const source = textureMaterial as THREE.MeshStandardMaterial;

  for (const property of PLAYER_ORB_TEXTURE_PROPERTIES) {
    if (property in target) {
      (target as any)[property] = source[property] ?? null;
    }
  }

  // Player and projectile cores are solid PBR meshes, not translucent VFX.
  // Normalize these flags explicitly so an equipped skin can contribute maps
  // without leaking alpha/blending state into the shared orb silhouette.
  material.transparent = false;
  material.opacity = 1;
  material.alphaTest = 0;
  material.alphaHash = false;
  material.depthTest = true;
  material.depthWrite = true;
  material.blending = THREE.NormalBlending;
  material.premultipliedAlpha = false;
  material.visible = true;

  if (target.color) target.color.set(coreColor);
  if (target.emissive) target.emissive.set(glowColor);
  if (typeof target.emissiveIntensity === "number") {
    const base = baseMaterial as THREE.MeshStandardMaterial;
    target.emissiveIntensity = Math.min(base.emissiveIntensity ?? 1, 0.45);
  }
  material.needsUpdate = true;
  return material;
}