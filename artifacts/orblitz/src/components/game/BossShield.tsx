/**
 * BossShield — high-fidelity 3-D energy-field shield used by all boss types.
 *
 * Layers:
 *  1. Hex-grid GLSL sphere  — Fresnel rim + animated energy lines
 *  2. Three counter-rotating torus rings at oblique angles
 *  3. Six energy-node satellites with additive glow
 *  4. Inner atmospheric glow sphere
 *  5. Periodic outward ripple pulse
 *  6. Arc filaments (InstancedMesh line-like quads) crawling across the surface
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── GLSL ─────────────────────────────────────────────────────────────────────

const hexVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vViewDir;
  void main() {
    vUv          = uv;
    vNormal      = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
    vViewDir     = normalize(-mvPos.xyz);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const hexFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewDir;

  // Hexagonal tiling (returns distance to nearest hex edge, 0 = inside cell)
  float hexDist(vec2 p) {
    p = abs(p);
    float c = dot(p, normalize(vec2(1.0, 1.732)));
    return max(c, p.x);
  }

  vec4 hexCoords(vec2 uv) {
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(uv,       r) - h;
    vec2 b = mod(uv - h,   r) - h;
    return dot(a,a) < dot(b,b) ? vec4(a, floor(uv / r)) : vec4(b, floor((uv - h) / r) + 0.5);
  }

  void main() {
    // Hex grid
    float scale = 6.0;
    vec4  hc    = hexCoords(vUv * scale);
    float d     = hexDist(hc.xy);
    float edge  = smoothstep(0.42, 0.46, d);      // 1 = inside hex cell, 0 = on line
    float line  = 1.0 - edge;                     // bright on the grid lines

    // Animated energy pulse flowing along lines
    float cellId = dot(hc.zw, vec2(13.7, 7.3));
    float pulse  = sin(uTime * 2.0 + cellId * 5.0) * 0.5 + 0.5;
    float energy = line * (0.55 + pulse * 0.45);

    // Fresnel rim — brighter at grazing angles
    float fresnel = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
    fresnel = pow(fresnel, 2.2);

    // Interior fill — very faint hex cells
    float fill = edge * 0.07;

    float alpha = (energy * 0.85 + fresnel * 0.5 + fill) * uOpacity;

    // Shimmer: animated hotspot moving across surface
    float hotspot = sin(vUv.x * 12.0 + uTime * 1.8) * sin(vUv.y * 12.0 - uTime * 1.3);
    alpha += hotspot * 0.06 * uOpacity;

    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Arc filaments ─────────────────────────────────────────────────────────────

const ARC_COUNT = 18;
const _dummy = new THREE.Object3D();

interface Arc {
  theta: number;   // longitude
  phi:   number;   // latitude
  len:   number;
  width: number;
  speed: number;
  life:  number;
  maxLife: number;
}

function newArc(seed: number): Arc {
  return {
    theta:   Math.random() * Math.PI * 2,
    phi:     Math.acos(2 * Math.random() - 1),
    len:     0.18 + Math.random() * 0.38,
    width:   0.028 + Math.random() * 0.038,
    speed:   0.6 + Math.random() * 1.4,
    life:    Math.random() * (0.4 + seed * 0.3),
    maxLife: 0.4 + Math.random() * 0.7,
  };
}

function ArcFilaments({ radius, color }: { radius: number; color: THREE.Color }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const arcs    = useRef<Arc[]>(Array.from({ length: ARC_COUNT }, (_, i) => newArc(i)));

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    arcs.current.forEach((arc, i) => {
      arc.life -= delta;
      if (arc.life <= 0) {
        Object.assign(arc, newArc(i));
        arc.life = arc.maxLife;
      }
      arc.theta += delta * arc.speed * 0.3;

      const r     = radius * 1.005;
      const x     = r * Math.sin(arc.phi) * Math.cos(arc.theta);
      const y     = r * Math.cos(arc.phi);
      const z     = r * Math.sin(arc.phi) * Math.sin(arc.theta);

      _dummy.position.set(x, y, z);
      // Orient quad tangent to sphere surface
      const normal = new THREE.Vector3(x, y, z).normalize();
      const up     = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const right  = new THREE.Vector3().crossVectors(normal, up).normalize();
      const fwd    = new THREE.Vector3().crossVectors(right, normal).normalize();
      _dummy.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, fwd, normal)
      );
      const lifeRatio = Math.max(0, arc.life / arc.maxLife);
      _dummy.scale.set(arc.width * radius, arc.len * radius, 1);
      _dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, _dummy.matrix);

      // fade at ends of life
      const mat = meshRef.current!.material as THREE.MeshBasicMaterial;
      (mat as any).opacity = 0.9;   // per-instance color encodes brightness
      meshRef.current!.setColorAt(
        i,
        new THREE.Color().copy(color).multiplyScalar(0.6 + lifeRatio * 0.6)
      );
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ARC_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BossShieldProps {
  bossType?: string;
}

const SHIELD_COLORS: Record<string, string> = {
  circle:   "#00ffff",
  star:     "#ffdd00",
  arrow:    "#ff8844",
  triangle: "#44ffaa",
  trapezoid:"#ff44cc",
  cube:     "#8888ff",
  cloud:    "#aaccff",
  tentacle: "#44ffcc",
  monster:  "#ff4444",
  bird:     "#aaff44",
};

export function BossShield({ bossType = "circle" }: BossShieldProps) {
  const hexMatRef   = useRef<THREE.ShaderMaterial>(null);
  const rippleRef   = useRef<THREE.Mesh>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);
  const ringRefs    = useRef<(THREE.Mesh | null)[]>([]);

  // Satellite node refs (6 nodes × 3 meshes = outer glow, mid sphere, inner core)
  const nodeGroupRef = useRef<THREE.Group>(null);

  const colorHex = SHIELD_COLORS[bossType] ?? "#00ffff";
  const threeColor = useMemo(() => new THREE.Color(colorHex), [colorHex]);

  const hexUniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uColor:   { value: threeColor.clone() },
    uOpacity: { value: 0.9 },
  }), [threeColor]);

  // Torus ring definitions — three oblique angles, counter-rotating pairs
  const ringDefs = useMemo(() => [
    { rotX: Math.PI / 2,   rotZ: 0,          spinX:  0.45, spinZ:  0 },
    { rotX: Math.PI / 4,   rotZ: Math.PI / 3, spinX: -0.3,  spinZ:  0.55 },
    { rotX: 0.2,           rotZ: Math.PI / 2, spinX:  0,    spinZ: -0.4  },
  ], []);

  // Satellite node orbit data
  const nodes = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      baseAngle: (i / 6) * Math.PI * 2,
      tilt:      (i % 3) * (Math.PI / 3),
      speed:     0.5 + (i % 2) * 0.35,
      radius:    4.1,
    }))
  , []);

  const ripplePhaseRef = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // ── Hex shader uniform ──────────────────────────────────────────────
    if (hexMatRef.current) {
      hexMatRef.current.uniforms.uTime.value   = t;
      hexMatRef.current.uniforms.uOpacity.value = 0.82 + Math.sin(t * 1.8) * 0.08;
    }

    // ── Torus rings ─────────────────────────────────────────────────────
    ringRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const def = ringDefs[i];
      mesh.rotation.x = def.rotX + t * def.spinX;
      mesh.rotation.z = def.rotZ + t * def.spinZ;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 3 + i * 1.2) * 0.2;
    });

    // ── Ripple pulse ─────────────────────────────────────────────────────
    ripplePhaseRef.current = (ripplePhaseRef.current + delta * 0.8) % 1;
    if (rippleRef.current) {
      const rp = ripplePhaseRef.current;
      const rs = 3.6 + rp * 1.8;           // expands outward
      const ro = Math.max(0, (1 - rp * 2.2) * 0.6);  // fades quickly
      rippleRef.current.scale.setScalar(rs);
      (rippleRef.current.material as THREE.MeshBasicMaterial).opacity = ro;
    }

    // ── Inner glow breathe ───────────────────────────────────────────────
    if (innerGlowRef.current) {
      const breathe = 1 + Math.sin(t * 2.2) * 0.04;
      innerGlowRef.current.scale.setScalar(3.55 * breathe);
      (innerGlowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.08 + Math.sin(t * 1.5) * 0.025;
    }

    // ── Satellite nodes orbit ────────────────────────────────────────────
    if (nodeGroupRef.current) {
      nodes.forEach((node, i) => {
        const child = nodeGroupRef.current!.children[i] as THREE.Group;
        if (!child) return;
        const angle = node.baseAngle + t * node.speed;
        const x = Math.cos(angle) * node.radius;
        const y = Math.sin(angle * 0.7 + node.tilt) * node.radius * 0.65;
        const z = Math.sin(angle) * node.radius * 0.8;
        child.position.set(x, y, z);
        child.rotation.y = t * 2.0 + i;
        child.rotation.x = t * 1.3 + i;
      });
    }
  });

  return (
    <group>
      {/* ── Hex-grid energy sphere ───────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[3.7, 64, 48]} />
        <shaderMaterial
          ref={hexMatRef}
          uniforms={hexUniforms}
          vertexShader={hexVert}
          fragmentShader={hexFrag}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── Inner atmospheric glow ────────────────────────────────────── */}
      <mesh ref={innerGlowRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color={colorHex}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── Three oblique torus rings ────────────────────────────────── */}
      {ringDefs.map((def, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el; }}>
          <torusGeometry args={[3.82 + i * 0.09, 0.055 - i * 0.008, 10, 80]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Ripple pulse sphere ───────────────────────────────────────── */}
      <mesh ref={rippleRef}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshBasicMaterial
          color={colorHex}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── Satellite energy nodes ────────────────────────────────────── */}
      <group ref={nodeGroupRef}>
        {nodes.map((_, i) => (
          <group key={i}>
            {/* Outer soft glow */}
            <mesh>
              <sphereGeometry args={[0.28, 8, 6]} />
              <meshBasicMaterial
                color={colorHex}
                transparent
                opacity={0.25}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {/* Core node */}
            <mesh>
              <sphereGeometry args={[0.13, 8, 6]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {/* Connecting spike toward center */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.002, 4.2, 4, 1]} />
              <meshBasicMaterial
                color={colorHex}
                transparent
                opacity={0.18}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── Arc filaments on sphere surface ───────────────────────────── */}
      <ArcFilaments radius={3.7} color={threeColor} />
    </group>
  );
}
