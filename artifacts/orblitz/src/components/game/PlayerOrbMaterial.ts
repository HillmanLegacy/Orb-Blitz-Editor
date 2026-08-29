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
  tintColors = true,
  emissiveBoost = 0,
}: {
  baseMaterial: THREE.Material;
  textureMaterial?: THREE.Material;
  coreColor: string;
  glowColor: string;
  /** Keep the authored GLTF color/emissive values when false. */
  tintColors?: boolean;
  /** Add neutral simulated light without changing the authored base-color texture. */
  emissiveBoost?: number;
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

  if (tintColors && target.color) target.color.set(coreColor);
  if (tintColors && target.emissive) target.emissive.set(glowColor);
  if (tintColors && typeof target.emissiveIntensity === "number") {
    const base = baseMaterial as THREE.MeshStandardMaterial;
    target.emissiveIntensity = Math.min(base.emissiveIntensity ?? 1, 0.45);
  }
  if (emissiveBoost > 0 && target.emissive) {
    // Small projectile cores can leave the player's local lights and lose the
    // readable detail from their base-color map. Reuse that same authored map
    // as the emissive mask instead of applying a flat white emissive layer,
    // which would wash the projectile into an untextured white orb.
    if (!target.emissiveMap && target.map) {
      target.emissiveMap = target.map;
    }
    target.emissive.set("#ffffff");
    target.emissiveIntensity = Math.max(target.emissiveIntensity ?? 0, emissiveBoost);
  }
  material.needsUpdate = true;
  return material;
}