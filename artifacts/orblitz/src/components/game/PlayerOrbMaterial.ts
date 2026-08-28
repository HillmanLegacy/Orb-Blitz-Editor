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

  // Match PlayerModel's visible PBR treatment. Keeping the GLB's original
  // opacity/depth/side settings makes the small projectile silhouette render
  // exactly like the player instead of behaving like an additive VFX layer.
  if (target.color) target.color.set(coreColor);
  if (target.emissive) target.emissive.set(glowColor);
  if (typeof target.emissiveIntensity === "number") {
    const base = baseMaterial as THREE.MeshStandardMaterial;
    target.emissiveIntensity = Math.min(base.emissiveIntensity ?? 1, 0.45);
  }
  material.needsUpdate = true;
  return material;
}