import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── Constants ────────────────────────────────────────────────────────────────
const FIELD_RADIUS = 5;
const TOTAL_DUR    = 5.0;
const N_ORBIT      = 100;

// ── Shared geometry (module-level, never recreated) ──────────────────────────
const _shockGeo   = new THREE.RingGeometry(0.95, 1.0, 64);
const _bnd1Geo    = new THREE.TorusGeometry(FIELD_RADIUS, 0.11, 10, 80);
const _bnd2Geo    = new THREE.TorusGeometry(FIELD_RADIUS, 0.065, 10, 80);
const _fillGeo    = new THREE.CircleGeometry(FIELD_RADIUS, 48);
const _flashGeo   = new THREE.CircleGeometry(FIELD_RADIUS * 1.6, 48);
const _pGeo       = new THREE.SphereGeometry(0.065, 4, 4);
const _dummy      = new THREE.Object3D();

// Fibonacci-sphere orbit seeds — even angular distribution over the sphere surface
const _seeds = Array.from({ length: N_ORBIT }, (_, i) => ({
  phase: (i / N_ORBIT) * Math.PI * 2,
  tiltX: Math.acos(1 - 2 * (i + 0.5) / N_ORBIT),
  tiltZ: (i * 2.399963) % (Math.PI * 2),   // golden angle Z
  speed: 0.35 + (i % 11) * 0.09,
  r:     FIELD_RADIUS * (0.86 + (i % 4) * 0.035),
}));

// Colour palette
const _vio = new THREE.Color("#4B0082");
const _mag = new THREE.Color("#FF007F");
const _cyn = new THREE.Color("#00E5FF");
const _wht = new THREE.Color("#FFFFFF");
const _tc  = new THREE.Color(); // temp — particle loop
const _bc  = new THREE.Color(); // temp — boundary

function fieldColor(t: number, out: THREE.Color): THREE.Color {
  // t 0→1 over full duration: violet → magenta → cyan
  if (t < 0.5) return out.copy(_vio).lerp(_mag, t * 2);
  return out.copy(_mag).lerp(_cyn, (t - 0.5) * 2);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DistortField() {
  const { distortActive, distortTimer, playerPosition } = useMagicOrb();

  const shockRef  = useRef<THREE.Mesh>(null);
  const bnd1Ref   = useRef<THREE.Mesh>(null);
  const bnd2Ref   = useRef<THREE.Mesh>(null);
  const fillRef   = useRef<THREE.Mesh>(null);
  const flashRef  = useRef<THREE.Mesh>(null);
  const orbitsRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    if (!distortActive) return;

    const time      = state.clock.getElapsedTime();
    const age       = Math.max(0, TOTAL_DUR - distortTimer); // 0 at activation → 5 at collapse
    const t         = Math.min(1, age / TOTAL_DUR);           // 0→1 normalised
    const isPhase1  = age < 0.3;
    const isUnstable = distortTimer < 0.5;                   // Phase 3: last 0.5 s
    const collapseT  = isUnstable ? 1 - distortTimer / 0.5 : 0; // 0→1 during collapse

    // Fast strobe during instability
    const strobeHz  = isUnstable ? 18 + collapseT * 20 : 0;
    const strobe    = isUnstable ? 0.5 + 0.5 * Math.sin(time * strobeHz) : 0;

    // ── Phase 1: Expanding shockwave ring ─────────────────────────────────────
    if (shockRef.current) {
      if (isPhase1) {
        const p = age / 0.3;
        shockRef.current.visible = true;
        shockRef.current.scale.setScalar(FIELD_RADIUS * (0.05 + p));
        const sm = shockRef.current.material as THREE.MeshBasicMaterial;
        sm.color.copy(_cyn);
        sm.opacity = (1 - Math.pow(p, 0.5)) * 0.95;
      } else {
        shockRef.current.visible = false;
      }
    }

    // ── Inner fill glow ───────────────────────────────────────────────────────
    if (fillRef.current) {
      const fm     = fillRef.current.material as THREE.MeshBasicMaterial;
      const fadeIn = isPhase1 ? age / 0.3 : 1;
      fieldColor(t, fm.color);
      fm.opacity = fadeIn * (0.055 + Math.sin(time * 2.5) * 0.012 +
                             (isUnstable ? strobe * 0.04 : 0));
    }

    // ── Boundary rings ────────────────────────────────────────────────────────
    fieldColor(t, _bc);
    const bndCol = isUnstable ? _bc.lerp(_wht, collapseT * 0.7 + strobe * 0.25) : _bc;
    const collapseScale = isUnstable ? 1 - collapseT * 0.35 : 1;

    if (bnd1Ref.current) {
      bnd1Ref.current.rotation.x = time * 0.28;
      bnd1Ref.current.rotation.y = time * 0.18;
      bnd1Ref.current.scale.setScalar(collapseScale * (1 + Math.sin(time * 5) * 0.018));
      const bm = bnd1Ref.current.material as THREE.MeshBasicMaterial;
      bm.color.copy(bndCol);
      bm.opacity = 0.80 + strobe * 0.20;
    }
    if (bnd2Ref.current) {
      bnd2Ref.current.rotation.x = -time * 0.38;
      bnd2Ref.current.rotation.z =  time * 0.22;
      bnd2Ref.current.scale.setScalar(collapseScale * 1.012);
      const bm = bnd2Ref.current.material as THREE.MeshBasicMaterial;
      bm.color.copy(bndCol);
      bm.opacity = 0.45 + strobe * 0.30;
    }

    // ── Collapse flash ────────────────────────────────────────────────────────
    if (flashRef.current) {
      if (isUnstable) {
        flashRef.current.visible = true;
        flashRef.current.scale.setScalar(1 - collapseT * 0.5); // implode inward
        const fm = flashRef.current.material as THREE.MeshBasicMaterial;
        fm.color.copy(_wht).lerp(_cyn, 0.35);
        fm.opacity = collapseT * collapseT * 0.80;
      } else {
        flashRef.current.visible = false;
      }
    }

    // ── Orbiting particles ────────────────────────────────────────────────────
    const im = orbitsRef.current;
    if (im) {
      const fadeIn    = isPhase1 ? age / 0.3 : 1;
      const speedMult = isUnstable ? 1 + collapseT * 3.5 : 1;

      for (let i = 0; i < N_ORBIT; i++) {
        const s     = _seeds[i];
        const angle = s.phase + time * s.speed * speedMult;

        // Circle on XY plane, then tilt orbit plane via tiltX (around X) and tiltZ (around Z)
        const cx = Math.cos(angle) * s.r;
        const cy = Math.sin(angle) * s.r;

        const cX = Math.cos(s.tiltX), sX = Math.sin(s.tiltX);
        const cZ = Math.cos(s.tiltZ), sZ = Math.sin(s.tiltZ);

        // Tilt X: (cx, cy, 0) → (cx, cy·cX, cy·sX)
        const y2 = cy * cX;
        const z2 = cy * sX;
        // Tilt Z: (cx, y2, z2) → (cx·cZ − y2·sZ, cx·sZ + y2·cZ, z2)
        const px3 = cx * cZ - y2 * sZ;
        const py3 = cx * sZ + y2 * cZ;

        _dummy.position.set(px3, py3, z2);
        _dummy.scale.setScalar(isUnstable ? 1 + collapseT * 0.6 : 1);
        _dummy.updateMatrix();
        im.setMatrixAt(i, _dummy.matrix);

        // Per-particle colour: stagger through palette so different orbiters differ
        const ct = (t + i / N_ORBIT) % 1;
        fieldColor(ct, _tc);
        const brightness = fadeIn * (0.75 + strobe * 0.25);
        im.setColorAt(i, _tc.multiplyScalar(brightness));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  if (!distortActive) return null;

  return (
    <group position={playerPosition}>

      {/* Phase 1 — Shockwave ring */}
      <mesh ref={shockRef}>
        <primitive object={_shockGeo} />
        <meshBasicMaterial
          color="#00E5FF"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner gravitational fill */}
      <mesh ref={fillRef}>
        <primitive object={_fillGeo} />
        <meshBasicMaterial
          color="#4B0082"
          transparent
          opacity={0.06}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Boundary ring — primary */}
      <mesh ref={bnd1Ref}>
        <primitive object={_bnd1Geo} />
        <meshBasicMaterial
          color="#FF007F"
          transparent
          opacity={0.80}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Boundary ring — secondary (slower tilt) */}
      <mesh ref={bnd2Ref}>
        <primitive object={_bnd2Geo} />
        <meshBasicMaterial
          color="#00E5FF"
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Collapse flash — implodes inward in Phase 3 */}
      <mesh ref={flashRef} visible={false}>
        <primitive object={_flashGeo} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 100 orbiting particles across intersecting tilted ring paths */}
      <instancedMesh
        ref={orbitsRef}
        args={[_pGeo, undefined, N_ORBIT]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexColors
        />
      </instancedMesh>

    </group>
  );
}
