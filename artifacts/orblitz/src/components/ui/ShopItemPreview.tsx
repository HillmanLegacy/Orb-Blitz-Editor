// ═══════════════════════════════════════════════════════════════════════════════
// ShopItemPreview.tsx
// Self-contained R3F preview scenes for weapons, defenses, and magi orbs.
// No game-store dependencies — pure animation math in useFrame.
// Each scene shows the player using the item with enemies on screen.
// ═══════════════════════════════════════════════════════════════════════════════
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";

// ── Pool helpers (zero-alloc in useFrame) ─────────────────────────────────────
const _d = new THREE.Object3D();

// ── Enemy base positions ──────────────────────────────────────────────────────
const _EP: [number, number, number][] = [
  [1.42,  0.52, 0],
  [1.65, -0.42, 0],
  [1.20,  0.00, 0],
];

// ── Shared geometry args ──────────────────────────────────────────────────────
const G_PLR = [0.40, 16, 12] as const;
const G_ENM = [0.26, 10,  8] as const;
const G_DEF = [0.18,  8,  6] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Material hook helpers
// ─────────────────────────────────────────────────────────────────────────────
function useStdMat(color: string, emissiveMul = 0.22, emissiveInt = 1.8) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(emissiveMul),
    metalness: 0.45, roughness: 0.25, emissiveIntensity: emissiveInt,
  }), [color, emissiveMul, emissiveInt]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function useBasicMat(color: string, additive = false) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color, transparent: additive, depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }), [color, additive]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function useInstGeo(r: number, w: number, h: number) {
  const geo = useMemo(() => new THREE.SphereGeometry(r, w, h), [r, w, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════ WEAPON SCENES ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. Rapid Blaster ── cyan bullets stream toward enemies ────────────────────
function RapidBlasterScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 7;
  const pool = useRef({ px: new Float32Array(N), py: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N),
    nextFire: 0, slot: 0 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const bulGeo = useInstGeo(0.07, 6, 4);
  const bulMat = useBasicMat("#00eeff", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    p.nextFire -= dt;
    if (p.nextFire <= 0) {
      p.nextFire = 0.16;
      const s = p.slot % N; p.slot++;
      const target = s % 2;
      const ty = target === 0 ? (e0.current?.position.y ?? _EP[0][1]) : (e1.current?.position.y ?? _EP[1][1]);
      const dx = _EP[target][0] + 1.2, dy = ty;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      p.px[s] = -1.2; p.py[s] = 0;
      p.vx[s] = (dx/len) * 9; p.vy[s] = (dy/len) * 9;
      p.life[s] = 0.6;
    }
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) {
        _d.position.set(999, 0, 0); _d.scale.setScalar(0.001); _d.updateMatrix();
        mesh.setMatrixAt(i, _d.matrix); continue;
      }
      p.px[i] += p.vx[i] * dt; p.py[i] += p.vy[i] * dt; p.life[i] -= dt;
      _d.position.set(p.px[i], p.py[i], 0); _d.scale.setScalar(1); _d.updateMatrix();
      mesh.setMatrixAt(i, _d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#0066ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[bulGeo, bulMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── 2. Scattershot ── 3-projectile wedge every 0.55s ─────────────────────────
function ScattershotScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 9;
  const pool = useRef({ px: new Float32Array(N), py: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N),
    nextFire: 0, slot: 0 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const bulGeo = useInstGeo(0.09, 6, 4);
  const bulMat = useBasicMat("#ff8800", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.8 + 1.6) * 0.12;
    p.nextFire -= dt;
    if (p.nextFire <= 0) {
      p.nextFire = 0.55;
      for (const angle of [-0.26, 0, 0.26]) {
        const s = p.slot % N; p.slot++;
        p.px[s] = -1.2; p.py[s] = 0;
        p.vx[s] = Math.cos(angle) * 8; p.vy[s] = Math.sin(angle) * 8;
        p.life[s] = 0.5;
      }
    }
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) {
        _d.position.set(999, 0, 0); _d.scale.setScalar(0.001); _d.updateMatrix();
        mesh.setMatrixAt(i, _d.matrix); continue;
      }
      p.px[i] += p.vx[i] * dt; p.py[i] += p.vy[i] * dt; p.life[i] -= dt;
      _d.position.set(p.px[i], p.py[i], 0); _d.scale.setScalar(1); _d.updateMatrix();
      mesh.setMatrixAt(i, _d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#ff6600" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[bulGeo, bulMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── 3. Spiral Shooter ── 3 projectiles orbit their travel path ────────────────
function SpiralShooterScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 6;
  const pool = useRef({ travelX: new Float32Array(N), phase: new Float32Array(N),
    life: new Float32Array(N), nextFire: 0, slot: 0 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const bulGeo = useInstGeo(0.10, 6, 4);
  const bulMat = useBasicMat("#aa44ff", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.8 + 1.6) * 0.12;
    p.nextFire -= dt;
    if (p.nextFire <= 0) {
      p.nextFire = 0.7;
      for (let a = 0; a < 3; a++) {
        const s = p.slot % N; p.slot++;
        p.travelX[s] = -1.2;
        p.phase[s] = (a / 3) * Math.PI * 2;
        p.life[s] = 0.65;
      }
    }
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) {
        _d.position.set(999, 0, 0); _d.scale.setScalar(0.001); _d.updateMatrix();
        mesh.setMatrixAt(i, _d.matrix); continue;
      }
      p.travelX[i] += 5 * dt; p.life[i] -= dt;
      const angle = t * 8 + p.phase[i];
      _d.position.set(p.travelX[i], Math.sin(angle) * 0.22, Math.cos(angle) * 0.22);
      _d.scale.setScalar(1); _d.updateMatrix(); mesh.setMatrixAt(i, _d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#8833ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[bulGeo, bulMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── 4. Overcharged Blaster ── 1 large expanding sphere, big flash on hit ──────
function OverchargedBlasterScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const proj = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const st = useRef({ tx: -1.2, active: false, flashAlpha: 0, timer: 1.5 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const projMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ff8800", transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffcc44", transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => { projMat.dispose(); flashMat.dispose(); }, [projMat, flashMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;

    s.timer -= dt;
    if (!s.active && s.timer <= 0) { s.active = true; s.tx = -1.2; }

    if (s.active && proj.current) {
      s.tx += 2.5 * dt;
      const travel = s.tx + 1.2;
      proj.current.position.set(s.tx, 0, 0);
      proj.current.scale.setScalar(0.5 + travel / 2.8 * 0.8);
      if (s.tx >= 1.25) {
        s.active = false; s.timer = 1.5; s.flashAlpha = 1.4;
        proj.current.position.set(999, 0, 0);
      }
    } else if (proj.current) proj.current.position.set(999, 0, 0);

    s.flashAlpha = Math.max(0, s.flashAlpha - dt * 3.5);
    if (flash.current) {
      flash.current.scale.setScalar(1 + s.flashAlpha * 1.2);
      flashMat.opacity = Math.min(1, s.flashAlpha);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#ff6600" intensity={2.5} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={proj} position={[999, 0, 0]} material={projMat}><sphereGeometry args={[0.50, 10, 8]} /></mesh>
      <mesh ref={flash} position={[1.5, 0.05, 0]} material={flashMat}><sphereGeometry args={[0.7, 12, 8]} /></mesh>
    </group>
  );
}

// ── 5. Homing Launcher ── projectile curves toward nearest enemy ───────────────
function HomingScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const proj = useRef<THREE.Mesh>(null);
  const st = useRef({ px: -1.2, py: 0, vx: 5, vy: 2.2, active: false, timer: 1.0 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const projMat = useBasicMat("#44ffaa", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    const e0y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e0.current) e0.current.position.y = e0y;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;

    s.timer -= dt;
    if (!s.active && s.timer <= 0) { s.active = true; s.px = -1.2; s.py = 0; s.vx = 4.5; s.vy = 2.2; }

    if (s.active && proj.current) {
      const toX = _EP[0][0] - s.px, toY = e0y - s.py;
      const dist = Math.sqrt(toX*toX + toY*toY) || 1;
      s.vx += (toX/dist) * 5 * dt; s.vy += (toY/dist) * 5 * dt;
      const spd = Math.sqrt(s.vx*s.vx + s.vy*s.vy) || 1;
      s.vx = (s.vx/spd) * 6.5; s.vy = (s.vy/spd) * 6.5;
      s.px += s.vx * dt; s.py += s.vy * dt;
      proj.current.position.set(s.px, s.py, 0);
      if (dist < 0.35) { s.active = false; s.timer = 1.2; proj.current.position.set(999, 0, 0); }
    } else if (proj.current) proj.current.position.set(999, 0, 0);
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#00ff88" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={proj} position={[999, 0, 0]} material={projMat}><sphereGeometry args={[0.13, 6, 4]} /></mesh>
    </group>
  );
}

// ── 6. Sub Blaster ── orbiting sub-orb auto-fires at enemies ─────────────────
function SubBlasterScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const subOrb = useRef<THREE.Mesh>(null);
  const proj = useRef<THREE.Mesh>(null);
  const st = useRef({ bx: 999, by: 999, bvx: 0, bvy: 0, active: false, timer: 0.7 });

  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const subMat = useStdMat("#00ffcc", 0.35, 2.5);
  const projMat = useBasicMat("#00ffcc", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;

    const subX = -1.2 + Math.cos(t * 2.2) * 0.68;
    const subY = Math.sin(t * 2.2) * 0.68;
    if (subOrb.current) subOrb.current.position.set(subX, subY, 0);

    s.timer -= dt;
    if (!s.active && s.timer <= 0) {
      s.active = true;
      const ty = e0.current?.position.y ?? _EP[0][1];
      const dx = _EP[0][0] - subX, dy = ty - subY;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      s.bx = subX; s.by = subY;
      s.bvx = (dx/len) * 8; s.bvy = (dy/len) * 8;
    }
    if (s.active && proj.current) {
      s.bx += s.bvx * dt; s.by += s.bvy * dt;
      proj.current.position.set(s.bx, s.by, 0);
      if (s.bx > 2) { s.active = false; s.timer = 0.65; proj.current.position.set(999, 0, 0); }
    } else if (proj.current) proj.current.position.set(999, 0, 0);
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#00ffcc" intensity={2.0} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={subOrb} position={[999, 0, 0]} material={subMat}><sphereGeometry args={[0.22, 10, 8]} /></mesh>
      <mesh ref={proj} position={[999, 0, 0]} material={projMat}><sphereGeometry args={[0.07, 6, 4]} /></mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════ DEFENSE SCENES ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. Teletransfer ── player flashes to new position every 2s ────────────────
function TeletransferScene() {
  const plr = useRef<THREE.Mesh>(null);
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const st = useRef({ alpha: 1.0, phase: 0.0, targetX: -1.2, targetY: 0.0, timer: 2.0 });
  const plrMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#0099ee", emissive: new THREE.Color("#0099ee").multiplyScalar(0.22),
    metalness: 0.45, roughness: 0.25, emissiveIntensity: 1.8,
    transparent: true, opacity: 1,
  }), []);
  useEffect(() => () => plrMat.dispose(), [plrMat]);
  const enmMat = useBasicMat("#cc2200");

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    s.timer -= dt;
    if (s.timer <= 0) { s.timer = 2.0; s.phase = 0; s.targetX = -2.0 + Math.random() * 1.4; s.targetY = (Math.random()-0.5) * 1.0; }
    s.phase = Math.min(1, s.phase + dt * 3.5);
    if (s.phase < 0.4) { plrMat.opacity = 1 - s.phase / 0.4; }
    else if (s.phase < 0.5) { plrMat.opacity = 0; if (plr.current) plr.current.position.set(s.targetX, s.targetY, 0); }
    else { plrMat.opacity = Math.min(1, (s.phase - 0.5) / 0.4); }
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#00ccff" intensity={2.0} distance={5} decay={2} />
      <mesh ref={plr} position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
    </group>
  );
}

// ── 2. Distort Field ── freeze ring expands, enemies tint blue-frozen ─────────
function DistortFieldScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const st = useRef({ r: 0, expanding: false, frozen: false, frozenTimer: 0, timer: 1.5, e0vy: -0.5, e1vy: 0.5 });
  const plrMat = useStdMat("#0099ee");
  const enmMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200" }), []);
  useEffect(() => () => enmMat.dispose(), [enmMat]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#00ffff", transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => ringMat.dispose(), [ringMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    s.timer -= dt;
    if (!s.expanding && !s.frozen && s.timer <= 0) { s.expanding = true; s.r = 0; }
    if (s.expanding) {
      s.r += dt * 3.5; ringMat.opacity = Math.max(0, 0.6 - s.r * 0.18);
      if (ring.current) ring.current.scale.setScalar(s.r);
      if (s.r >= 2.5) { s.expanding = false; s.frozen = true; s.frozenTimer = 1.5; s.timer = 1.5; }
    }
    if (s.frozen) { s.frozenTimer -= dt; if (s.frozenTimer <= 0) s.frozen = false; }
    enmMat.color.setHex(s.frozen ? 0x4488ff : 0xcc2200);
    if (!s.frozen) {
      if (e0.current) { e0.current.position.y += s.e0vy * dt * 0.5; if (Math.abs(e0.current.position.y) > 0.8) s.e0vy *= -1; }
      if (e1.current) { e1.current.position.y += s.e1vy * dt * 0.5; if (Math.abs(e1.current.position.y) > 0.8) s.e1vy *= -1; }
    } else {
      if (e0.current) e0.current.position.y += Math.sin(t * 1.1) * 0.001;
      if (e1.current) e1.current.position.y += Math.sin(t * 0.9 + 1.4) * 0.001;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#00ffff" intensity={2.0} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={ring} position={[-1.2, 0, 0]} material={ringMat}>
        <ringGeometry args={[0.92, 1.0, 48]} />
      </mesh>
    </group>
  );
}

// ── 3. Pulse Shield ── expanding ring repels approaching enemies ───────────────
function PulseShieldScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const st = useRef({ r: 0, active: false, timer: 1.8, e0x: _EP[0][0], e1x: _EP[1][0], e0vx: -0.6, e1vx: -0.55 });
  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#00aaff", transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => ringMat.dispose(), [ringMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    s.timer -= dt;
    if (!s.active && s.timer <= 0) { s.active = true; s.r = 0.3; s.e0vx = 0.7; s.e1vx = 0.65; }
    if (!s.active) { s.e0vx = -0.6; s.e1vx = -0.55; }
    s.e0x += s.e0vx * dt; s.e1x += s.e1vx * dt;
    if (s.e0x > _EP[0][0]) s.e0x = _EP[0][0];
    if (s.e1x > _EP[1][0]) s.e1x = _EP[1][0];
    if (s.e0x < -2.2) { s.e0x = _EP[0][0]; s.e0vx = -0.6; }
    if (s.e1x < -2.2) { s.e1x = _EP[1][0]; s.e1vx = -0.55; }
    if (e0.current) e0.current.position.set(s.e0x, _EP[0][1] + Math.sin(t*1.1)*0.1, 0);
    if (e1.current) e1.current.position.set(s.e1x, _EP[1][1] + Math.sin(t*0.9+1.4)*0.1, 0);
    if (s.active) {
      s.r += dt * 4.5; ringMat.opacity = Math.max(0, 0.8 - s.r * 0.25);
      if (ring.current) ring.current.scale.setScalar(s.r);
      if (s.r >= 3) { s.active = false; s.timer = 1.8; }
    }
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#0088ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={ring} position={[-1.2, 0, 0]} material={ringMat}><ringGeometry args={[0.9, 1.0, 48]} /></mesh>
    </group>
  );
}

// ── 4. Defense System ── 5 orbs orbit player, intercept enemies ───────────────
function DefenseSystemScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 5;
  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const defGeo = useInstGeo(...G_DEF);
  const defMat = useBasicMat("#44aaff", true);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + t * 1.4;
      _d.position.set(-1.2 + Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0);
      _d.scale.setScalar(1); _d.updateMatrix(); mesh.setMatrixAt(i, _d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#4488ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[defGeo, defMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── 5. Spatial Relocation ── auto-blinks when enemy gets close ────────────────
function SpatialRelocationScene() {
  const plr = useRef<THREE.Mesh>(null);
  const e0 = useRef<THREE.Mesh>(null);
  const st = useRef({ px: -1.2, py: 0, ex: _EP[0][0], ey: _EP[0][1], blinking: false, alpha: 1.0 });
  const plrMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#0099ee", emissive: new THREE.Color("#0099ee").multiplyScalar(0.22),
    metalness: 0.45, roughness: 0.25, emissiveIntensity: 1.8, transparent: true, opacity: 1,
  }), []);
  useEffect(() => () => plrMat.dispose(), [plrMat]);
  const enmMat = useBasicMat("#cc2200");

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    const dx = s.px - s.ex, dy = s.py - s.ey, dist = Math.sqrt(dx*dx + dy*dy) || 1;
    s.ex += (dx/dist) * 0.7 * dt; s.ey += (dy/dist) * 0.7 * dt + Math.sin(t*1.2) * 0.008;
    if (e0.current) e0.current.position.set(s.ex, s.ey, 0);
    if (!s.blinking && dist < 0.85) { s.blinking = true; }
    if (s.blinking) {
      s.alpha -= dt * 5;
      if (s.alpha <= 0) {
        s.px = -2.0 + Math.random() * 1.4; s.py = (Math.random()-0.5) * 1.0;
        s.ex = _EP[0][0]; s.ey = _EP[0][1]; s.blinking = false; s.alpha = 1;
      }
    }
    plrMat.opacity = Math.max(0, Math.min(1, s.alpha));
    if (plr.current) plr.current.position.set(s.px, s.py, 0);
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#cc44ff" intensity={2.0} distance={5} decay={2} />
      <mesh ref={plr} position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
    </group>
  );
}

// ── 6. Restoration ── green healing particles rise from player ────────────────
function RestorationScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 14;
  const pool = useRef({ py: new Float32Array(N), life: new Float32Array(N), phase: new Float32Array(N), born: false });
  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const partGeo = useInstGeo(0.055, 5, 3);
  const partMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#44ff88", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => partMat.dispose(), [partMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    if (!p.born) { for (let i = 0; i < N; i++) { p.py[i] = (Math.random()-0.5)*0.4; p.life[i] = Math.random(); p.phase[i] = Math.random()*Math.PI*2; } p.born = true; }
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      p.life[i] -= dt;
      if (p.life[i] <= 0) { p.py[i] = (Math.random()-0.5)*0.4; p.life[i] = 0.8 + Math.random()*0.6; p.phase[i] = Math.random()*Math.PI*2; }
      const age = 1 - (p.life[i] / 1.0);
      const x = -1.2 + Math.sin(t * 1.5 + p.phase[i]) * 0.25;
      const y = p.py[i] + age * 1.1;
      _d.position.set(x, y, 0); _d.scale.setScalar(Math.max(0, p.life[i] * 0.9)); _d.updateMatrix(); mesh.setMatrixAt(i, _d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#00ff66" intensity={2.0} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[partGeo, partMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── 7. Armor ── golden rings + semi-transparent shell shield ──────────────────
function ArmorScene() {
  const e0 = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const e0x = useRef(_EP[0][0]);
  const plrMat = useStdMat("#0099ee");
  const enmMat = useBasicMat("#cc2200");
  const shellMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffcc00", transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => shellMat.dispose(), [shellMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    e0x.current -= 0.5 * dt;
    if (e0x.current < -0.75) e0x.current = _EP[0][0];
    if (e0.current) e0.current.position.set(e0x.current, _EP[0][1] + Math.sin(t*1.1)*0.12, 0);
    if (shell.current) { shell.current.rotation.y = t * 0.8; shell.current.rotation.x = t * 0.5; }
    shellMat.opacity = 0.22 + Math.sin(t * 3) * 0.08;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#ffaa00" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh position={[-1.2, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.58, 0.66, 32]} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[-1.2, 0, 0]}>
        <ringGeometry args={[0.58, 0.66, 32]} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={shell} position={[-1.2, 0, 0]} material={shellMat}><sphereGeometry args={[0.68, 16, 12]} /></mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═════════════════════════ MAGI ORB SCENES ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ── M1 ── player moves in a circle constantly ─────────────────────────────────
function MagiOrb1Scene() {
  const plr = useRef<THREE.Mesh>(null);
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useBasicMat("#cc2200");
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (plr.current) plr.current.position.set(Math.cos(t * 1.6) * 1.1, Math.sin(t * 1.6) * 0.7, 0);
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
  });
  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[0, 0, 2.5]} color="#8844ff" intensity={2.0} distance={5} decay={2} />
      <mesh ref={plr} position={[-1.0, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
    </group>
  );
}

// ── M2 ── enemies explode, energy siphons to player ──────────────────────────
function MagiOrb2Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 18;
  const st = useRef({ phase: 0, timer: 2.5 });
  const pool = useRef({ px: new Float32Array(N), py: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N) });
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200", transparent: true, opacity: 1 }), []);
  useEffect(() => () => enmMat.dispose(), [enmMat]);
  const partGeo = useInstGeo(0.05, 4, 3);
  const partMat = useBasicMat("#ff6600", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current, p = pool.current;
    s.timer -= dt;
    if (s.phase === 0 && s.timer <= 0) {
      s.phase = 1; s.timer = 1.8; enmMat.opacity = 0;
      for (let i = 0; i < N; i++) {
        const src = i < N/2 ? 0 : 1;
        const angle = Math.random() * Math.PI * 2, spd = 1.5 + Math.random() * 3;
        p.px[i] = _EP[src][0]; p.py[i] = _EP[src][1];
        p.vx[i] = Math.cos(angle)*spd; p.vy[i] = Math.sin(angle)*spd; p.life[i] = 0.6 + Math.random()*0.6;
      }
    }
    if (s.phase === 1 && s.timer <= 0) { s.phase = 0; s.timer = 2.0; enmMat.opacity = 1; }
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) { _d.position.set(999,0,0); _d.scale.setScalar(0.001); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix); continue; }
      const toX = -1.2 - p.px[i], toY = -p.py[i], dist = Math.sqrt(toX*toX+toY*toY)||1;
      p.vx[i] += (toX/dist)*6*dt; p.vy[i] += (toY/dist)*6*dt;
      p.px[i] += p.vx[i]*dt; p.py[i] += p.vy[i]*dt; p.life[i] -= dt;
      _d.position.set(p.px[i],p.py[i],0); _d.scale.setScalar(Math.max(0,p.life[i]*2)); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#ff4400" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[partGeo, partMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── M3 ── 10 homing projectiles fan out then curve to enemies ─────────────────
function MagiOrb3Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 10;
  const pool = useRef({ px: new Float32Array(N), py: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), timer: 2.5 });
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useBasicMat("#cc2200");
  const bulGeo = useInstGeo(0.08, 5, 3);
  const bulMat = useBasicMat("#cc66ff", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    const e0y = _EP[0][1] + Math.sin(t*1.1)*0.12;
    const e1y = _EP[1][1] + Math.sin(t*0.9+1.4)*0.12;
    if (e0.current) e0.current.position.y = e0y;
    if (e1.current) e1.current.position.y = e1y;
    p.timer -= dt;
    if (p.timer <= 0) {
      p.timer = 2.5;
      for (let i = 0; i < N; i++) {
        const a = (i/N) * Math.PI * 1.6 - Math.PI * 0.8;
        p.px[i] = -1.2; p.py[i] = 0; p.vx[i] = Math.cos(a)*3.5; p.vy[i] = Math.sin(a)*3.5; p.life[i] = 0.9;
      }
    }
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) { _d.position.set(999,0,0); _d.scale.setScalar(0.001); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix); continue; }
      const target = i < N/2 ? 0 : 1;
      const tx = _EP[target][0], ty = target===0 ? e0y : e1y;
      const toX = tx-p.px[i], toY = ty-p.py[i], dist = Math.sqrt(toX*toX+toY*toY)||1;
      p.vx[i] += (toX/dist)*8*dt; p.vy[i] += (toY/dist)*8*dt;
      const spd = Math.sqrt(p.vx[i]*p.vx[i]+p.vy[i]*p.vy[i])||1;
      p.vx[i]=(p.vx[i]/spd)*5.5; p.vy[i]=(p.vy[i]/spd)*5.5;
      p.px[i]+=p.vx[i]*dt; p.py[i]+=p.vy[i]*dt; p.life[i]-=dt;
      _d.position.set(p.px[i],p.py[i],0); _d.scale.setScalar(1); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#cc44ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[bulGeo, bulMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── M4 ── quarter-circle barrier sweeps around player ────────────────────────
function MagiOrb4Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const arcGroup = useRef<THREE.Group>(null);
  const st = useRef({ angle: 0, active: true, timer: 0 });
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useBasicMat("#cc2200");
  const arcMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ff4444", transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => arcMat.dispose(), [arcMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    s.timer -= dt;
    if (s.active) {
      s.angle += dt * 2.2;
      if (arcGroup.current) arcGroup.current.rotation.z = s.angle;
      if (s.angle >= Math.PI * 2) { s.active = false; s.timer = 1.5; s.angle = 0; }
    } else if (s.timer <= 0) s.active = true;
    arcMat.opacity = s.active ? 0.75 : 0;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#ff2222" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <group ref={arcGroup} position={[-1.2, 0, 0]}>
        <mesh material={arcMat}><ringGeometry args={[0.72, 0.92, 32, 1, 0, Math.PI / 2]} /></mesh>
      </group>
    </group>
  );
}

// ── M5 ── transparent cube absorbs hits before player takes damage ─────────────
function MagiOrb5Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const cube = useRef<THREE.Mesh>(null);
  const e0x = useRef(_EP[0][0]);
  const flashAlpha = useRef(0);
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useBasicMat("#cc2200");
  const cubeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#4488ff", transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => cubeMat.dispose(), [cubeMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    if (cube.current) { cube.current.rotation.y = t * 0.8; cube.current.rotation.x = t * 0.5; }
    e0x.current -= 0.5 * dt;
    if (e0.current) e0.current.position.set(e0x.current, _EP[0][1] + Math.sin(t*1.1)*0.12, 0);
    if (e0x.current < -0.75) { e0x.current = _EP[0][0]; flashAlpha.current = 1.0; }
    flashAlpha.current = Math.max(0, flashAlpha.current - dt * 3);
    cubeMat.opacity = 0.22 + flashAlpha.current * 0.5;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#4488ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={cube} position={[-1.2, 0, 0]} material={cubeMat}><boxGeometry args={[1.0, 1.0, 1.0]} /></mesh>
    </group>
  );
}

// ── M6 ── random teleport every ~2s ──────────────────────────────────────────
function MagiOrb6Scene() {
  const plr = useRef<THREE.Mesh>(null);
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const st = useRef({ px: -1.2, py: 0, alpha: 1.0, blinking: false, timer: 2.0 });
  const plrMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#aa44ff", emissive: new THREE.Color("#aa44ff").multiplyScalar(0.22),
    metalness: 0.45, roughness: 0.25, emissiveIntensity: 1.8, transparent: true, opacity: 1,
  }), []);
  useEffect(() => () => plrMat.dispose(), [plrMat]);
  const enmMat = useBasicMat("#cc2200");

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t * 1.1) * 0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t * 0.9 + 1.4) * 0.12;
    s.timer -= dt;
    if (!s.blinking && s.timer <= 0) { s.blinking = true; }
    if (s.blinking) {
      s.alpha -= dt * 5;
      if (s.alpha <= 0) {
        s.px = -2.0 + Math.random()*2.0; s.py = (Math.random()-0.5)*1.2;
        s.blinking = false; s.timer = 2.0; s.alpha = 1;
      }
    }
    plrMat.opacity = Math.max(0, Math.min(1, s.alpha));
    if (plr.current) plr.current.position.set(s.px, s.py, 0);
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[0, 0, 2.5]} color="#9933ff" intensity={2.0} distance={5} decay={2} />
      <mesh ref={plr} position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
    </group>
  );
}

// ── M7 ── 360 pulse slows all enemies to 25% speed ───────────────────────────
function MagiOrb7Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const st = useRef({ r: 0, expanding: false, slowed: false, frozenTimer: 0, timer: 2.0 });
  const e0x = useRef(_EP[0][0]), e1x = useRef(_EP[1][0]);
  const plrMat = useStdMat("#aa44ff");
  const enmMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200" }), []);
  useEffect(() => () => enmMat.dispose(), [enmMat]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#9933ff", transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => ringMat.dispose(), [ringMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    s.timer -= dt;
    if (!s.expanding && !s.slowed && s.timer <= 0) { s.expanding = true; s.r = 0; }
    if (s.expanding) {
      s.r += dt * 4; ringMat.opacity = Math.max(0, 0.75 - s.r * 0.22);
      if (ring.current) ring.current.scale.setScalar(s.r);
      if (s.r >= 3) { s.expanding = false; s.slowed = true; s.frozenTimer = 1.8; s.timer = 2.0; }
    }
    if (s.slowed) { s.frozenTimer -= dt; if (s.frozenTimer <= 0) { s.slowed = false; e0x.current = _EP[0][0]; e1x.current = _EP[1][0]; } }
    const speedMul = s.slowed ? 0.18 : 1.0;
    e0x.current -= 0.5 * speedMul * dt; e1x.current -= 0.45 * speedMul * dt;
    if (e0x.current < -2) e0x.current = _EP[0][0];
    if (e1x.current < -2) e1x.current = _EP[1][0];
    if (e0.current) e0.current.position.set(e0x.current, _EP[0][1]+Math.sin(t*1.1)*0.12, 0);
    if (e1.current) e1.current.position.set(e1x.current, _EP[1][1]+Math.sin(t*0.9+1.4)*0.12, 0);
    enmMat.color.setHex(s.slowed ? 0x8833cc : 0xcc2200);
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#9933ff" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={ring} position={[-1.2, 0, 0]} material={ringMat}><ringGeometry args={[0.9, 1.02, 48]} /></mesh>
    </group>
  );
}

// ── M8 ── allied orb mirrors player; both fire at enemies ─────────────────────
function MagiOrb8Scene() {
  const e0 = useRef<THREE.Mesh>(null);
  const e1 = useRef<THREE.Mesh>(null);
  const im = useRef<THREE.InstancedMesh>(null);
  const N = 6;
  const pool = useRef({ px: new Float32Array(N), py: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), nextFire: 0, slot: 0 });
  const plrMat = useStdMat("#aa44ff");
  const allyMat = useStdMat("#ff44aa", 0.25, 2.0);
  const enmMat = useBasicMat("#cc2200");
  const bulGeo = useInstGeo(0.07, 5, 3);
  const bulMat = useBasicMat("#ff88cc", true);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const p = pool.current;
    if (e0.current) e0.current.position.y = _EP[0][1] + Math.sin(t*1.1)*0.12;
    if (e1.current) e1.current.position.y = _EP[1][1] + Math.sin(t*0.9+1.4)*0.12;
    p.nextFire -= dt;
    if (p.nextFire <= 0) {
      p.nextFire = 0.45;
      const s1 = p.slot % N; p.slot++;
      p.px[s1]=-1.2; p.py[s1]=0;
      const e0y = e0.current?.position.y ?? _EP[0][1];
      const dx1=_EP[0][0]+1.2, dy1=e0y; const l1=Math.sqrt(dx1*dx1+dy1*dy1)||1;
      p.vx[s1]=(dx1/l1)*8; p.vy[s1]=(dy1/l1)*8; p.life[s1]=0.55;
      const s2 = p.slot % N; p.slot++;
      p.px[s2]=-1.2; p.py[s2]=-0.85;
      const e1y = e1.current?.position.y ?? _EP[1][1];
      const dx2=_EP[1][0]+1.2, dy2=e1y+0.85; const l2=Math.sqrt(dx2*dx2+dy2*dy2)||1;
      p.vx[s2]=(dx2/l2)*8; p.vy[s2]=(dy2/l2)*8; p.life[s2]=0.55;
    }
    const mesh = im.current; if (!mesh) return;
    for (let i = 0; i < N; i++) {
      if (p.life[i] <= 0) { _d.position.set(999,0,0); _d.scale.setScalar(0.001); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix); continue; }
      p.px[i]+=p.vx[i]*dt; p.py[i]+=p.vy[i]*dt; p.life[i]-=dt;
      _d.position.set(p.px[i],p.py[i],0); _d.scale.setScalar(1); _d.updateMatrix(); mesh.setMatrixAt(i,_d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, -0.4, 2.5]} color="#ff44aa" intensity={2.2} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh position={[-1.2, -0.88, 0]} material={allyMat}><sphereGeometry args={[0.36, 14, 10]} /></mesh>
      <mesh ref={e0} position={[..._EP[0]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={e1} position={[..._EP[1]]} material={enmMat}><sphereGeometry args={[...G_ENM]} /></mesh>
      <instancedMesh ref={im} args={[bulGeo, bulMat, N]} frustumCulled={false} />
    </group>
  );
}

// ── M9 ── spawn reset: enemies fade out and respawn from new positions ─────────
function MagiOrb9Scene() {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const mats = [
    useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200", transparent: true, opacity: 1 }), []),
    useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200", transparent: true, opacity: 1 }), []),
    useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200", transparent: true, opacity: 1 }), []),
  ];
  useEffect(() => () => mats.forEach(m => m.dispose()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const plrMat = useStdMat("#aa44ff");
  const st = useRef({ phase: 0, timer: 2.5 });
  const ex = useRef([_EP[0][0], _EP[1][0], _EP[2][0]]);
  const ey = useRef([_EP[0][1], _EP[1][1], _EP[2][1]]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime(), dt = Math.min(delta, 0.05);
    const s = st.current;
    s.timer -= dt;
    if (s.phase === 0 && s.timer <= 0) { s.phase = 1; s.timer = 0.8; }
    if (s.phase === 1) {
      mats.forEach(m => { m.opacity = Math.max(0, m.opacity - dt * 1.5); });
      if (s.timer <= 0) {
        s.phase = 2; s.timer = 0.6;
        ex.current = [_EP[0][0]+(Math.random()-0.5)*0.4, _EP[1][0]+(Math.random()-0.5)*0.4, _EP[2][0]+(Math.random()-0.5)*0.3];
        ey.current = [_EP[0][1]+(Math.random()-0.5)*0.3, _EP[1][1]+(Math.random()-0.5)*0.3, (Math.random()-0.5)*0.4];
        mats.forEach(m => { m.opacity = 0; });
      }
    }
    if (s.phase === 2) {
      mats.forEach(m => { m.opacity = Math.min(1, m.opacity + dt * 2.5); });
      if (s.timer <= 0) { s.phase = 0; s.timer = 2.5; }
    }
    for (let i = 0; i < 3; i++) {
      ex.current[i] -= 0.4 * dt;
      if (ex.current[i] < -2.2) ex.current[i] = _EP[Math.min(i, 2)][0];
      if (refs[i].current) refs[i].current!.position.set(ex.current[i], ey.current[i] + Math.sin(t*(1+i*0.2)+i*1.5)*0.1, 0);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.28} />
      <pointLight position={[-1.2, 0, 2.5]} color="#aa44ff" intensity={2.0} distance={5} decay={2} />
      <mesh position={[-1.2, 0, 0]} material={plrMat}><sphereGeometry args={[...G_PLR]} /></mesh>
      <mesh ref={refs[0]} position={[..._EP[0]]} material={mats[0]}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={refs[1]} position={[..._EP[1]]} material={mats[1]}><sphereGeometry args={[...G_ENM]} /></mesh>
      <mesh ref={refs[2]} position={[..._EP[2]]} material={mats[2]}><sphereGeometry args={[0.22, 8, 6]} /></mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Category routers ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function WeaponScene({ value }: { value: WeaponType }) {
  switch (value) {
    case "orbital_rapid_blaster": return <RapidBlasterScene />;
    case "orbital_scattershot":   return <ScattershotScene />;
    case "spiral_shooter":        return <SpiralShooterScene />;
    case "overcharged_blaster":   return <OverchargedBlasterScene />;
    case "homing_launcher":       return <HomingScene />;
    case "sub_blaster":           return <SubBlasterScene />;
    default:                      return null;
  }
}

function DefenseScene({ value }: { value: DefenseType }) {
  switch (value) {
    case "orbital_teletransfer": return <TeletransferScene />;
    case "distort_field":        return <DistortFieldScene />;
    case "pulse_shield":         return <PulseShieldScene />;
    case "defense_system":       return <DefenseSystemScene />;
    case "spatial_relocation":   return <SpatialRelocationScene />;
    case "restoration":          return <RestorationScene />;
    case "armor":                return <ArmorScene />;
    default:                     return null;
  }
}

function MagiOrbScene({ value }: { value: MagiOrbType }) {
  switch (value) {
    case "magi_orb_1": return <MagiOrb1Scene />;
    case "magi_orb_2": return <MagiOrb2Scene />;
    case "magi_orb_3": return <MagiOrb3Scene />;
    case "magi_orb_4": return <MagiOrb4Scene />;
    case "magi_orb_5": return <MagiOrb5Scene />;
    case "magi_orb_6": return <MagiOrb6Scene />;
    case "magi_orb_7": return <MagiOrb7Scene />;
    case "magi_orb_8": return <MagiOrb8Scene />;
    case "magi_orb_9": return <MagiOrb9Scene />;
    default:           return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── ShopItemPreview — Canvas wrapper (mirrors AuraPreview design) ─────────────
// ─────────────────────────────────────────────────────────────────────────────
export type ShopItemPreviewCategory = "weapon" | "defense" | "magi_orb";

interface ShopItemPreviewProps {
  category: "weapon" | "defense" | "magi_orb";
  value: string;
  color: string;
  name: string;
}

export function ShopItemPreviewScene({
  category,
  value,
}: Pick<ShopItemPreviewProps, "category" | "value">) {
  if (category === "weapon") return <WeaponScene value={value as WeaponType} />;
  if (category === "defense") return <DefenseScene value={value as DefenseType} />;
  return <MagiOrbScene value={value as MagiOrbType} />;
}
