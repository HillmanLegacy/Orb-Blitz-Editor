/**
 * Finds where a moving point enters a moving sphere during one render frame.
 * Using relative motion makes collision robust to low FPS and fast projectiles.
 */
export function sweptSphereHit(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  sphereStartX: number,
  sphereStartY: number,
  sphereStartZ: number,
  sphereEndX: number,
  sphereEndY: number,
  sphereEndZ: number,
  radius: number,
): number | null {
  const relStartX = startX - sphereStartX;
  const relStartY = startY - sphereStartY;
  const relStartZ = startZ - sphereStartZ;
  const relDeltaX = (endX - startX) - (sphereEndX - sphereStartX);
  const relDeltaY = (endY - startY) - (sphereEndY - sphereStartY);
  const relDeltaZ = (endZ - startZ) - (sphereEndZ - sphereStartZ);
  const radiusSquared = radius * radius;
  const c = relStartX * relStartX + relStartY * relStartY + relStartZ * relStartZ - radiusSquared;
  if (c <= 0) return 0;

  const a = relDeltaX * relDeltaX + relDeltaY * relDeltaY + relDeltaZ * relDeltaZ;
  if (a < 1e-8) return null;
  const b = 2 * (relStartX * relDeltaX + relStartY * relDeltaY + relStartZ * relDeltaZ);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const hitT = (-b - Math.sqrt(discriminant)) / (2 * a);
  return hitT >= 0 && hitT <= 1 ? hitT : null;
}