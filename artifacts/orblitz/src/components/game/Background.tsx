import { useMemo, useRef, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const sharedCircleGeo = new THREE.CircleGeometry(1, 8);
const sharedStarGeo = new THREE.CircleGeometry(1, 5);
const sharedPlaneGeo = new THREE.PlaneGeometry(1, 1);
const sharedTriGeo = new THREE.CircleGeometry(1, 3);
const sharedRingGeoLow = new THREE.RingGeometry(0.9, 1, 24);

interface BackgroundParticle {
  position: [number, number, number];
  velocity: [number, number, number];
  size: number;
  colorIndex: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

const vibrantColors = [
  "#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#00ff88", 
  "#ff0066", "#6600ff", "#00ff00", "#ff3399", "#33ffcc"
];

const WORLD_BACKGROUNDS: Record<number, { 
  bgHue: number; 
  primaryColor: string; 
  secondaryColor: string; 
  accentColor: string;
  animStyle: "pulse" | "spiral" | "wave" | "electric" | "cosmic" | "flame" | "frost" | "vortex" | "chaos";
  saturation: number;
  brightness: number;
}> = {
  1: { bgHue: 0.55, primaryColor: "#00ffff", secondaryColor: "#0088ff", accentColor: "#00ffcc", animStyle: "pulse", saturation: 0.9, brightness: 0.6 },
  2: { bgHue: 0.12, primaryColor: "#ffd700", secondaryColor: "#ff8800", accentColor: "#ffaa00", animStyle: "spiral", saturation: 1.0, brightness: 0.7 },
  3: { bgHue: 0.0, primaryColor: "#ff3333", secondaryColor: "#ff0066", accentColor: "#ff6644", animStyle: "wave", saturation: 0.95, brightness: 0.6 },
  4: { bgHue: 0.85, primaryColor: "#ff00ff", secondaryColor: "#cc00ff", accentColor: "#ff66ff", animStyle: "electric", saturation: 1.0, brightness: 0.65 },
  5: { bgHue: 0.35, primaryColor: "#00ff66", secondaryColor: "#00cc44", accentColor: "#66ff99", animStyle: "cosmic", saturation: 0.9, brightness: 0.55 },
  6: { bgHue: 0.75, primaryColor: "#9966ff", secondaryColor: "#6633cc", accentColor: "#cc99ff", animStyle: "electric", saturation: 0.85, brightness: 0.5 },
  7: { bgHue: 0.92, primaryColor: "#ff66cc", secondaryColor: "#ff3399", accentColor: "#ffaadd", animStyle: "flame", saturation: 0.9, brightness: 0.6 },
  8: { bgHue: 0.6, primaryColor: "#3399ff", secondaryColor: "#0066cc", accentColor: "#66ccff", animStyle: "frost", saturation: 0.85, brightness: 0.55 },
  9: { bgHue: 0.02, primaryColor: "#dc143c", secondaryColor: "#8b0000", accentColor: "#ff4444", animStyle: "chaos", saturation: 1.0, brightness: 0.5 },
};

export function Background() {
  const sunburstRef = useRef<THREE.Group>(null);
  const gridRef = useRef<THREE.LineSegments>(null);
  const shapeRefs = useRef<THREE.Mesh[]>([]);
  const particleRefs = useRef<THREE.Mesh[]>([]);
  const starRefs = useRef<THREE.Mesh[]>([]);
  const nebulaRefs = useRef<THREE.Mesh[]>([]);
  const vortexRef = useRef<THREE.Group>(null);
  const waveRingsRef = useRef<THREE.Mesh[]>([]);
  const auroraRefs = useRef<THREE.Mesh[]>([]);
  const energyOrbRefs = useRef<THREE.Group[]>([]);
  const hexGridRef = useRef<THREE.LineSegments>(null);
  const meteorRefs = useRef<THREE.Mesh[]>([]);
  const pulseRingRefs = useRef<THREE.Mesh[]>([]);
  const constellationRef = useRef<THREE.LineSegments>(null);
  const lightningRefs = useRef<THREE.Line[]>([]);
  const tendrilRefs = useRef<THREE.Line[]>([]);
  const beamRefs = useRef<THREE.Mesh[]>([]);
  const spiralRefs = useRef<THREE.Line[]>([]);
  const { backgroundPulse, backgroundShake, updateBackgroundEffects, distortActive, gameTime, phase, arcadeLevel, gameMode, playerPosition } = useMagicOrb();
  
  const worldLevel = gameMode === "arcade" ? Math.floor(arcadeLevel) : 0;
  const worldConfig = WORLD_BACKGROUNDS[worldLevel] || WORLD_BACKGROUNDS[1];
  
  const gridGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const gridSize = 70;
    const divisions = 16;
    const step = gridSize / divisions;
    
    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      positions.push(-gridSize / 2, i * step, -25, gridSize / 2, i * step, -25);
      positions.push(i * step, -gridSize / 2, -25, i * step, gridSize / 2, -25);
    }
    
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  const floatingShapes = useMemo(() => {
    const shapes = [];
    for (let i = 0; i < 25; i++) {
      shapes.push({
        position: [
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 45,
          -16 - Math.random() * 14,
        ] as [number, number, number],
        rotation: Math.random() * Math.PI * 2,
        scale: 0.3 + Math.random() * 1.4,
        speed: 0.3 + Math.random() * 0.6,
        rotSpeed: 0.5 + Math.random() * 1.5,
        type: Math.floor(Math.random() * 5),
        colorOffset: Math.random(),
        baseY: (Math.random() - 0.5) * 45,
        baseX: (Math.random() - 0.5) * 60,
        floatOffset: Math.random() * Math.PI * 2,
        orbitRadius: 2 + Math.random() * 5,
        orbitSpeed: 0.2 + Math.random() * 0.4,
      });
    }
    return shapes;
  }, []);
  
  const nebulaClouds = useMemo(() => {
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        position: [
          (Math.random() - 0.5) * 55,
          (Math.random() - 0.5) * 40,
          -35 - Math.random() * 8,
        ] as [number, number, number],
        scale: 10 + Math.random() * 15,
        colorOffset: Math.random(),
        pulseSpeed: 0.4 + Math.random() * 1.2,
      });
    }
    return clouds;
  }, []);
  
  const stars = useMemo(() => {
    const starArray = [];
    for (let i = 0; i < 80; i++) {
      starArray.push({
        position: [
          (Math.random() - 0.5) * 75,
          (Math.random() - 0.5) * 55,
          -30 - Math.random() * 10,
        ] as [number, number, number],
        scale: 0.02 + Math.random() * 0.06,
        colorOffset: Math.random(),
        twinkleSpeed: 3 + Math.random() * 10,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    return starArray;
  }, []);
  
  const waveRings = useMemo(() => {
    const rings = [];
    for (let i = 0; i < 6; i++) {
      rings.push({
        radius: 8 + i * 4,
        colorOffset: i * 0.15,
        speed: 0.8 + i * 0.2,
      });
    }
    return rings;
  }, []);
  
  const auroraWaves = useMemo(() => {
    const waves = [];
    for (let i = 0; i < 4; i++) {
      waves.push({
        position: [0, -12 + i * 8, -28] as [number, number, number],
        width: 60 + i * 10,
        height: 4 + i * 2,
        speed: 0.3 + i * 0.1,
        colorOffset: i * 0.25,
        waveFreq: 2 + i * 0.5,
      });
    }
    return waves;
  }, []);
  
  const energyOrbs = useMemo(() => {
    const orbs = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      orbs.push({
        basePosition: [Math.cos(angle) * 20, Math.sin(angle) * 15, -22] as [number, number, number],
        size: 1.5 + Math.random() * 1,
        pulseSpeed: 1.5 + Math.random(),
        orbitSpeed: 0.1 + Math.random() * 0.1,
        colorOffset: i * 0.2,
        haloCount: 3,
      });
    }
    return orbs;
  }, []);
  
  const meteors = useMemo(() => {
    const mets = [];
    for (let i = 0; i < 8; i++) {
      mets.push({
        startX: -40 + Math.random() * 80,
        startY: 30 + Math.random() * 10,
        speed: 15 + Math.random() * 20,
        size: 0.1 + Math.random() * 0.15,
        delay: Math.random() * 10,
        duration: 1.5 + Math.random(),
        colorOffset: Math.random(),
      });
    }
    return mets;
  }, []);
  
  const pulseRings = useMemo(() => {
    const rings = [];
    for (let i = 0; i < 4; i++) {
      rings.push({
        delay: i * 1.5,
        maxRadius: 25 + i * 5,
        speed: 0.8 + i * 0.1,
        colorOffset: i * 0.25,
      });
    }
    return rings;
  }, []);
  
  const lightningBolts = useMemo(() => {
    const bolts = [];
    for (let i = 0; i < 6; i++) {
      bolts.push({
        startX: (Math.random() - 0.5) * 60,
        startY: 20 + Math.random() * 10,
        endX: (Math.random() - 0.5) * 40,
        endY: -20 - Math.random() * 10,
        segments: 6 + Math.floor(Math.random() * 4),
        delay: Math.random() * 8,
        duration: 0.15 + Math.random() * 0.1,
        colorOffset: Math.random(),
      });
    }
    return bolts;
  }, []);
  
  const plasmaTendrils = useMemo(() => {
    const tendrils = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      tendrils.push({
        baseAngle: angle,
        length: 15 + Math.random() * 10,
        waveSpeed: 1 + Math.random() * 1.5,
        waveAmplitude: 2 + Math.random() * 3,
        segments: 12,
        colorOffset: i * 0.2,
      });
    }
    return tendrils;
  }, []);
  
  const energyBeams = useMemo(() => {
    const beams = [];
    for (let i = 0; i < 4; i++) {
      beams.push({
        startAngle: (i / 4) * Math.PI * 2,
        width: 0.3 + Math.random() * 0.4,
        length: 30 + Math.random() * 20,
        rotationSpeed: 0.1 + Math.random() * 0.2,
        pulseSpeed: 2 + Math.random() * 2,
        colorOffset: i * 0.25,
      });
    }
    return beams;
  }, []);
  
  const spiralArms = useMemo(() => {
    const arms = [];
    for (let i = 0; i < 3; i++) {
      arms.push({
        startAngle: (i / 3) * Math.PI * 2,
        segments: 20,
        maxRadius: 35,
        rotationSpeed: 0.15 + Math.random() * 0.1,
        colorOffset: i * 0.33,
      });
    }
    return arms;
  }, []);
  
  const hexGridGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const hexSize = 3;
    const rows = 12;
    const cols = 18;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = (row % 2) * hexSize * 0.866;
        const x = (col - cols / 2) * hexSize * 1.732 + offsetX;
        const y = (row - rows / 2) * hexSize * 1.5;
        
        for (let i = 0; i < 6; i++) {
          const angle1 = (i / 6) * Math.PI * 2;
          const angle2 = ((i + 1) / 6) * Math.PI * 2;
          positions.push(
            x + Math.cos(angle1) * hexSize, y + Math.sin(angle1) * hexSize, -26,
            x + Math.cos(angle2) * hexSize, y + Math.sin(angle2) * hexSize, -26
          );
        }
      }
    }
    
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  const constellationGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const nodeCount = 20;
    const nodes: [number, number, number][] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      nodes.push([
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 45,
        -24
      ]);
    }
    
    for (let i = 0; i < nodeCount; i++) {
      const nearest = nodes
        .map((n, idx) => ({ idx, dist: Math.sqrt((n[0] - nodes[i][0]) ** 2 + (n[1] - nodes[i][1]) ** 2) }))
        .filter(n => n.idx !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      
      for (const n of nearest) {
        positions.push(...nodes[i], ...nodes[n.idx]);
      }
    }
    
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  const floatingParticles = useMemo((): BackgroundParticle[] => {
    const particles: BackgroundParticle[] = [];
    
    for (let i = 0; i < 40; i++) {
      particles.push({
        position: [
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 40,
          -12 - Math.random() * 12,
        ],
        velocity: [
          (Math.random() - 0.5) * 1,
          (Math.random() - 0.5) * 1,
          0,
        ],
        size: 0.03 + Math.random() * 0.1,
        colorIndex: Math.floor(Math.random() * vibrantColors.length),
        twinkleSpeed: 4 + Math.random() * 10,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }, []);
  
  const frameCountRef = useRef(0);
  const cachedIntensityRef = useRef(0);
  const cachedChaosRef = useRef(0);
  
  useFrame((state, delta) => {
    if (phase !== "playing") return;
    
    const time = state.clock.getElapsedTime();
    frameCountRef.current++;
    
    updateBackgroundEffects(delta);
    
    if (frameCountRef.current % 3 === 0) {
      cachedIntensityRef.current = Math.min(1, gameTime / 90);
      cachedChaosRef.current = Math.pow(cachedIntensityRef.current, 1.5);
    }
    const intensity = cachedIntensityRef.current;
    const chaos = cachedChaosRef.current;
    
    const animStyle = worldConfig.animStyle;
    let colorSpeed = 0.1 + chaos * 0.3;
    let animSpeed = 1 + chaos * 2;
    const saturation = worldConfig.saturation * (0.5 + chaos * 0.3);
    const brightness = worldConfig.brightness * (0.4 + chaos * 0.2);
    const shapeMorph = chaos;
    
    if (gameMode === "chill") {
      animSpeed = 0.3;
      colorSpeed = 0.05;
    }
    
    switch (animStyle) {
      case "spiral": colorSpeed *= 1.5; break;
      case "wave": animSpeed *= 0.7; break;
      case "electric": animSpeed *= 1.8; colorSpeed *= 2; break;
      case "cosmic": colorSpeed *= 0.5; break;
      case "flame": animSpeed *= 1.3; break;
      case "frost": animSpeed *= 0.6; colorSpeed *= 0.4; break;
      case "chaos": animSpeed *= 2.5; colorSpeed *= 3; break;
    }
    
    const morphFactor = Math.sin(time * 0.5 * animSpeed) * 0.5 + 0.5;
    const warpFactor = chaos * Math.sin(time * 2) * 0.3;
    
    if (sunburstRef.current) {
      const pulseScale = 1 + backgroundPulse * 0.3 + Math.sin(time * 2 * animSpeed) * 0.1;
      sunburstRef.current.rotation.z = time * (0.1 + chaos * 0.2);
      sunburstRef.current.scale.setScalar(pulseScale);
      sunburstRef.current.position.x = playerPosition[0] * 0.15;
      sunburstRef.current.position.y = playerPosition[1] * 0.15;
      
      const rayCount = sunburstRef.current.children.length;
      sunburstRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          const hue = ((time * colorSpeed + i * 0.06) % 1);
          mat.color.setHSL(hue, saturation, brightness);
          mat.opacity = 0.06 + Math.sin(time * 2 * animSpeed + i * 0.5) * 0.03;
          
          if (child.geometry.type === "PlaneGeometry") {
            const waveOffset = Math.sin(time * 2 + i * 0.3) * shapeMorph;
            child.rotation.z = (i / rayCount) * Math.PI * 2 + waveOffset * 0.1;
            child.scale.y = 1 + Math.sin(time * 1.5 + i) * shapeMorph * 0.2;
            child.scale.x = 1 + Math.cos(time * 1.2 + i * 0.5) * shapeMorph * 0.3;
          }
        }
      });
      
      if (distortActive) {
        sunburstRef.current.rotation.z += Math.sin(time * 10) * 0.1;
      }
    }
    
    if (gridRef.current) {
      const scrollSpeed = 1 + chaos * 2;
      gridRef.current.position.y = (time * scrollSpeed) % 2.5 - 1.25;
      
      const warpX = Math.sin(time * 1.5) * warpFactor;
      const warpY = Math.cos(time * 1.2) * warpFactor;
      gridRef.current.rotation.x = warpY * 0.15 * shapeMorph;
      gridRef.current.rotation.y = warpX * 0.15 * shapeMorph;
      
      const gridMat = gridRef.current.material as THREE.LineBasicMaterial;
      const gridHue = ((time * colorSpeed) % 1);
      gridMat.color.setHSL(gridHue, saturation, brightness);
      gridMat.opacity = 0.08 + Math.sin(time * 2 * animSpeed) * 0.04 + backgroundPulse * 0.1;
      
      const gridBaseX = playerPosition[0] * 0.2;
      const gridBaseY = playerPosition[1] * 0.2;
      
      if (backgroundShake > 0) {
        gridRef.current.position.x = gridBaseX + (Math.random() - 0.5) * backgroundShake * 0.4;
      } else {
        gridRef.current.position.x = gridBaseX;
      }
      gridRef.current.position.y = (gridRef.current.position.y % 2.5) + gridBaseY;
    }
    
    if (vortexRef.current) {
      vortexRef.current.rotation.z = time * (0.2 + chaos * 0.5);
      vortexRef.current.scale.setScalar(1 + shapeMorph * 0.3);
      vortexRef.current.position.x = playerPosition[0] * 0.1;
      vortexRef.current.position.y = playerPosition[1] * 0.1;
    }
    
    waveRingsRef.current.forEach((mesh, i) => {
      if (mesh && waveRings[i]) {
        const ring = waveRings[i];
        const wave = Math.sin(time * ring.speed * animSpeed + i) * 0.5 + 0.5;
        const ringScale = 1 + wave * shapeMorph * 0.3 + backgroundPulse * 0.15;
        mesh.scale.setScalar(ringScale);
        mesh.rotation.z = time * 0.15 * (i % 2 === 0 ? 1 : -1) * animSpeed;
        
        const scaleX = 1 + Math.sin(time * 0.8 + i) * shapeMorph * 0.4;
        const scaleY = 1 + Math.cos(time * 0.6 + i) * shapeMorph * 0.4;
        mesh.scale.x *= scaleX;
        mesh.scale.y *= scaleY;
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed + ring.colorOffset) % 1);
        mat.color.setHSL(hue, saturation, brightness);
        mat.opacity = 0.04 + wave * 0.04;
      }
    });
    
    shapeRefs.current.forEach((mesh, i) => {
      if (mesh && floatingShapes[i]) {
        const shape = floatingShapes[i];
        
        mesh.rotation.z = time * shape.rotSpeed * animSpeed + shape.rotation;
        mesh.rotation.x = Math.sin(time * 0.6 * animSpeed + shape.floatOffset) * (0.3 + shapeMorph * 0.3);
        mesh.rotation.y = Math.cos(time * 0.5 * animSpeed + shape.floatOffset) * (0.3 + shapeMorph * 0.3);
        
        const orbitX = Math.sin(time * shape.orbitSpeed * animSpeed) * shape.orbitRadius * shapeMorph * 0.5;
        const orbitY = Math.cos(time * shape.orbitSpeed * animSpeed) * shape.orbitRadius * shapeMorph * 0.3;
        mesh.position.x = shape.baseX + orbitX;
        mesh.position.y = shape.baseY + Math.sin(time * shape.speed * animSpeed + shape.floatOffset) * (1 + shapeMorph) + orbitY;
        
        const scaleX = shape.scale * (1 + Math.sin(time * 1.5 + i) * shapeMorph * 0.5);
        const scaleY = shape.scale * (1 + Math.cos(time * 1.2 + i) * shapeMorph * 0.5);
        const scaleZ = shape.scale * (1 + Math.sin(time * 1.8 + i * 0.5) * shapeMorph * 0.5);
        mesh.scale.set(scaleX, scaleY, scaleZ);
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed + shape.colorOffset) % 1);
        mat.color.setHSL(hue, saturation, brightness);
        mat.opacity = 0.15 + Math.sin(time * 2 * animSpeed + i * 0.5) * 0.08 + backgroundPulse * 0.1;
      }
    });
    
    nebulaRefs.current.forEach((mesh, i) => {
      if (mesh && nebulaClouds[i]) {
        const cloud = nebulaClouds[i];
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed * 0.3 + cloud.colorOffset) % 1);
        mat.color.setHSL(hue, saturation * 0.6, brightness * 0.5);
        mat.opacity = 0.04 + Math.sin(time * cloud.pulseSpeed * animSpeed + i) * 0.02;
        
        const breatheX = 1 + Math.sin(time * 0.3 * animSpeed + i * 0.5) * shapeMorph * 0.3;
        const breatheY = 1 + Math.cos(time * 0.25 * animSpeed + i * 0.5) * shapeMorph * 0.3;
        mesh.scale.set(cloud.scale * breatheX, cloud.scale * breatheY, 1);
        mesh.rotation.z = time * 0.03 * animSpeed;
      }
    });
    
    starRefs.current.forEach((mesh, i) => {
      if (mesh && stars[i]) {
        const star = stars[i];
        const twinkle = Math.sin(time * star.twinkleSpeed * animSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const starScale = star.scale * (0.5 + twinkle * 0.5);
        mesh.scale.setScalar(starScale);
        
        mesh.rotation.z = time * 1.5 * animSpeed;
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed * 0.5 + star.colorOffset) % 1);
        mat.color.setHSL(hue, saturation * 0.4, brightness + 0.2);
        mat.opacity = 0.3 + twinkle * 0.3;
      }
    });
    
    particleRefs.current.forEach((mesh, i) => {
      if (mesh && floatingParticles[i]) {
        const p = floatingParticles[i];
        const twinkle = Math.sin(time * p.twinkleSpeed * animSpeed + p.twinkleOffset) * 0.5 + 0.5;
        const particleScale = p.size * (0.5 + twinkle * 0.5 + backgroundPulse * 0.2);
        mesh.scale.setScalar(particleScale);
        
        const speedMult = 1 + shapeMorph;
        const swirl = shapeMorph * 0.3;
        mesh.position.x += (p.velocity[0] + Math.sin(time + i) * swirl) * delta * speedMult;
        mesh.position.y += (p.velocity[1] + Math.cos(time + i) * swirl) * delta * speedMult;
        
        if (mesh.position.x > 30) mesh.position.x = -30;
        if (mesh.position.x < -30) mesh.position.x = 30;
        if (mesh.position.y > 25) mesh.position.y = -25;
        if (mesh.position.y < -25) mesh.position.y = 25;
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed + p.colorIndex * 0.1) % 1);
        mat.color.setHSL(hue, saturation, brightness);
        mat.opacity = 0.2 + twinkle * 0.2 + backgroundPulse * 0.15;
      }
    });
    
    auroraRefs.current.forEach((mesh, i) => {
      if (mesh && auroraWaves[i]) {
        const aurora = auroraWaves[i];
        const wave = Math.sin(time * aurora.speed * animSpeed) * 5;
        mesh.position.y = aurora.position[1] + wave;
        mesh.scale.x = aurora.width * (1 + Math.sin(time * 0.5 + i) * 0.1);
        mesh.scale.y = aurora.height * (1 + Math.sin(time * aurora.waveFreq + i) * 0.3);
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed * 0.3 + aurora.colorOffset) % 1);
        mat.color.setHSL(hue, saturation * 0.8, brightness * 0.6);
        mat.opacity = 0.06 + Math.sin(time * 1.5 + i * 0.5) * 0.03;
      }
    });
    
    energyOrbRefs.current.forEach((group, i) => {
      if (group && energyOrbs[i]) {
        const orb = energyOrbs[i];
        const orbX = orb.basePosition[0] + Math.sin(time * orb.orbitSpeed) * 5;
        const orbY = orb.basePosition[1] + Math.cos(time * orb.orbitSpeed * 0.7) * 3;
        group.position.set(orbX, orbY, orb.basePosition[2]);
        
        const pulse = Math.sin(time * orb.pulseSpeed) * 0.3 + 1;
        group.scale.setScalar(pulse);
        group.rotation.z = time * 0.5;
        
        group.children.forEach((child, j) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.MeshBasicMaterial;
            const hue = ((time * colorSpeed + orb.colorOffset + j * 0.1) % 1);
            mat.color.setHSL(hue, saturation, brightness);
            mat.opacity = j === 0 ? 0.4 : 0.1 - j * 0.02;
          }
        });
      }
    });
    
    if (hexGridRef.current) {
      const hexMat = hexGridRef.current.material as THREE.LineBasicMaterial;
      const hue = ((time * colorSpeed * 0.2) % 1);
      hexMat.color.setHSL(hue, saturation * 0.5, brightness * 0.4);
      hexMat.opacity = 0.03 + Math.sin(time * 0.8) * 0.02;
      hexGridRef.current.rotation.z = time * 0.02;
    }
    
    if (constellationRef.current) {
      const constMat = constellationRef.current.material as THREE.LineBasicMaterial;
      const hue = ((time * colorSpeed * 0.4) % 1);
      constMat.color.setHSL(hue, saturation * 0.3, brightness + 0.1);
      constMat.opacity = 0.08 + Math.sin(time * 1.2) * 0.04;
    }
    
    meteorRefs.current.forEach((mesh, i) => {
      if (mesh && meteors[i]) {
        const m = meteors[i];
        const cycleTime = (time + m.delay) % (m.duration + 5);
        
        if (cycleTime < m.duration) {
          const progress = cycleTime / m.duration;
          mesh.position.x = m.startX + progress * 40;
          mesh.position.y = m.startY - progress * 50;
          mesh.visible = true;
          
          const mat = mesh.material as THREE.MeshBasicMaterial;
          const fadeIn = Math.min(1, progress * 4);
          const fadeOut = Math.max(0, 1 - (progress - 0.7) * 3.33);
          mat.opacity = 0.8 * fadeIn * fadeOut;
          const hue = ((time * colorSpeed + m.colorOffset) % 1);
          mat.color.setHSL(hue, saturation, brightness + 0.2);
        } else {
          mesh.visible = false;
        }
      }
    });
    
    pulseRingRefs.current.forEach((mesh, i) => {
      if (mesh && pulseRings[i]) {
        const ring = pulseRings[i];
        const cycleTime = (time + ring.delay) % 6;
        const progress = cycleTime / 6;
        
        const radius = progress * ring.maxRadius;
        mesh.scale.setScalar(radius / 10);
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const fadeOut = 1 - progress;
        mat.opacity = 0.08 * fadeOut * fadeOut;
        const hue = ((time * colorSpeed + ring.colorOffset) % 1);
        mat.color.setHSL(hue, saturation, brightness);
      }
    });
    
    lightningRefs.current.forEach((line, i) => {
      if (line && lightningBolts[i]) {
        const bolt = lightningBolts[i];
        const cycleTime = (time + bolt.delay) % 8;
        const isActive = cycleTime < bolt.duration;
        
        line.visible = isActive;
        if (isActive && line.geometry) {
          const positions: number[] = [];
          let x = bolt.startX;
          let y = bolt.startY;
          positions.push(x, y, -20);
          
          for (let s = 1; s <= bolt.segments; s++) {
            const progress = s / bolt.segments;
            x = bolt.startX + (bolt.endX - bolt.startX) * progress + (Math.random() - 0.5) * 8;
            y = bolt.startY + (bolt.endY - bolt.startY) * progress + (Math.random() - 0.5) * 4;
            positions.push(x, y, -20);
          }
          
          line.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          line.geometry.attributes.position.needsUpdate = true;
          
          const mat = line.material as THREE.LineBasicMaterial;
          const hue = ((time * colorSpeed * 2 + bolt.colorOffset) % 1);
          mat.color.setHSL(hue, 1, 0.8);
          mat.opacity = 0.6 + Math.random() * 0.4;
        }
      }
    });
    
    tendrilRefs.current.forEach((line, i) => {
      if (line && plasmaTendrils[i] && line.geometry) {
        const tendril = plasmaTendrils[i];
        const positions: number[] = [];
        
        for (let s = 0; s <= tendril.segments; s++) {
          const segProgress = s / tendril.segments;
          const r = segProgress * tendril.length;
          const wave = Math.sin(time * tendril.waveSpeed + segProgress * 5) * tendril.waveAmplitude * segProgress;
          const angle = tendril.baseAngle + time * 0.1 + wave * 0.05;
          const x = Math.cos(angle) * r + wave;
          const y = Math.sin(angle) * r;
          positions.push(x, y, -22);
        }
        
        line.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        line.geometry.attributes.position.needsUpdate = true;
        
        const mat = line.material as THREE.LineBasicMaterial;
        const hue = ((time * colorSpeed + tendril.colorOffset) % 1);
        mat.color.setHSL(hue, saturation, brightness);
        mat.opacity = 0.15 + Math.sin(time * 2 + i) * 0.05;
      }
    });
    
    beamRefs.current.forEach((mesh, i) => {
      if (mesh && energyBeams[i]) {
        const beam = energyBeams[i];
        const currentAngle = beam.startAngle + time * beam.rotationSpeed;
        mesh.rotation.z = currentAngle;
        
        const pulse = Math.sin(time * beam.pulseSpeed) * 0.3 + 0.7;
        mesh.scale.y = pulse;
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((time * colorSpeed + beam.colorOffset) % 1);
        mat.color.setHSL(hue, saturation, brightness);
        mat.opacity = 0.06 + Math.sin(time * 3 + i) * 0.03;
      }
    });
    
    spiralRefs.current.forEach((line, i) => {
      if (line && spiralArms[i] && line.geometry) {
        const arm = spiralArms[i];
        const positions: number[] = [];
        
        for (let s = 0; s <= arm.segments; s++) {
          const segProgress = s / arm.segments;
          const r = segProgress * arm.maxRadius;
          const spiralAngle = arm.startAngle + time * arm.rotationSpeed + segProgress * Math.PI * 2;
          const x = Math.cos(spiralAngle) * r;
          const y = Math.sin(spiralAngle) * r;
          positions.push(x, y, -28);
        }
        
        line.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        line.geometry.attributes.position.needsUpdate = true;
        
        const mat = line.material as THREE.LineBasicMaterial;
        const hue = ((time * colorSpeed * 0.5 + arm.colorOffset) % 1);
        mat.color.setHSL(hue, saturation * 0.7, brightness * 0.5);
        mat.opacity = 0.1 + Math.sin(time + i) * 0.04;
      }
    });
  });
  
  const bgHue = distortActive ? 0.75 : worldConfig.bgHue;
  
  return (
    <>
      <color attach="background" args={[new THREE.Color().setHSL(bgHue, 0.6, 0.02)]} />
      
      <ambientLight intensity={0.2} color={worldConfig.primaryColor} />
      <pointLight position={[0, 0, 10]} intensity={0.8 + backgroundPulse * 0.3} color={worldConfig.primaryColor} distance={50} />
      <pointLight position={[-15, 10, 5]} intensity={0.5} color={worldConfig.secondaryColor} distance={40} />
      <pointLight position={[15, -10, 5]} intensity={0.5} color={worldConfig.accentColor} distance={40} />
      <pointLight position={[0, 12, 5]} intensity={0.4} color={worldConfig.primaryColor} distance={35} />
      <pointLight position={[0, -12, 5]} intensity={0.4} color={worldConfig.secondaryColor} distance={35} />
      
      {nebulaClouds.map((cloud, i) => (
        <mesh
          key={`nebula-${i}`}
          ref={(el) => { if (el) nebulaRefs.current[i] = el; }}
          position={cloud.position}
          scale={cloud.scale}
        >
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial
            color="#ff00ff"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      <group ref={vortexRef} position={[0, 0, -32]}>
        {waveRings.map((ring, i) => (
          <mesh
            key={`vortex-ring-${i}`}
            ref={(el) => { if (el) waveRingsRef.current[i] = el; }}
          >
            <ringGeometry args={[ring.radius, ring.radius + 0.5, 64]} />
            <meshBasicMaterial
              color="#ff00ff"
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
      
      <group ref={sunburstRef} position={[0, 0, -30]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 12) * Math.PI * 2]}>
            <planeGeometry args={[2, 45]} />
            <meshBasicMaterial
              color="#ff00ff"
              transparent
              opacity={0.1}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
        <mesh>
          <circleGeometry args={[15, 64]} />
          <meshBasicMaterial
            color="#ff6600"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[12, 18, 64]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      
      <lineSegments ref={gridRef} geometry={gridGeometry}>
        <lineBasicMaterial
          color="#ff00ff"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      
      {floatingShapes.map((shape, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) shapeRefs.current[i] = el; }}
          position={shape.position}
          rotation={[0, 0, shape.rotation]}
          scale={shape.scale}
        >
          {shape.type === 0 && <boxGeometry args={[1, 1, 1]} />}
          {shape.type === 1 && <octahedronGeometry args={[0.6, 0]} />}
          {shape.type === 2 && <tetrahedronGeometry args={[0.7, 0]} />}
          {shape.type === 3 && <dodecahedronGeometry args={[0.5, 0]} />}
          {shape.type === 4 && <icosahedronGeometry args={[0.55, 0]} />}
          <meshBasicMaterial
            color="#ff00ff"
            transparent
            opacity={0.35}
            wireframe
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {stars.map((star, i) => (
        <mesh
          key={`star-${i}`}
          ref={(el) => { if (el) starRefs.current[i] = el; }}
          position={star.position}
          scale={star.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {floatingParticles.map((particle, i) => (
        <mesh
          key={`particle-${i}`}
          ref={(el) => { if (el) particleRefs.current[i] = el; }}
          position={particle.position}
          scale={particle.size}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={vibrantColors[particle.colorIndex]}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {auroraWaves.map((aurora, i) => (
        <mesh
          key={`aurora-${i}`}
          ref={(el) => { if (el) auroraRefs.current[i] = el; }}
          position={aurora.position}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {energyOrbs.map((orb, i) => (
        <group
          key={`energy-orb-${i}`}
          ref={(el) => { if (el) energyOrbRefs.current[i] = el; }}
          position={orb.basePosition}
        >
          <mesh>
            <sphereGeometry args={[orb.size, 16, 16]} />
            <meshBasicMaterial
              color="#ff00ff"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {Array.from({ length: orb.haloCount }).map((_, j) => (
            <mesh key={j}>
              <ringGeometry args={[orb.size + j * 0.8 + 0.5, orb.size + j * 0.8 + 0.8, 32]} />
              <meshBasicMaterial
                color="#00ffff"
                transparent
                opacity={0.1 - j * 0.02}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      ))}
      
      <lineSegments ref={hexGridRef} geometry={hexGridGeometry} position={[0, 0, -26]}>
        <lineBasicMaterial
          color="#ff00ff"
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      
      <lineSegments ref={constellationRef} geometry={constellationGeometry}>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      
      {meteors.map((m, i) => (
        <mesh
          key={`meteor-${i}`}
          ref={(el) => { if (el) meteorRefs.current[i] = el; }}
          position={[m.startX, m.startY, -20]}
          rotation={[0, 0, -Math.PI / 4]}
        >
          <planeGeometry args={[m.size * 0.3, m.size * 8]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {pulseRings.map((ring, i) => (
        <mesh
          key={`pulse-ring-${i}`}
          ref={(el) => { if (el) pulseRingRefs.current[i] = el; }}
          position={[0, 0, -27]}
        >
          <ringGeometry args={[10, 10.5, 64]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {lightningBolts.map((_, i) => (
        <line
          key={`lightning-${i}`}
          ref={(el) => { if (el) lightningRefs.current[i] = el as unknown as THREE.Line; }}
        >
          <bufferGeometry />
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.8}
            linewidth={2}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
      
      {plasmaTendrils.map((_, i) => (
        <line
          key={`tendril-${i}`}
          ref={(el) => { if (el) tendrilRefs.current[i] = el as unknown as THREE.Line; }}
        >
          <bufferGeometry />
          <lineBasicMaterial
            color="#ff00ff"
            transparent
            opacity={0.15}
            linewidth={2}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
      
      {energyBeams.map((beam, i) => (
        <mesh
          key={`beam-${i}`}
          ref={(el) => { if (el) beamRefs.current[i] = el; }}
          position={[0, beam.length / 2, -24]}
        >
          <planeGeometry args={[beam.width, beam.length]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {spiralArms.map((_, i) => (
        <line
          key={`spiral-${i}`}
          ref={(el) => { if (el) spiralRefs.current[i] = el as unknown as THREE.Line; }}
        >
          <bufferGeometry />
          <lineBasicMaterial
            color="#ff66ff"
            transparent
            opacity={0.1}
            linewidth={2}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
      
      {distortActive && (
        <>
          <mesh position={[playerPosition[0], playerPosition[1], -5]}>
            <ringGeometry args={[3, 8, 64]} />
            <meshBasicMaterial
              color="#00ffff"
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh position={[playerPosition[0], playerPosition[1], -6]}>
            <ringGeometry args={[6, 12, 64]} />
            <meshBasicMaterial
              color="#ff00ff"
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}
    </>
  );
}
