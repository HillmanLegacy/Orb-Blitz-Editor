import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const WORLD_BACKGROUNDS: Record<number, {
  bgHue: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  animStyle: "pulse" | "spiral" | "wave" | "electric" | "cosmic" | "flame" | "frost" | "vortex" | "chaos";
}> = {
  1: { bgHue: 0.55, primaryColor: "#00ffff", secondaryColor: "#0088ff", accentColor: "#00ffcc", animStyle: "pulse" },
  2: { bgHue: 0.12, primaryColor: "#ffd700", secondaryColor: "#ff8800", accentColor: "#ffaa00", animStyle: "spiral" },
  3: { bgHue: 0.00, primaryColor: "#ff3333", secondaryColor: "#ff0066", accentColor: "#ff6644", animStyle: "wave" },
  4: { bgHue: 0.85, primaryColor: "#ff00ff", secondaryColor: "#cc00ff", accentColor: "#ff66ff", animStyle: "electric" },
  5: { bgHue: 0.35, primaryColor: "#00ff66", secondaryColor: "#00cc44", accentColor: "#66ff99", animStyle: "cosmic" },
  6: { bgHue: 0.75, primaryColor: "#9966ff", secondaryColor: "#6633cc", accentColor: "#cc99ff", animStyle: "electric" },
  7: { bgHue: 0.92, primaryColor: "#ff66cc", secondaryColor: "#ff3399", accentColor: "#ffaadd", animStyle: "flame" },
  8: { bgHue: 0.60, primaryColor: "#3399ff", secondaryColor: "#0066cc", accentColor: "#66ccff", animStyle: "frost" },
  9: { bgHue: 0.02, primaryColor: "#dc143c", secondaryColor: "#8b0000", accentColor: "#ff4444", animStyle: "chaos" },
};

const floorGridGeo = (() => {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const Y = -16;
  for (let xi = -10; xi <= 10; xi++) {
    positions.push(xi * 3.5, Y, -4,  xi * 3.5, Y, -52);
  }
  for (let zi = 0; zi <= 28; zi++) {
    const z = -4 - zi * 1.75;
    positions.push(-35, Y, z,  35, Y, z);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
})();

const sideGridGeoL = (() => {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const X = -35;
  for (let yi = -8; yi <= 8; yi++) {
    positions.push(X, yi * 2.5, -4,  X, yi * 2.5, -52);
  }
  for (let zi = 0; zi <= 28; zi++) {
    const z = -4 - zi * 1.75;
    positions.push(X, -20, z,  X, 20, z);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
})();

const sideGridGeoR = (() => {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const X = 35;
  for (let yi = -8; yi <= 8; yi++) {
    positions.push(X, yi * 2.5, -4,  X, yi * 2.5, -52);
  }
  for (let zi = 0; zi <= 28; zi++) {
    const z = -4 - zi * 1.75;
    positions.push(X, -20, z,  X, 20, z);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
})();

export function Background() {
  const starRefs       = useRef<THREE.Mesh[]>([]);
  const shapeRefs      = useRef<THREE.Mesh[]>([]);
  const nebulaRefs     = useRef<THREE.Mesh[]>([]);
  const orbRefs        = useRef<THREE.Group[]>([]);
  const meteorRefs     = useRef<THREE.Mesh[]>([]);
  const pulseRefs      = useRef<THREE.Group[]>([]);
  const coreRef        = useRef<THREE.Group>(null);
  const floorRef       = useRef<THREE.LineSegments>(null);
  const sideRefL       = useRef<THREE.LineSegments>(null);
  const sideRefR       = useRef<THREE.LineSegments>(null);
  const spiralOrbRefs  = useRef<THREE.Mesh[]>([]);

  const {
    backgroundPulse, backgroundShake, updateBackgroundEffects,
    distortActive, gameTime, phase, arcadeLevel, gameMode, playerPosition,
  } = useMagicOrb();

  const worldLevel  = gameMode === "arcade" ? Math.floor(arcadeLevel) : 0;
  const worldConfig = WORLD_BACKGROUNDS[worldLevel] ?? WORLD_BACKGROUNDS[1];

  const stars = useMemo(() => Array.from({ length: 130 }, () => ({
    pos: [
      (Math.random() - 0.5) * 90,
      (Math.random() - 0.5) * 65,
      -32 - Math.random() * 18,
    ] as [number, number, number],
    scale:   0.025 + Math.random() * 0.055,
    twinkle: 2.5 + Math.random() * 9,
    phase:   Math.random() * Math.PI * 2,
    hue:     Math.random(),
  })), []);

  const shapes = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    pos: [
      (Math.random() - 0.5) * 68,
      (Math.random() - 0.5) * 50,
      -10 - Math.random() * 18,
    ] as [number, number, number],
    scale:    0.35 + Math.random() * 1.5,
    rx: Math.random() * 0.8 + 0.2,
    ry: Math.random() * 0.6 + 0.15,
    rz: Math.random() * 0.5 + 0.1,
    phase:   Math.random() * Math.PI * 2,
    hue:     (i / 36),
    type:    i % 5,
    floatAmp: 0.5 + Math.random() * 1.5,
    floatFreq: 0.3 + Math.random() * 0.5,
    baseX:   (Math.random() - 0.5) * 68,
    baseY:   (Math.random() - 0.5) * 50,
  })), []);

  const nebulae = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    pos: [
      (Math.random() - 0.5) * 70,
      (Math.random() - 0.5) * 50,
      -28 - Math.random() * 14,
    ] as [number, number, number],
    scale:     12 + Math.random() * 18,
    hue:       (i / 10),
    pulseFreq: 0.2 + Math.random() * 0.6,
    phase:     Math.random() * Math.PI * 2,
  })), []);

  const energyOrbs = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    return {
      base: [Math.cos(a) * 22, Math.sin(a) * 16, -20] as [number, number, number],
      size:      1.4 + Math.random() * 0.8,
      pulseFreq: 1.2 + Math.random(),
      orbitSpd:  0.07 + Math.random() * 0.08,
      hue:       i / 7,
      phase:     Math.random() * Math.PI * 2,
    };
  }), []);

  const spiralOrbs = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    angle:  (i / 24) * Math.PI * 2,
    radius: 30 + Math.random() * 8,
    z:      -24 - Math.random() * 8,
    size:   0.15 + Math.random() * 0.25,
    speed:  0.04 + Math.random() * 0.06,
    hue:    i / 24,
    phase:  Math.random() * Math.PI * 2,
  })), []);

  const meteors = useMemo(() => Array.from({ length: 12 }, () => ({
    startX:   -40 + Math.random() * 80,
    startY:   28 + Math.random() * 12,
    speedX:   30 + Math.random() * 30,
    speedY:  -45 - Math.random() * 25,
    len:      0.6 + Math.random() * 1.2,
    width:    0.05 + Math.random() * 0.08,
    delay:    Math.random() * 12,
    duration: 1.0 + Math.random() * 0.8,
    hue:      Math.random(),
  })), []);

  const pulseRings = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    delay:     i * 1.4,
    maxRadius: 22 + i * 5,
    hue:       i / 5,
  })), []);

  const frameCount = useRef(0);
  const intensityRef = useRef(0);
  const chaosRef = useRef(0);

  useFrame((state, delta) => {
    if (phase !== "playing") return;
    const t = state.clock.getElapsedTime();
    frameCount.current++;

    updateBackgroundEffects(delta);

    if (frameCount.current % 4 === 0) {
      intensityRef.current = Math.min(1, gameTime / 90);
      chaosRef.current     = Math.pow(intensityRef.current, 1.5);
    }
    const intensity  = intensityRef.current;
    const chaos      = chaosRef.current;
    const colorSpeed = gameMode === "chill" ? 0.04 : 0.08 + chaos * 0.28;
    const animSpeed  = gameMode === "chill" ? 0.35 : 1 + chaos * 2.2;
    const saturation = 0.92;
    const brightness = 0.52 + chaos * 0.08;

    const pX = playerPosition[0];
    const pY = playerPosition[1];

    if (floorRef.current) {
      const mat = floorRef.current.material as THREE.LineBasicMaterial;
      const hue = ((t * colorSpeed) % 1);
      mat.color.setHSL(hue, saturation, brightness * 0.55);
      mat.opacity = 0.12 + Math.sin(t * 1.4) * 0.04 + backgroundPulse * 0.12;
      floorRef.current.position.z = (t * (0.8 + chaos) * 1.75) % 1.75;
      if (backgroundShake > 0) {
        floorRef.current.position.x = pX * 0.12 + (Math.random() - 0.5) * backgroundShake * 0.3;
      } else {
        floorRef.current.position.x = pX * 0.12;
      }
    }
    if (sideRefL.current) {
      const mat = sideRefL.current.material as THREE.LineBasicMaterial;
      mat.color.setHSL(((t * colorSpeed + 0.33) % 1), saturation, brightness * 0.45);
      mat.opacity = 0.09 + Math.sin(t * 1.1 + 1) * 0.03 + backgroundPulse * 0.08;
      sideRefL.current.position.z = (t * (0.8 + chaos) * 1.75) % 1.75;
      sideRefL.current.position.y = pY * 0.1;
    }
    if (sideRefR.current) {
      const mat = sideRefR.current.material as THREE.LineBasicMaterial;
      mat.color.setHSL(((t * colorSpeed + 0.66) % 1), saturation, brightness * 0.45);
      mat.opacity = 0.09 + Math.sin(t * 1.1 + 2) * 0.03 + backgroundPulse * 0.08;
      sideRefR.current.position.z = (t * (0.8 + chaos) * 1.75) % 1.75;
      sideRefR.current.position.y = pY * 0.1;
    }

    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.12 * animSpeed;
      coreRef.current.rotation.z = t * 0.07 * animSpeed;
      const pulseScale = 1 + backgroundPulse * 0.4 + Math.sin(t * 2.2) * 0.08;
      coreRef.current.scale.setScalar(pulseScale);
      coreRef.current.position.set(pX * 0.08, pY * 0.08, -38);
      coreRef.current.children.forEach((child, j) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.color.setHSL(((t * colorSpeed + j * 0.12) % 1), saturation, brightness);
        }
      });
    }

    starRefs.current.forEach((mesh, i) => {
      if (!mesh || !stars[i]) return;
      const s = stars[i];
      const twinkle = Math.sin(t * s.twinkle * animSpeed + s.phase) * 0.5 + 0.5;
      mesh.scale.setScalar(s.scale * (0.4 + twinkle * 0.6));
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHSL(((t * colorSpeed * 0.4 + s.hue) % 1), saturation * 0.6, Math.min(1, brightness + 0.3));
      mat.opacity = 0.4 + twinkle * 0.55;
    });

    shapeRefs.current.forEach((mesh, i) => {
      if (!mesh || !shapes[i]) return;
      const sh = shapes[i];
      mesh.rotation.x += sh.rx * 0.008 * animSpeed;
      mesh.rotation.y += sh.ry * 0.006 * animSpeed;
      mesh.rotation.z += sh.rz * 0.005 * animSpeed;
      mesh.position.x = sh.baseX + Math.sin(t * sh.floatFreq * animSpeed + sh.phase) * sh.floatAmp;
      mesh.position.y = sh.baseY + Math.cos(t * sh.floatFreq * 0.7 * animSpeed + sh.phase) * sh.floatAmp * 0.7;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHSL(((t * colorSpeed + sh.hue) % 1), saturation, brightness);
      mat.opacity = 0.18 + Math.sin(t * 1.6 + sh.phase) * 0.08 + backgroundPulse * 0.1;
    });

    nebulaRefs.current.forEach((mesh, i) => {
      if (!mesh || !nebulae[i]) return;
      const nb = nebulae[i];
      const pulse = Math.sin(t * nb.pulseFreq * animSpeed + nb.phase) * 0.12 + 1;
      mesh.scale.setScalar(nb.scale * pulse);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHSL(((t * colorSpeed * 0.25 + nb.hue) % 1), saturation * 0.75, brightness * 0.5);
      mat.opacity = 0.025 + Math.sin(t * 0.4 + nb.phase) * 0.012;
    });

    orbRefs.current.forEach((group, i) => {
      if (!group || !energyOrbs[i]) return;
      const orb = energyOrbs[i];
      const ox = orb.base[0] + Math.sin(t * orb.orbitSpd * animSpeed + orb.phase) * 5;
      const oy = orb.base[1] + Math.cos(t * orb.orbitSpd * 0.7 * animSpeed + orb.phase) * 3.5;
      group.position.set(ox, oy, orb.base[2]);
      const pulse = 1 + Math.sin(t * orb.pulseFreq) * 0.28 + backgroundPulse * 0.2;
      group.scale.setScalar(pulse);
      group.rotation.z = t * 0.4 * animSpeed;
      group.rotation.x = t * 0.22 * animSpeed;
      group.children.forEach((child, j) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.color.setHSL(((t * colorSpeed + orb.hue + j * 0.08) % 1), saturation, brightness);
          mat.opacity = j === 0 ? 0.55 : 0.12 - j * 0.02;
        }
      });
    });

    spiralOrbRefs.current.forEach((mesh, i) => {
      if (!mesh || !spiralOrbs[i]) return;
      const so = spiralOrbs[i];
      const angle = so.angle + t * so.speed * animSpeed;
      mesh.position.x = Math.cos(angle) * so.radius;
      mesh.position.y = Math.sin(angle) * so.radius * 0.55;
      mesh.position.z = so.z + Math.sin(t * 0.6 + so.phase) * 2;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHSL(((t * colorSpeed + so.hue) % 1), saturation, brightness + 0.1);
      const twinkle = Math.sin(t * 3 + so.phase) * 0.5 + 0.5;
      mat.opacity = 0.3 + twinkle * 0.45 + backgroundPulse * 0.2;
    });

    meteorRefs.current.forEach((mesh, i) => {
      if (!mesh || !meteors[i]) return;
      const m = meteors[i];
      const cycle = (t + m.delay) % (m.duration + 6);
      if (cycle < m.duration) {
        const p = cycle / m.duration;
        mesh.position.x = m.startX + p * m.speedX * m.duration;
        mesh.position.y = m.startY + p * m.speedY * m.duration;
        mesh.visible = true;
        mesh.rotation.z = Math.atan2(m.speedY, m.speedX);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const fade = Math.min(1, p * 5) * Math.max(0, 1 - (p - 0.65) * 3);
        mat.opacity = fade * 0.85;
        mat.color.setHSL(((t * colorSpeed + m.hue) % 1), 1, 0.85);
      } else {
        mesh.visible = false;
      }
    });

    pulseRefs.current.forEach((group, i) => {
      if (!group || !pulseRings[i]) return;
      const pr = pulseRings[i];
      const cycle = (t + pr.delay) % 5.5;
      const p = cycle / 5.5;
      const r = p * pr.maxRadius;
      group.scale.setScalar(r / 10);
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, (1 - p) * (1 - p)) * 0.22;
          mat.color.setHSL(((t * colorSpeed + pr.hue) % 1), saturation, brightness + 0.1);
        }
      });
    });
  });

  const bgColor = useMemo(
    () => new THREE.Color().setHSL(worldConfig.bgHue, 0.88, 0.014),
    [worldConfig.bgHue]
  );

  return (
    <>
      <color attach="background" args={[bgColor]} />

      <ambientLight intensity={0.14} color={worldConfig.primaryColor} />
      <pointLight position={[0, 0, 8]}  intensity={1.1 + backgroundPulse * 0.5} color={worldConfig.primaryColor}   distance={60} decay={1.4} />
      <pointLight position={[-18, 12, 2]} intensity={0.55} color={worldConfig.secondaryColor} distance={45} decay={1.4} />
      <pointLight position={[18, -12, 2]} intensity={0.55} color={worldConfig.accentColor}    distance={45} decay={1.4} />
      <pointLight position={[0, 0, -20]} intensity={0.35} color={worldConfig.primaryColor}    distance={55} decay={1.4} />

      {/* ── 3D perspective floor grid ── */}
      <lineSegments ref={floorRef} geometry={floorGridGeo}>
        <lineBasicMaterial color="#00ffff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* ── Side wall grids ── */}
      <lineSegments ref={sideRefL} geometry={sideGridGeoL}>
        <lineBasicMaterial color="#ff00ff" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments ref={sideRefR} geometry={sideGridGeoR}>
        <lineBasicMaterial color="#ff00ff" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* ── Galaxy core — layered glowing spheres far back ── */}
      <group ref={coreRef} position={[0, 0, -38]}>
        <mesh>
          <sphereGeometry args={[14, 14, 10]} />
          <meshBasicMaterial color={worldConfig.primaryColor} transparent opacity={0.028} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[9, 12, 8]} />
          <meshBasicMaterial color={worldConfig.secondaryColor} transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[5, 10, 8]} />
          <meshBasicMaterial color={worldConfig.accentColor} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[8, 1]} />
          <meshBasicMaterial color={worldConfig.primaryColor} wireframe transparent opacity={0.055} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* ── Nebula volumes — far back ── */}
      {nebulae.map((nb, i) => (
        <mesh
          key={`neb-${i}`}
          ref={(el) => { if (el) nebulaRefs.current[i] = el; }}
          position={nb.pos}
          scale={nb.scale}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial
            color={worldConfig.primaryColor}
            transparent
            opacity={0.025}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Stars — tiny 3D particles deep back ── */}
      {stars.map((s, i) => (
        <mesh
          key={`star-${i}`}
          ref={(el) => { if (el) starRefs.current[i] = el; }}
          position={s.pos}
          scale={s.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Floating wireframe polyhedra — mid background ── */}
      {shapes.map((sh, i) => (
        <mesh
          key={`shape-${i}`}
          ref={(el) => { if (el) shapeRefs.current[i] = el; }}
          position={sh.pos}
          scale={sh.scale}
        >
          {sh.type === 0 && <icosahedronGeometry args={[1, 0]} />}
          {sh.type === 1 && <octahedronGeometry args={[1, 0]} />}
          {sh.type === 2 && <dodecahedronGeometry args={[1, 0]} />}
          {sh.type === 3 && <tetrahedronGeometry args={[1, 0]} />}
          {sh.type === 4 && <boxGeometry args={[1, 1, 1]} />}
          <meshBasicMaterial
            color={worldConfig.primaryColor}
            wireframe
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Energy orbs — sphere core + 3D torus halos ── */}
      {energyOrbs.map((orb, i) => (
        <group
          key={`orb-${i}`}
          ref={(el) => { if (el) orbRefs.current[i] = el; }}
          position={orb.base}
        >
          <mesh>
            <sphereGeometry args={[orb.size, 12, 10]} />
            <meshBasicMaterial color={worldConfig.primaryColor} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[orb.size * 1.9, orb.size * 0.06, 6, 24]} />
            <meshBasicMaterial color={worldConfig.secondaryColor} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <torusGeometry args={[orb.size * 2.5, orb.size * 0.04, 6, 24]} />
            <meshBasicMaterial color={worldConfig.accentColor} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* ── Spiral ring of small orbs ── */}
      {spiralOrbs.map((so, i) => (
        <mesh
          key={`spiral-${i}`}
          ref={(el) => { if (el) spiralOrbRefs.current[i] = el; }}
          position={[Math.cos(so.angle) * so.radius, Math.sin(so.angle) * so.radius * 0.55, so.z]}
          scale={so.size}
        >
          <sphereGeometry args={[1, 5, 4]} />
          <meshBasicMaterial color={worldConfig.accentColor} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Meteors ── */}
      {meteors.map((m, i) => (
        <mesh
          key={`meteor-${i}`}
          ref={(el) => { if (el) meteorRefs.current[i] = el; }}
          position={[m.startX, m.startY, -18]}
          visible={false}
        >
          <boxGeometry args={[m.width, m.len * 3, m.width * 0.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Expanding 3D pulse rings (torusGeometry) ── */}
      {pulseRings.map((pr, i) => (
        <group
          key={`pulse-${i}`}
          ref={(el) => { if (el) pulseRefs.current[i] = el; }}
          position={[0, 0, -26]}
        >
          <mesh>
            <torusGeometry args={[10, 0.25, 6, 48]} />
            <meshBasicMaterial color={worldConfig.primaryColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* ── Distort active: 3D rings around player ── */}
      {distortActive && (
        <group position={[playerPosition[0], playerPosition[1], -6]}>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[4.5, 0.18, 8, 48]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <torusGeometry args={[6, 0.12, 8, 48]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[7.5, 0.08, 6, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      )}
    </>
  );
}
