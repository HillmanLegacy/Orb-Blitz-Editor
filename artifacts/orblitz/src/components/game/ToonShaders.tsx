import * as THREE from "three";
import { useMemo } from "react";
import { extend, useFrame } from "@react-three/fiber";

export const toonVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const toonFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uLightColor;
  uniform vec3 uLightPosition;
  uniform float uSteps;
  uniform float uRimPower;
  uniform vec3 uRimColor;
  uniform float uAmbientStrength;
  uniform float uSpecularStrength;
  uniform float uShininess;
  
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightPosition);
    vec3 viewDir = normalize(vViewPosition);
    
    // Diffuse with cel-shading bands
    float diff = max(dot(normal, lightDir), 0.0);
    float toonDiff = ceil(diff * uSteps) / uSteps;
    
    // Specular highlight with cel-shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    float toonSpec = step(0.5, spec) * uSpecularStrength;
    
    // Rim lighting (Fresnel-like edge glow)
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = pow(rim, uRimPower);
    
    // Combine lighting
    vec3 ambient = uColor * uAmbientStrength;
    vec3 diffuse = uColor * uLightColor * toonDiff;
    vec3 specular = uLightColor * toonSpec;
    vec3 rimLight = uRimColor * rim;
    
    vec3 finalColor = ambient + diffuse + specular + rimLight;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const outlineVertexShader = `
  uniform float uOutlineWidth;
  
  void main() {
    vec3 pos = position + normal * uOutlineWidth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const outlineFragmentShader = `
  uniform vec3 uOutlineColor;
  
  void main() {
    gl_FragColor = vec4(uOutlineColor, 1.0);
  }
`;

export const rayTracingGlowVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const rayTracingGlowFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFalloff;
  uniform float uTime;
  uniform float uNoiseScale;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  // Simplex noise for volumetric effect
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center) * 2.0;
    
    // Volumetric falloff with noise
    float noise = snoise(vUv * uNoiseScale + uTime * 0.5) * 0.1;
    float glow = pow(1.0 - clamp(dist + noise, 0.0, 1.0), uFalloff);
    
    // Color intensity based on distance
    vec3 color = uColor * uIntensity * glow;
    float alpha = glow * uIntensity;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export const ambientOcclusionFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uRadius;
  
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center) * 2.0;
    
    // Inner shadow for ambient occlusion effect
    float ao = smoothstep(0.0, uRadius, dist);
    ao = pow(ao, 2.0);
    
    vec3 color = uColor * (1.0 - ao * uIntensity);
    
    gl_FragColor = vec4(color, ao * uIntensity * 0.5);
  }
`;

export const screenSpaceReflectionFragmentShader = `
  uniform vec3 uColor;
  uniform float uReflectivity;
  uniform float uTime;
  
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center) * 2.0;
    
    // Reflection based on viewing angle (Fresnel approximation)
    float fresnel = pow(1.0 - (1.0 - dist), 3.0);
    
    // Animated caustics
    float caustic = sin(vUv.x * 10.0 + uTime * 2.0) * sin(vUv.y * 10.0 + uTime * 1.5) * 0.5 + 0.5;
    
    vec3 reflection = uColor * fresnel * uReflectivity;
    reflection += vec3(1.0) * caustic * fresnel * 0.2;
    
    gl_FragColor = vec4(reflection, fresnel * uReflectivity);
  }
`;

export function useToonMaterial(
  color: string,
  options?: {
    steps?: number;
    rimPower?: number;
    rimColor?: string;
    ambientStrength?: number;
    specularStrength?: number;
    shininess?: number;
  }
) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uLightColor: { value: new THREE.Color("#ffffff") },
    uLightPosition: { value: new THREE.Vector3(0, 0, 10) },
    uSteps: { value: options?.steps ?? 4 },
    uRimPower: { value: options?.rimPower ?? 2.5 },
    uRimColor: { value: new THREE.Color(options?.rimColor ?? color).multiplyScalar(0.5) },
    uAmbientStrength: { value: options?.ambientStrength ?? 0.3 },
    uSpecularStrength: { value: options?.specularStrength ?? 0.5 },
    uShininess: { value: options?.shininess ?? 32 },
  }), [color, options]);

  return (
    <shaderMaterial
      vertexShader={toonVertexShader}
      fragmentShader={toonFragmentShader}
      uniforms={uniforms}
    />
  );
}

export function useOutlineMaterial(color: string, width: number = 0.03) {
  const uniforms = useMemo(() => ({
    uOutlineColor: { value: new THREE.Color(color) },
    uOutlineWidth: { value: width },
  }), [color, width]);

  return (
    <shaderMaterial
      vertexShader={outlineVertexShader}
      fragmentShader={outlineFragmentShader}
      uniforms={uniforms}
      side={THREE.BackSide}
    />
  );
}

export function ToonOrbLayer({
  scale,
  color,
  steps = 4,
  rimColor,
  rimPower = 2.5,
}: {
  scale: number;
  color: string;
  steps?: number;
  rimColor?: string;
  rimPower?: number;
}) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uLightColor: { value: new THREE.Color("#ffffff") },
    uLightPosition: { value: new THREE.Vector3(0, 0, 10) },
    uSteps: { value: steps },
    uRimPower: { value: rimPower },
    uRimColor: { value: new THREE.Color(rimColor ?? color).multiplyScalar(0.8) },
    uAmbientStrength: { value: 0.35 },
    uSpecularStrength: { value: 0.6 },
    uShininess: { value: 48 },
  }), [color, steps, rimColor, rimPower]);

  return (
    <mesh scale={scale}>
      <circleGeometry args={[1, 48]} />
      <shaderMaterial
        vertexShader={toonVertexShader}
        fragmentShader={toonFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function CelOutline({
  scale,
  color,
  width = 0.04,
}: {
  scale: number;
  color: string;
  width?: number;
}) {
  return (
    <mesh scale={scale * (1 + width)}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

export function RayTracedGlow({
  scale,
  color,
  intensity = 1.0,
  falloff = 2.0,
  time = 0,
}: {
  scale: number;
  color: string;
  intensity?: number;
  falloff?: number;
  time?: number;
}) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uFalloff: { value: falloff },
    uTime: { value: time },
    uNoiseScale: { value: 3.0 },
  }), [color, intensity, falloff]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={scale}>
      <circleGeometry args={[1, 48]} />
      <shaderMaterial
        vertexShader={rayTracingGlowVertexShader}
        fragmentShader={rayTracingGlowFragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function AmbientOcclusionLayer({
  scale,
  color = "#000000",
  intensity = 0.4,
}: {
  scale: number;
  color?: string;
  intensity?: number;
}) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uRadius: { value: 0.8 },
  }), [color, intensity]);

  return (
    <mesh scale={scale} position={[0, 0, -0.02]}>
      <circleGeometry args={[1, 32]} />
      <shaderMaterial
        fragmentShader={ambientOcclusionFragmentShader}
        vertexShader={rayTracingGlowVertexShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export function GlobalIlluminationBounce({
  scale,
  primaryColor,
  bounceColor,
  intensity = 0.3,
}: {
  scale: number;
  primaryColor: string;
  bounceColor: string;
  intensity?: number;
}) {
  return (
    <group>
      <mesh scale={scale * 1.3} position={[0, -0.2, -0.05]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial 
          color={bounceColor} 
          transparent 
          opacity={intensity * 0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={scale * 1.15} position={[0.1, 0.15, -0.03]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial 
          color={primaryColor} 
          transparent 
          opacity={intensity * 0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function ScreenSpaceReflection({
  scale,
  color,
  reflectivity = 0.5,
  time = 0,
}: {
  scale: number;
  color: string;
  reflectivity?: number;
  time?: number;
}) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uReflectivity: { value: reflectivity },
    uTime: { value: time },
  }), [color, reflectivity]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={scale} position={[0, 0, 0.03]}>
      <circleGeometry args={[1, 48]} />
      <shaderMaterial
        vertexShader={rayTracingGlowVertexShader}
        fragmentShader={screenSpaceReflectionFragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function CausticPattern({
  scale,
  color,
  intensity = 0.2,
  time = 0,
}: {
  scale: number;
  color: string;
  intensity?: number;
  time?: number;
}) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uTime: { value: time },
  }), [color, intensity]);

  const causticShader = `
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv * 8.0;
      float caustic1 = sin(uv.x + uTime) * cos(uv.y * 1.2 + uTime * 0.8);
      float caustic2 = sin(uv.x * 0.7 + uTime * 1.3) * cos(uv.y + uTime);
      float caustic = (caustic1 + caustic2) * 0.5 + 0.5;
      caustic = pow(caustic, 2.0);
      
      vec3 color = uColor * caustic * uIntensity;
      float alpha = caustic * uIntensity;
      
      gl_FragColor = vec4(color, alpha);
    }
  `;

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={scale} position={[0, 0, 0.02]}>
      <circleGeometry args={[1, 32]} />
      <shaderMaterial
        vertexShader={rayTracingGlowVertexShader}
        fragmentShader={causticShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
