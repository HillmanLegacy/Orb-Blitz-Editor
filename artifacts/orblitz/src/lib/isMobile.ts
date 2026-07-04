/**
 * Computed once at module-load time — never changes during a session.
 * Use this constant instead of checking navigator properties per-frame or per-render.
 *
 * Detection strategy:
 *  1. maxTouchPoints > 0  — covers all modern Android / iOS devices
 *  2. UA string fallback  — covers older browsers that don't report touch points
 */
export const IS_MOBILE: boolean =
  typeof navigator !== "undefined" &&
  (navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
