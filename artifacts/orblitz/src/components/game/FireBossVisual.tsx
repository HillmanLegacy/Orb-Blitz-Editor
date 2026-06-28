import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);

    float circleMask = smoothstep(0.5, 0.42, dist);
    if (circleMask < 0.01) discard;

    vec2 fUv = vUv;
    fUv.y -= time * 0.55;
    fUv.x += sin(time * 0.4 + vUv.y * 5.0) * 0.06;

    float n1 = fbm(fUv * 3.5 + vec2(0.0, time * 0.1));
    float n2 = fbm(fUv * 6.0 + vec2(4.2, time * 0.15));
    float n  = mix(n1, n2, 0.35) * 1.8;

    float radial = 1.0 - dist * 1.9;
    float fire = clamp(n * radial, 0.0, 1.0);

    // Sphere shading: top-left highlight
    float sphere = 1.0 - dist * 2.0;
    float highlight = smoothstep(0.0, 1.0, dot(uv + vec2(0.15, 0.15), vec2(-0.6, -0.6)));
    sphere = clamp(sphere + highlight * 0.3, 0.0, 1.0);

    vec3 crimson = vec3(0.72, 0.02, 0.04);
    vec3 orange  = vec3(1.0,  0.40, 0.0);
    vec3 yellow  = vec3(1.0,  0.92, 0.05);
    vec3 white   = vec3(1.0,  1.0,  0.85);

    vec3 col = crimson;
    col = mix(col, orange, clamp(fire * 1.6, 0.0, 1.0));
    col = mix(col, yellow, clamp((fire - 0.45) * 2.5, 0.0, 1.0));
    col = mix(col, white,  clamp((fire - 0.78) * 6.0, 0.0, 1.0));

    // Edge rim glow - hot orange
    float rim = smoothstep(0.48, 0.35, dist) * (1.0 - smoothstep(0.35, 0.15, dist));
    col = mix(col, vec3(1.0, 0.55, 0.0), rim * 0.6);

    // Sphere lighting boost
    col *= 0.75 + sphere * 0.45;

    float alpha = circleMask * (0.88 + fire * 0.12);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface FireBossVisualProps {
  bossSize: number;
  healthPercent: number;
  playerPosition: [number, number, number];
  bossPosition: [number, number, number];
}

export function FireBossVisual({ bossSize, healthPercent, playerPosition, bossPosition }: FireBossVisualProps) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    time: { value: 0 },
  }), []);

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  const angryScale = healthPercent < 0.3 ? 1.08 : 1;
  const sz = bossSize * angryScale;

  const dirX = playerPosition[0] - bossPosition[0];
  const dirY = playerPosition[1] - bossPosition[1];
  const d = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  const nx = dirX / d;
  const ny = dirY / d;
  const lookX = nx * 0.14;
  const lookY = ny * 0.07;

  const eyeSpacing = sz * 0.42;
  const eyeY = sz * 0.15;

  return (
    <group>
      {/* Outer glow */}
      <mesh scale={sz * 1.4} position={[0, 0, -0.06]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="#ff3300" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh scale={sz * 1.2} position={[0, 0, -0.04]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Fire orb shader */}
      <mesh scale={sz} position={[0, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Dark outline edge */}
      <mesh scale={sz * 1.02} position={[0, 0, -0.01]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#1a0000" transparent opacity={0.55} />
      </mesh>

      {/* Neon-yellow evil eyes - left */}
      {/* Sclera */}
      <mesh position={[-eyeSpacing, eyeY, 0.04]} scale={sz * 0.19}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ffff00" />
      </mesh>
      {/* Pupil */}
      <mesh position={[-eyeSpacing + lookX, eyeY + lookY, 0.05]} scale={sz * 0.10}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#1a0000" />
      </mesh>
      {/* Eye glow */}
      <mesh position={[-eyeSpacing, eyeY, 0.035]} scale={sz * 0.28} >
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ffff44" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Neon-yellow evil eyes - right */}
      <mesh position={[eyeSpacing, eyeY, 0.04]} scale={sz * 0.19}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ffff00" />
      </mesh>
      <mesh position={[eyeSpacing + lookX, eyeY + lookY, 0.05]} scale={sz * 0.10}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#1a0000" />
      </mesh>
      <mesh position={[eyeSpacing, eyeY, 0.035]} scale={sz * 0.28}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ffff44" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Angry brow lines */}
      <mesh position={[-eyeSpacing + sz * 0.08, eyeY + sz * 0.22, 0.06]}
        scale={[sz * 0.20, sz * 0.045, 1]}
        rotation={[0, 0, -0.45]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff4400" />
      </mesh>
      <mesh position={[eyeSpacing - sz * 0.08, eyeY + sz * 0.22, 0.06]}
        scale={[sz * 0.20, sz * 0.045, 1]}
        rotation={[0, 0, 0.45]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff4400" />
      </mesh>

      {/* Jagged mouth */}
      <mesh position={[0, -sz * 0.28, 0.04]} scale={[sz * 0.38, sz * 0.11, 1]}>
        <circleGeometry args={[1, 8]} />
        <meshBasicMaterial color="#0d0000" />
      </mesh>
      {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
        <mesh key={i} position={[x * sz, -sz * 0.21, 0.05]} scale={sz * 0.045} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[1, 3]} />
          <meshBasicMaterial color="#ffcc00" />
        </mesh>
      ))}

      {/* Orbiting fire embers */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const r = sz * 1.05;
        return (
          <FireEmber key={i} baseAngle={angle} radius={r} phaseOffset={i * 1.3} />
        );
      })}
    </group>
  );
}

function FireEmber({ baseAngle, radius, phaseOffset }: { baseAngle: number; radius: number; phaseOffset: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * 2.2 + phaseOffset;
    meshRef.current.position.x = Math.cos(t + baseAngle) * radius;
    meshRef.current.position.y = Math.sin(t + baseAngle) * radius * 0.75;
    const s = 0.06 + Math.sin(t * 3) * 0.025;
    meshRef.current.scale.setScalar(s);
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 0.02]}>
      <circleGeometry args={[1, 8]} />
      <meshBasicMaterial color="#ff8800" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
