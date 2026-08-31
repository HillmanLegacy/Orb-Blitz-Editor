/**
 * OrbitalRings — 10 distinct modular ring sets for the player orb.
 * Each ring is a self-contained R3F component animated entirely in useFrame.
 * Shared module-level geometries and materials are reused across frames.
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RingStyle } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { FireAura } from "./FireAura";

interface RingProps { scale: number }

// ── Shared pooled helpers ─────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

// ── GLSL: dielectric plasma shell — Voronoi cellular noise + N·V⁴ Fresnel ────
const _elecShellVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3  vNrm;
varying vec3  vView;
varying vec2  vUv2;
void main() {
  float nx = sin(position.x*18.0+uTime*8.2)*cos(position.y*14.0+uTime*6.5);
  float ny = cos(position.y*16.0+uTime*7.1)*sin(position.z*12.0+uTime*5.8);
  float nz = sin(position.z*15.0+uTime*9.3)*cos(position.x*11.0+uTime*7.8);
  float disp = (nx+ny+nz)*0.032*uIntensity;
  vec3 displaced = position + normal*disp;
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vNrm  = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vView = normalize(cameraPosition - wp.xyz);
  vUv2  = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}`;

const _elecShellFrag = /* glsl */`
uniform float uTime;
uniform float uIntensity;
uniform float uWhiteHot;
varying vec3  vNrm;
varying vec3  vView;
varying vec2  vUv2;

float _vh(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+73.2);return fract(p.x*p.y);}
float voronoi(vec2 p, float spd) {
  vec2 ip=floor(p); vec2 fp=fract(p); float d=1e9;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y));
    vec2 o=0.5+0.5*sin(uTime*spd+6.2831*fract(sin(vec2(dot(ip+g,vec2(127.1,311.7)),dot(ip+g,vec2(269.5,183.3))))*43758.5453));
    vec2 r=g+o-fp; d=min(d,dot(r,r));
  }
  return sqrt(d);
}

void main() {
  float NdotV  = max(0.0, dot(normalize(vNrm), normalize(vView)));
  float fresnel = pow(1.0 - NdotV, 4.0);                 // steep N·V⁴
  float v1 = 1.0 - voronoi(vUv2*5.5 + vec2(uTime*0.7,0.0), 2.2);
  float v2 = 1.0 - voronoi(vUv2*9.0 - vec2(0.0,uTime*1.1), 3.4);
  float plasma = v1*0.65 + v2*0.35;
  // Ramp: White-Hot → Electric Cyan #00FFFF → Ultraviolet #7B00FF → Deep Cobalt #0011FF
  vec3 cW=vec3(1.00,1.00,1.00), cC=vec3(0.00,1.00,1.00), cU=vec3(0.48,0.00,1.00), cB=vec3(0.00,0.07,1.00);
  float t = fresnel*0.55 + plasma*0.45;
  vec3 col;
  if      (t > 0.75) col = mix(cC, cW, (t-0.75)*4.0);
  else if (t > 0.50) col = mix(cU, cC, (t-0.50)*4.0);
  else if (t > 0.25) col = mix(cB, cU, (t-0.25)*4.0);
  else               col = cB;
  col = mix(col, cW, uWhiteHot*0.92);
  float alpha = (fresnel*0.80 + plasma*0.22) * uIntensity;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
}`;

// ── GLSL: chromatic dispersion outer sphere (1.35×) — RGB channel splitting ──
const _elecDispVert = /* glsl */`
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNrm  = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const _elecDispFrag = /* glsl */`
uniform float uTime;
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;
float _dh(vec2 p){p=fract(p*vec2(234.34,435.35));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float _dn(vec2 p){
  vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(_dh(i),_dh(i+vec2(1,0)),f.x),mix(_dh(i+vec2(0,1)),_dh(i+vec2(1,1)),f.x),f.y);
}
void main() {
  float NdotV = abs(dot(normalize(vNrm), normalize(vView)));
  float edge  = 1.0 - NdotV;
  float n = _dn(vUv*8.0+vec2(uTime*1.2,0.0))*0.6 + _dn(vUv*15.0-vec2(0.0,uTime*0.8))*0.4;
  float disp = edge * n * 0.025;
  float r = _dn((vUv+vec2(disp,0.0))*8.0+vec2(uTime*1.2,0.0)) * 0.35;
  float g = n * 0.65;
  float b = _dn((vUv-vec2(disp,0.0))*8.0+vec2(uTime*1.2,0.0)) * 1.0;
  float alpha = (n*0.14 + edge*0.06) * 0.75;
  gl_FragColor = vec4(r, g, b, clamp(alpha, 0.0, 0.32));
}`;

// ── Arc / particle constants ──────────────────────────────────────────────────
const _N_SPARKS   = 300;
const _N_ARCS     = 20;
const _N_BRANCHES = 24;
const _ARC_PTS    = 18;
const _BRANCH_PTS = 8;

// ── Shared geometries (module-level singletons — never disposed) ──────────────
const _geo_xs    = new THREE.SphereGeometry(0.018, 4, 3);
const _geo_sm    = new THREE.SphereGeometry(0.032, 5, 3);
const _geo_tri   = new THREE.CircleGeometry(0.055, 3);
const _geo_cone  = new THREE.ConeGeometry(0.042, 0.17, 4);
const _elecShGeo = new THREE.SphereGeometry(1, 40, 28);
const _elecDpGeo = new THREE.SphereGeometry(1, 24, 16);

// ── Shared vertexColors material (used by SingularityEvent, VoidTendril, etc.) 
const _mat_vc = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

type ArcBatch = {
  geometry: THREE.BufferGeometry;
  line: THREE.LineSegments;
  positions: Float32Array;
  offset: number;
};

function appendArcSegments(batch: ArcBatch, source: Float32Array, pointCount: number) {
  for (let point = 0; point < pointCount - 1; point++) {
    const from = point * 3;
    batch.positions[batch.offset++] = source[from];
    batch.positions[batch.offset++] = source[from + 1];
    batch.positions[batch.offset++] = source[from + 2];
    batch.positions[batch.offset++] = source[from + 3];
    batch.positions[batch.offset++] = source[from + 4];
    batch.positions[batch.offset++] = source[from + 5];
  }
}

// ── Module-level intensity state + public API ─────────────────────────────────
const _elecState = { intensity: 1.0, burstTimer: 0.0, whiteHotTimer: 0.0, shockwave: false };
export function setElecIntensity(factor: number) {
  _elecState.intensity = Math.max(0.0, Math.min(2.0, factor));
}
export function triggerElecImpactBurst() {
  _elecState.burstTimer    = 0.60;
  _elecState.whiteHotTimer = 0.12;
  _elecState.shockwave     = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Electrified Aura — AAA dual-shell plasma field + Tesla arc ribbon network
//    Voronoi N·V⁴ Fresnel shells, chromatic RGB dispersion sphere, 300 Lorentz-
//    force spark particles, 20-arc 60Hz crackle network, stroboscopic light.
// ─────────────────────────────────────────────────────────────────────────────
function ElectrifiedAura({ scale }: RingProps) {
  const isDamaged    = useMagicOrb(s => s.isDamaged);
  const isDamagedRef = useRef(isDamaged);
  isDamagedRef.current = isDamaged;

  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);

  // ── Shell materials ──────────────────────────────────────────────────────────
  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _elecShellVert, fragmentShader: _elecShellFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.0 }, uWhiteHot: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }), []);
  const outerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _elecShellVert, fragmentShader: _elecShellFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.60 }, uWhiteHot: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  }), []);
  const dispMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _elecDispVert, fragmentShader: _elecDispFrag,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  }), []);
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => {
    innerMat.dispose(); outerMat.dispose(); dispMat.dispose(); sparkMat.dispose();
  }, [innerMat, outerMat, dispMat, sparkMat]);

  // ── Arc ribbon network — 20 mains + 24 branches ───────────────────────────
  const arcData = useMemo(() => {
    const matW = new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const matC = new THREE.LineBasicMaterial({ color: "#00FFFF", transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    const matU = new THREE.LineBasicMaterial({ color: "#7B00FF", transparent: true, opacity: 0.60, depthWrite: false, blending: THREE.AdditiveBlending });
    const matB = new THREE.LineBasicMaterial({ color: "#0011FF", transparent: true, opacity: 0.50, depthWrite: false, blending: THREE.AdditiveBlending });
    const mats = [matW, matC, matU, matB];
    // Golden-angle anchor distribution on unit sphere
    const anchors: [number, number, number][] = Array.from({ length: _N_ARCS * 2 }, (_, i) => {
      const phi = Math.acos(1 - 2 * ((i * 0.618034) % 1)), theta = i * 2.399963;
      return [Math.sin(phi)*Math.cos(theta), Math.sin(phi)*Math.sin(theta), Math.cos(phi)];
    });
    const mains = Array.from({ length: _N_ARCS }, (_, i) => {
      const pos = new Float32Array(_ARC_PTS * 3);
      return { pos, materialIndex: i % 4,
               a0: anchors[i], a1: anchors[i + _N_ARCS],
               phase: Math.sin(i * 7.3) * Math.PI * 2, snapSeed: Math.random() * 65536 };
    });
    const branches = Array.from({ length: _N_BRANCHES }, (_, i) => {
      const pos = new Float32Array(_BRANCH_PTS * 3);
      return { pos, materialIndex: 1 + (i % 3),
               parentIdx: i % _N_ARCS, branchT: 0.25 + (i % 4) * 0.15,
               phase: Math.cos(i * 3.7) * Math.PI * 2, snapSeed: Math.random() * 65536 };
    });
    const floatsByMaterial = mats.map((_, materialIndex) =>
      (mains.filter(arc => arc.materialIndex === materialIndex).length * (_ARC_PTS - 1) +
       branches.filter(arc => arc.materialIndex === materialIndex).length * (_BRANCH_PTS - 1)) * 6,
    );
    const batches = mats.map((material, materialIndex) => {
      const positions = new Float32Array(floatsByMaterial[materialIndex]);
      const geometry = new THREE.BufferGeometry();
      const attribute = new THREE.BufferAttribute(positions, 3);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("position", attribute);
      return { geometry, line: new THREE.LineSegments(geometry, material), positions, offset: 0 };
    });
    return { mains, branches, mats, batches };
  }, []);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    arcData.batches.forEach(({ line }) => g.add(line));
    return () => {
      arcData.batches.forEach(({ line, geometry }) => { g.remove(line); geometry.dispose(); });
      arcData.mats.forEach(m => m.dispose());
    };
  }, [arcData]);

  // ── Spark pool (300 slots, zero GC) ──────────────────────────────────────────
  const sp2 = useRef({
    px: new Float32Array(_N_SPARKS), py: new Float32Array(_N_SPARKS), pz: new Float32Array(_N_SPARKS),
    vx: new Float32Array(_N_SPARKS), vy: new Float32Array(_N_SPARKS), vz: new Float32Array(_N_SPARKS),
    life: new Float32Array(_N_SPARKS), maxLife: new Float32Array(_N_SPARKS),
    phase: new Float32Array(_N_SPARKS), slot: 0,
  });

  // ── 60Hz crackle timer ────────────────────────────────────────────────────────
  const crackle = useRef({ timer: 0.0 });
  const _prevDamaged = useRef(false);

  useFrame(({ clock }, delta) => {
    const t  = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const inten   = _elecState.intensity;
    const burst   = _elecState.burstTimer > 0;
    if (burst) _elecState.burstTimer -= dt;
    _elecState.whiteHotTimer = Math.max(0, _elecState.whiteHotTimer - dt);
    const whiteHot = _elecState.whiteHotTimer > 0 ? (_elecState.whiteHotTimer / 0.12) : 0;
    const burstMul = burst ? 1.5 : 1.0;

    // ── Shell + dispersion uniforms ─────────────────────────────────────────────
    innerMat.uniforms.uTime.value      = t;
    innerMat.uniforms.uIntensity.value = inten * burstMul;
    innerMat.uniforms.uWhiteHot.value  = whiteHot;
    outerMat.uniforms.uTime.value      = t;
    outerMat.uniforms.uIntensity.value = inten * 0.62 * burstMul;
    outerMat.uniforms.uWhiteHot.value  = whiteHot;
    dispMat.uniforms.uTime.value       = t;

    // ── Multi-octave stroboscopic light (random spike probability) ──────────────
    if (lightRef.current) {
      const f1 = Math.sin(t*47.3)*0.9 + Math.sin(t*73.1)*0.7 + Math.sin(t*31.7)*0.4;
      // ~3-4 spikes/sec at 60 fps (0.06 probability per frame)
      const spike = Math.random() < 0.06 ? Math.random() * 2.5 : 0;
      lightRef.current.intensity = Math.max(0.5, 1.5 + f1*0.6 + spike) * inten * (1 + whiteHot*1.5);
    }

    // ── 60Hz crackle: refresh all arc snap seeds simultaneously ────────────────
    crackle.current.timer += dt;
    if (crackle.current.timer >= 0.016) {
      crackle.current.timer = 0;
      for (let i = 0; i < _N_ARCS; i++) arcData.mains[i].snapSeed = Math.random() * 65536;
      for (let i = 0; i < _N_BRANCHES; i++) arcData.branches[i].snapSeed = Math.random() * 65536;
    }

    const r     = scale * 0.88;
    const burstR = r * burstMul;

    // ── Main arc network ──────────────────────────────────────────────────────
    for (let ai = 0; ai < _N_ARCS; ai++) {
      const { pos, a0, a1, phase, snapSeed, materialIndex } = arcData.mains[ai];
      const sx = a0[0]*burstR, sy = a0[1]*burstR, sz = a0[2]*burstR;
      const ex = a1[0]*burstR, ey = a1[1]*burstR, ez = a1[2]*burstR;
      const dx = ex-sx, dy = ey-sy, dz = ez-sz;
      const arcL = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1;
      const ux = Math.abs(dx/arcL) < 0.9 ? 1 : 0, uy = ux ? 0 : 1;
      const p1x = (dy*0-dz*uy)/arcL, p1y = (dz*ux-dx*0)/arcL, p1z = (dx*uy-dy*ux)/arcL;
      const p2x = dy*p1z-dz*p1y, p2y = dz*p1x-dx*p1z, p2z = dx*p1y-dy*p1x;
      const p2L = Math.sqrt(p2x*p2x+p2y*p2y+p2z*p2z) || 1;
      pos[0] = sx; pos[1] = sy; pos[2] = sz;
      for (let s = 1; s < _ARC_PTS-1; s++) {
        const f = s / (_ARC_PTS-1), taper = Math.sin(f*Math.PI);
        // Discrete snap: deterministic from snapSeed (no lerp = instantaneous crackle)
        const sn1 = Math.sin(snapSeed*0.001 + s*2.31 + ai*1.77)*0.5+0.5;
        const sn2 = Math.cos(snapSeed*0.0013 + s*1.97 + ai*2.43)*0.5+0.5;
        const j1 = (sn1*2-1)*taper*burstR*0.52;
        const j2 = (sn2*2-1)*taper*burstR*0.38;
        pos[s*3]   = sx+dx*f+p1x*j1+(p2x/p2L)*j2;
        pos[s*3+1] = sy+dy*f+p1y*j1+(p2y/p2L)*j2;
        pos[s*3+2] = sz+dz*f+p1z*j1+(p2z/p2L)*j2;
      }
      pos[(_ARC_PTS-1)*3] = ex; pos[(_ARC_PTS-1)*3+1] = ey; pos[(_ARC_PTS-1)*3+2] = ez;
      appendArcSegments(arcData.batches[materialIndex], pos, _ARC_PTS);
      arcData.mats[materialIndex].opacity =
        Math.min(1.0, (0.55 + Math.sin(t*45+phase)*0.40)*inten*(1+whiteHot));
    }

    // ── Branch tendrils ────────────────────────────────────────────────────────
    for (let bi = 0; bi < _N_BRANCHES; bi++) {
      const { pos, parentIdx, branchT, phase, snapSeed, materialIndex } = arcData.branches[bi];
      const pPos = arcData.mains[parentIdx].pos;
      const pPt  = Math.min(Math.floor(branchT*(_ARC_PTS-1)), _ARC_PTS-2);
      const bx = pPos[pPt*3], by = pPos[pPt*3+1], bz = pPos[pPt*3+2];
      const endX = bx+Math.cos(phase+t*0.07)*burstR*0.40;
      const endY = by+Math.sin(phase*1.3+t*0.09)*burstR*0.40;
      const endZ = bz+Math.sin(phase*0.8+t*0.06)*burstR*0.28;
      pos[0] = bx; pos[1] = by; pos[2] = bz;
      for (let s = 1; s < _BRANCH_PTS; s++) {
        const f = s/(_BRANCH_PTS-1), taper = Math.sin(f*Math.PI);
        const sn = Math.sin(snapSeed*0.0012+s*3.14+bi*4.2)*0.5+0.5;
        const j = (sn*2-1)*taper*burstR*0.16;
        pos[s*3]   = bx+(endX-bx)*f+j;
        pos[s*3+1] = by+(endY-by)*f+j*0.8;
        pos[s*3+2] = bz+(endZ-bz)*f+j*0.6;
      }
      appendArcSegments(arcData.batches[materialIndex], pos, _BRANCH_PTS);
      arcData.mats[materialIndex].opacity =
        (0.28 + Math.sin(t*62+phase)*0.28) * inten;
    }
    for (const batch of arcData.batches) {
      (batch.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      batch.offset = 0;
    }

    // ── Impact burst (isDamaged rising edge OR shockwave flag) ─────────────────
    const s2 = sp2.current;
    const doBurst = (isDamagedRef.current && !_prevDamaged.current) || _elecState.shockwave;
    if (doBurst) {
      _elecState.shockwave = false;
      // 360° radial ring burst — 200 ionic sparks on equatorial ring
      for (let i = 0; i < 200; i++) {
        const theta = (i/200)*Math.PI*2;
        const phi   = Math.PI/2 + (Math.random()-0.5)*1.0;
        const nx = Math.sin(phi)*Math.cos(theta), ny = Math.sin(phi)*Math.sin(theta), nz = Math.cos(phi);
        s2.px[i]=nx*burstR; s2.py[i]=ny*burstR; s2.pz[i]=nz*burstR;
        const spd = (5+Math.random()*4)*burstR;
        s2.vx[i]=nx*spd; s2.vy[i]=ny*spd; s2.vz[i]=nz*spd;
        s2.life[i]=0.25+Math.random()*0.20; s2.maxLife[i]=s2.life[i];
        s2.phase[i]=Math.random()*Math.PI*2;
      }
    }
    _prevDamaged.current = isDamagedRef.current;

    // ── Continuous spark spawn ─────────────────────────────────────────────────
    const spawnN = Math.floor(4 + inten * 2);
    for (let sp = 0; sp < spawnN; sp++) {
      const slot = s2.slot;
      if (s2.life[slot] <= 0) {
        const phi = Math.acos(1-2*Math.random()), theta = Math.random()*Math.PI*2;
        const nx = Math.sin(phi)*Math.cos(theta), ny = Math.sin(phi)*Math.sin(theta), nz = Math.cos(phi);
        s2.px[slot]=nx*r; s2.py[slot]=ny*r; s2.pz[slot]=nz*r;
        const spd = (1.4+Math.random()*2.8)*r;
        s2.vx[slot]=nx*spd+(Math.random()-0.5)*spd*0.4;
        s2.vy[slot]=ny*spd+(Math.random()-0.5)*spd*0.4;
        s2.vz[slot]=nz*spd+(Math.random()-0.5)*spd*0.4;
        s2.life[slot]=0.15+Math.random()*0.28; s2.maxLife[slot]=s2.life[slot];
        s2.phase[slot]=Math.random()*Math.PI*2;
      }
      s2.slot = (slot+1) % _N_SPARKS;
    }

    // ── Spark simulation — Lorentz dipole force F=q(E+v×B), B along Y-axis ────
    const Bstr = 0.9 * inten;
    const im = sparkRef.current;
    if (!im) return;
    for (let i = 0; i < _N_SPARKS; i++) {
      if (s2.life[i] <= 0) {
        _dummy.position.set(9999,0,0); _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix(); im.setMatrixAt(i,_dummy.matrix); continue;
      }
      // v×B where B=(0,By,0): x-comp = -vz·By, z-comp = vx·By → helical curl
      s2.vx[i] += -s2.vz[i]*Bstr*dt;
      s2.vz[i] +=  s2.vx[i]*Bstr*dt;
      s2.vx[i]*=0.88; s2.vy[i]*=0.88; s2.vz[i]*=0.88;  // drag
      s2.px[i]+=s2.vx[i]*dt; s2.py[i]+=s2.vy[i]*dt; s2.pz[i]+=s2.vz[i]*dt;
      s2.life[i]-=dt;
      const lr = Math.max(s2.life[i]/s2.maxLife[i], 0);
      // High-freq sine flash at ~40 Hz
      const fl = Math.abs(Math.sin(t*40.0 + s2.phase[i]));
      _dummy.position.set(s2.px[i],s2.py[i],s2.pz[i]);
      _dummy.scale.setScalar(lr*0.60*(0.45+fl*0.55));
      _dummy.updateMatrix(); im.setMatrixAt(i,_dummy.matrix);
      _col.setHex(lr>0.65 ? 0xFFFFFF : lr>0.30 ? 0x00FFFF : 0x7B00FF);
      im.setColorAt(i,_col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* Multi-octave stroboscopic cyan light with random spikes */}
      <pointLight ref={lightRef} color="#00E1FF" intensity={1.5} distance={5.5} decay={2} />
      {/* Inner dielectric plasma shell (1.06×) — Voronoi N·V⁴ Fresnel */}
      <mesh scale={scale * 1.06} material={innerMat} geometry={_elecShGeo} />
      {/* Outer corona shell (1.18×) — BackSide bloom */}
      <mesh scale={scale * 1.18} material={outerMat} geometry={_elecShGeo} />
      {/* Chromatic dispersion sphere (1.35×) — RGB channel splitting */}
      <mesh scale={scale * 1.35} material={dispMat}  geometry={_elecDpGeo} />
      {/* 300-slot ionic spark pool */}
      <instancedMesh ref={sparkRef} args={[_geo_sm, sparkMat, _N_SPARKS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Singularity Event — Gravitational Accretion Disk (orange / violet)
//    Black event horizon + violent accretion disk + 60 swirling particle eddies.
// ─────────────────────────────────────────────────────────────────────────────
const _N_ACCR = 60;
const _mat_accr = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function SingularityEvent({ scale }: RingProps) {
  const r       = scale * 2.0;
  const diskRef = useRef<THREE.Mesh>(null);
  const partRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (diskRef.current) diskRef.current.rotation.z = t * 3.5;
    const im = partRef.current;
    if (!im) return;
    for (let i = 0; i < _N_ACCR; i++) {
      const base  = (i / _N_ACCR) * Math.PI * 2;
      const curl  = Math.sin(t * 1.5 + i * 0.3) * 0.5;
      const a     = base + t * 2.8 + curl;
      const rad   = r * (0.58 + (i % 4) * 0.12 + Math.sin(t * 3 + i * 0.7) * 0.08);
      const depth = Math.sin(t * 2.2 + i * 2.17) * 0.03;
      _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, depth);
      _dummy.scale.setScalar(0.45 + Math.sin(t * 8 + i) * 0.3);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(i % 2 === 0 ? "#FF4500" : "#8A2BE2");
      _col.multiplyScalar(0.75 + Math.sin(t * 5 + i) * 0.25);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff5500" intensity={1.5} distance={4} decay={2} />
      {/* Event horizon — pitch black */}
      <mesh>
        <ringGeometry args={[r * 0.28, r * 0.54, 64]} />
        <meshBasicMaterial color="#0a0005" transparent opacity={0.97} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Outer accretion disk */}
      <mesh ref={diskRef}>
        <ringGeometry args={[r * 0.54, r, 64]} />
        <meshBasicMaterial color="#FF4500" transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Violet outer rim */}
      <mesh>
        <ringGeometry args={[r * 0.97, r * 1.06, 48]} />
        <meshBasicMaterial color="#8A2BE2" transparent opacity={0.40} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={partRef} args={[_geo_sm, _mat_accr, _N_ACCR]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fiery Aura — AAA dual-shell blackbody combustion system
//    Dual-frequency displacement, blackbody thermal ramp, Fresnel fake-depth,
//    NdotV heat haze, fBm light engine, 500-particle pool, shockwave burst.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared GLSL noise library (inlined in every fire shader) ─────────────────
const _fireNoise = /* glsl */`
float _hF(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float _n3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(_hF(i),_hF(i+vec3(1,0,0)),f.x),mix(_hF(i+vec3(0,1,0)),_hF(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(_hF(i+vec3(0,0,1)),_hF(i+vec3(1,0,1)),f.x),mix(_hF(i+vec3(0,1,1)),_hF(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float _fbm(vec3 p) {
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*_n3(p);p=p*2.1+vec3(1.7,9.2,0.3);a*=0.5;}
  return v;
}`;

// ── GLSL: dual-frequency displacement — inner combustion shell ────────────────
const _fireInnerVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
uniform float uBurstScale;
varying float vFlame;
varying vec3  vNrm;
varying vec3  vView;

${_fireNoise}

void main() {
  // Low-frequency rolling swells (large fluid motion)
  vec3 pLow  = position + vec3(0.0, -uTime * 0.78, uTime * 0.13);
  float nLow = _fbm(pLow * 1.55);
  // High-frequency licking tendrils (sharp flame tips)
  vec3 pHi   = position + vec3(uTime * 0.11, -uTime * 2.6, uTime * 0.38);
  float nHi  = _fbm(pHi  * 5.0);
  // Blend: swells dominate the base, tendrils dominate the tips
  float n    = (nLow * 0.60 + nHi * 0.40) * uIntensity;
  float yBias = position.y * 0.5 + 0.5;
  float disp  = n * 0.34 * (0.5 + yBias * 1.15) * uBurstScale;
  vec3 disp3  = position + normal * disp;
  vFlame = n;
  // World-space normal + view dir for Fresnel in fragment
  vec4 wp = modelMatrix * vec4(disp3, 1.0);
  vNrm    = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vView   = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(disp3, 1.0);
}`;

const _fireInnerFrag = /* glsl */`
uniform float uWhiteHot;   // 0–1, surges during burst flash
varying float vFlame;
varying vec3  vNrm;
varying vec3  vView;

void main() {
  float fr    = pow(1.0 - max(0.0, dot(normalize(vNrm), normalize(vView))), 2.2);
  // depth: 1 at centre (facing camera) = white-hot core; 0 at rim = dark carbon
  float depth = 1.0 - fr * 0.80;
  float t     = depth * clamp(vFlame * 2.0, 0.5, 1.0);

  // Blackbody thermal ramp: White-Hot → Solar Amber → Crimson → Dark Carbon
  vec3 cW = vec3(1.00, 1.00, 1.00);   // White-Hot  #FFFFFF
  vec3 cA = vec3(1.00, 0.80, 0.00);   // Solar Amber #FFCC00
  vec3 cC = vec3(1.00, 0.20, 0.00);   // Crimson    #FF3300
  vec3 cD = vec3(0.10, 0.02, 0.00);   // Dark Carbon #1A0500

  vec3 col;
  if      (t > 0.75) col = mix(cA, cW, (t - 0.75) * 4.000);
  else if (t > 0.42) col = mix(cC, cA, (t - 0.42) / 0.33);
  else if (t > 0.12) col = mix(cD, cC, (t - 0.12) / 0.30);
  else               col = cD;

  // Burst white-hot surge
  col = mix(col, cW, uWhiteHot * 0.88);

  float alpha = clamp(vFlame * 3.1 - 0.18, 0.0, 0.92) * (0.36 + depth * 0.64);
  gl_FragColor = vec4(col, alpha);
}`;

// ── GLSL: outer corona shell — cooler, edge-glow focused ─────────────────────
const _fireCoronaFrag = /* glsl */`
uniform float uWhiteHot;
varying float vFlame;
varying vec3  vNrm;
varying vec3  vView;

void main() {
  float fr    = pow(1.0 - max(0.0, dot(normalize(vNrm), normalize(vView))), 2.6);
  float depth = 1.0 - fr * 0.72;
  float t     = depth * clamp(vFlame * 1.55, 0.28, 0.88);

  vec3 cA = vec3(1.00, 0.80, 0.00);  // Solar Amber
  vec3 cC = vec3(1.00, 0.20, 0.00);  // Crimson
  vec3 cD = vec3(0.10, 0.02, 0.00);  // Dark Carbon

  vec3 col;
  if      (t > 0.62) col = mix(cC, cA, (t - 0.62) / 0.38);
  else if (t > 0.16) col = mix(cD, cC, (t - 0.16) / 0.46);
  else               col = cD;

  col = mix(col, vec3(1.0), uWhiteHot * 0.62);
  // Edge-glow emphasis: corona is brightest near the rim
  float alpha = clamp(vFlame * 2.3 - 0.22, 0.0, 0.75) * (0.18 + fr * 0.68);
  gl_FragColor = vec4(col, alpha);
}`;

// ── GLSL: heat-haze sphere — NdotV edge falloff ───────────────────────────────
const _hazeVert = /* glsl */`
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNrm    = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vView   = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const _hazeFrag = /* glsl */`
uniform float uTime;
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;

float _h2(vec2 p){p=fract(p*vec2(234.34,435.35));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float _n2(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(_h2(i),_h2(i+vec2(1,0)),f.x),mix(_h2(i+vec2(0,1)),_h2(i+vec2(1,1)),f.x),f.y);}

void main() {
  vec2 uv = vUv + vec2(0.0, -uTime * 0.46);
  float n = _n2(uv * 7.2) * 0.56 + _n2(uv * 14.5 + vec2(1.7, 0.3)) * 0.27;
  // NdotV edge falloff — heat shimmer stronger at glancing angles
  float nDotV    = abs(dot(normalize(vNrm), normalize(vView)));
  float edgeFade = 1.0 - nDotV;               // 0 at centre, 1 at edges
  float alpha    = n * 0.15 * (0.22 + edgeFade * 0.78);
  gl_FragColor   = vec4(mix(vec3(0.0), vec3(0.60, 0.24, 0.0), n), alpha);
}`;

// ── Shared geometries (module-level) ──────────────────────────────────────────
const _fireShellGeo  = new THREE.SphereGeometry(1.0, 52, 26); // inner shell
const _fireCoronaGeo = new THREE.SphereGeometry(1.0, 36, 18); // outer corona
const _hazeGeoF      = new THREE.SphereGeometry(1.0, 20, 14);
const _fPartGeo      = new THREE.SphereGeometry(1.0,  4,  3);
const _emberGeoF     = new THREE.SphereGeometry(1.0,  3,  2);

// ── Module-level intensity state + public API ─────────────────────────────────
const _fieryState = {
  intensity: 1.0,
  burstTimer:    0.0,
  whiteHotTimer: 0.0,
  shockwave:     false,
};
export function setFieryIntensity(factor: number) {
  _fieryState.intensity = Math.max(0.2, Math.min(2.0, factor));
}
export function triggerFieryInfernoBurst() {
  _fieryState.burstTimer    = 0.60;
  _fieryState.whiteHotTimer = 0.15;
  _fieryState.shockwave     = true;
}

// ── Particle pool sizes ───────────────────────────────────────────────────────
const _NC  = 200;  // core flames
const _NO  = 150;  // outer/corona flames
const _NEB = 120;  // bright hot embers
const _NED =  30;  // dying-crimson embers (snap-to-crimson phase)

function _spawnFlame(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  orbR: number, outer: boolean, burst: boolean,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const sR    = orbR * (outer ? 1.14 : 1.0) * (burst ? 1.18 : 1.0);
  px[i] = sR * Math.sin(phi) * Math.cos(theta);
  py[i] = sR * Math.cos(phi);
  pz[i] = sR * Math.sin(phi) * Math.sin(theta);
  const nx = px[i]/sR, ny = py[i]/sR, nz = pz[i]/sR;
  const spd = outer ? (0.5 + Math.random()*0.8) : (0.7 + Math.random()*1.1);
  vx[i] = nx * spd * 0.26;
  vy[i] = ny * spd * 0.26 + 0.90 + Math.random() * 1.05; // strong thermal rise
  vz[i] = nz * spd * 0.26;
  life[i]    = -(Math.random() * (outer ? 0.48 : 0.68));
  maxLife[i] = 0.55 + Math.random() * (outer ? 1.0 : 1.2);
  phase[i]   = theta;
}

function _spawnBrightEmber(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  orbR: number, burst: boolean,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const sR    = orbR * (burst ? 1.25 : 1.0);
  px[i] = sR * Math.sin(phi) * Math.cos(theta);
  py[i] = sR * Math.cos(phi);
  pz[i] = sR * Math.sin(phi) * Math.sin(theta);
  const nx = px[i]/sR, ny = py[i]/sR, nz = pz[i]/sR;
  const spd = (burst ? 3.2 : 2.0) + Math.random() * 2.4;
  vx[i] = nx*spd; vy[i] = ny*spd + 0.5 + Math.random()*0.8; vz[i] = nz*spd;
  life[i]    = -(Math.random() * 0.90);
  maxLife[i] = 0.35 + Math.random() * 0.75;
  phase[i]   = Math.random() * Math.PI * 2;
}

function _spawnDyingEmber(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  srcX: number, srcY: number, srcZ: number,
) {
  px[i] = srcX; py[i] = srcY; pz[i] = srcZ;
  vx[i] = (Math.random()-0.5)*0.4; vy[i] = 0.05 + Math.random()*0.2; vz[i] = (Math.random()-0.5)*0.4;
  life[i] = 0; maxLife[i] = 0.18 + Math.random()*0.22; phase[i] = Math.random()*Math.PI*2;
}

function FieryAura({ scale }: RingProps) {
  const orbR    = scale * 0.56;
  const innerR  = scale * 0.65;  // 1.05x shell
  const coronaR = scale * 0.78;  // 1.25x corona
  const hazeR   = scale * 0.91;  // 1.4x heat haze

  // ── Materials (useMemo per memory note) ──────────────────────────────────────
  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _fireInnerVert, fragmentShader: _fireInnerFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uBurstScale: { value: 1 }, uWhiteHot: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }), []);
  const coronaMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _fireInnerVert, fragmentShader: _fireCoronaFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uBurstScale: { value: 1 }, uWhiteHot: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }), []);
  const hazeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _hazeVert, fragmentShader: _hazeFrag,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  }), []);
  const coreMat    = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff7700", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const outerMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cc2200", transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const brightMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffaa00", transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const dyingMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: "#550000", transparent: true, opacity: 0.80, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useEffect(() => () => {
    innerMat.dispose(); coronaMat.dispose(); hazeMat.dispose();
    coreMat.dispose(); outerMat.dispose(); brightMat.dispose(); dyingMat.dispose();
  }, [innerMat, coronaMat, hazeMat, coreMat, outerMat, brightMat, dyingMat]);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const lightRef  = useRef<THREE.PointLight>(null);
  const coreIM    = useRef<THREE.InstancedMesh>(null);
  const outerIM   = useRef<THREE.InstancedMesh>(null);
  const brightIM  = useRef<THREE.InstancedMesh>(null);
  const dyingIM   = useRef<THREE.InstancedMesh>(null);

  // ── Particle pools ───────────────────────────────────────────────────────────
  const cp = useRef({ px: new Float32Array(_NC), py: new Float32Array(_NC), pz: new Float32Array(_NC), vx: new Float32Array(_NC), vy: new Float32Array(_NC), vz: new Float32Array(_NC), life: new Float32Array(_NC), maxLife: new Float32Array(_NC), phase: new Float32Array(_NC), born: false });
  const op = useRef({ px: new Float32Array(_NO), py: new Float32Array(_NO), pz: new Float32Array(_NO), vx: new Float32Array(_NO), vy: new Float32Array(_NO), vz: new Float32Array(_NO), life: new Float32Array(_NO), maxLife: new Float32Array(_NO), phase: new Float32Array(_NO), born: false });
  const bp = useRef({ px: new Float32Array(_NEB), py: new Float32Array(_NEB), pz: new Float32Array(_NEB), vx: new Float32Array(_NEB), vy: new Float32Array(_NEB), vz: new Float32Array(_NEB), life: new Float32Array(_NEB), maxLife: new Float32Array(_NEB), phase: new Float32Array(_NEB), born: false });
  const dp2 = useRef({ px: new Float32Array(_NED), py: new Float32Array(_NED), pz: new Float32Array(_NED), vx: new Float32Array(_NED), vy: new Float32Array(_NED), vz: new Float32Array(_NED), life: new Float32Array(_NED), maxLife: new Float32Array(_NED), phase: new Float32Array(_NED), nextSlot: 0 });

  useFrame(({ clock }, delta) => {
    const t  = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const inten = _fieryState.intensity;
    const burst = _fieryState.burstTimer > 0;
    if (burst) _fieryState.burstTimer -= dt;
    _fieryState.whiteHotTimer = Math.max(0, _fieryState.whiteHotTimer - dt);
    const bMul    = burst ? 1.42 : 1.0;
    const whiteHot = _fieryState.whiteHotTimer > 0
      ? (_fieryState.whiteHotTimer / 0.15)
      : 0;

    // ── Shell uniforms ──────────────────────────────────────────────────────────
    const burstScale = burst ? 1.4 : 1.0;
    innerMat.uniforms.uTime.value      = t;
    innerMat.uniforms.uIntensity.value = inten * bMul;
    innerMat.uniforms.uBurstScale.value = burstScale;
    innerMat.uniforms.uWhiteHot.value  = whiteHot;
    coronaMat.uniforms.uTime.value     = t;
    coronaMat.uniforms.uIntensity.value = inten * bMul;
    coronaMat.uniforms.uBurstScale.value = burstScale;
    coronaMat.uniforms.uWhiteHot.value = whiteHot;
    hazeMat.uniforms.uTime.value       = t;

    // ── fBm-driven flickering point light ──────────────────────────────────────
    if (lightRef.current) {
      // Multi-layer fBm from sine sums (GPU-style, zero GC)
      const f1 = Math.sin(t * 23.1) * 0.14 + Math.sin(t * 37.7) * 0.09 + Math.sin(t * 11.3) * 0.05;
      const f2 = Math.sin(t *  7.2) * 0.06 + Math.sin(t *  5.1) * 0.04;
      const fl = 0.70 + f1 + f2;
      lightRef.current.intensity  = (3.6 + whiteHot * 3.0) * fl * inten;
      // fBm position drift
      lightRef.current.position.x = Math.sin(t * 11.0) * 0.06 + Math.sin(t * 7.3) * 0.03;
      lightRef.current.position.y = Math.sin(t *  8.4) * 0.05 + Math.sin(t * 5.9) * 0.02;
    }

    // ── Shockwave: spawn all bright embers radially outward at once ─────────────
    if (_fieryState.shockwave) {
      _fieryState.shockwave = false;
      const b = bp.current;
      for (let i = 0; i < _NEB; i++) {
        const theta = (i / _NEB) * Math.PI * 2;
        const phi   = Math.PI / 2 + (Math.random() - 0.5) * 1.2; // near equator
        const sR    = orbR * 1.32;
        b.px[i] = sR * Math.sin(phi) * Math.cos(theta);
        b.py[i] = sR * Math.cos(phi);
        b.pz[i] = sR * Math.sin(phi) * Math.sin(theta);
        const nx = b.px[i]/sR, ny = b.py[i]/sR, nz = b.pz[i]/sR;
        const spd = 3.8 + Math.random() * 2.8;
        b.vx[i] = nx*spd; b.vy[i] = ny*spd + 0.4; b.vz[i] = nz*spd;
        b.life[i] = 0; b.maxLife[i] = 0.4 + Math.random()*0.5; b.phase[i] = Math.random()*Math.PI*2;
      }
      b.born = true;
    }

    // ── Core flames ─────────────────────────────────────────────────────────────
    const c = cp.current;
    if (!c.born) { for (let i=0;i<_NC;i++) _spawnFlame(i,c.px,c.py,c.pz,c.vx,c.vy,c.vz,c.life,c.maxLife,c.phase,orbR,false,false); c.born=true; }
    const cMesh = coreIM.current;
    if (cMesh) {
      for (let i=0;i<_NC;i++) {
        c.life[i] += dt * inten;
        if (c.life[i] >= c.maxLife[i]) { _spawnFlame(i,c.px,c.py,c.pz,c.vx,c.vy,c.vz,c.life,c.maxLife,c.phase,orbR,false,burst); continue; }
        if (c.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); cMesh.setMatrixAt(i,_dummy.matrix); continue; }
        const lf = c.life[i]/c.maxLife[i];
        // Curl-noise approximation: lateral sinusoidal drift
        const cx = Math.sin(t*3.3+c.phase[i])*0.22*lf;
        const cz = Math.cos(t*2.9+c.phase[i])*0.22*lf;
        c.px[i] += (c.vx[i]+cx)*dt; c.py[i] += c.vy[i]*dt*(1+lf*0.55); c.pz[i] += (c.vz[i]+cz)*dt;
        c.vx[i]*=0.993; c.vy[i]*=0.996; c.vz[i]*=0.993;
        // Lifecycle scale: spawn small → swell 2.5× → contract/fade
        const sc = lf < 0.40 ? lf/0.40 : lf < 0.70 ? 1.0 : (1.0-lf)/0.30;
        const sz = Math.max(0.001, (0.055 + lf*0.085)*sc*scale*bMul);
        _dummy.position.set(c.px[i],c.py[i],c.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix(); cMesh.setMatrixAt(i,_dummy.matrix);
      }
      cMesh.instanceMatrix.needsUpdate = true;
      coreMat.opacity = (0.80 + whiteHot*0.18) * inten;
    }

    // ── Outer / corona flames ───────────────────────────────────────────────────
    const o = op.current;
    if (!o.born) { for (let i=0;i<_NO;i++) _spawnFlame(i,o.px,o.py,o.pz,o.vx,o.vy,o.vz,o.life,o.maxLife,o.phase,orbR,true,false); o.born=true; }
    const oMesh = outerIM.current;
    if (oMesh) {
      for (let i=0;i<_NO;i++) {
        o.life[i] += dt * inten;
        if (o.life[i] >= o.maxLife[i]) { _spawnFlame(i,o.px,o.py,o.pz,o.vx,o.vy,o.vz,o.life,o.maxLife,o.phase,orbR,true,burst); continue; }
        if (o.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); oMesh.setMatrixAt(i,_dummy.matrix); continue; }
        const lf = o.life[i]/o.maxLife[i];
        const cx = Math.sin(t*2.8+o.phase[i]+1.5)*0.28*lf;
        const cz = Math.cos(t*2.2+o.phase[i]+1.5)*0.28*lf;
        o.px[i]+=(o.vx[i]+cx)*dt; o.py[i]+=o.vy[i]*dt*(1+lf*0.65); o.pz[i]+=(o.vz[i]+cz)*dt;
        o.vx[i]*=0.988; o.vy[i]*=0.993; o.vz[i]*=0.988;
        const sc = lf < 0.35 ? lf/0.35 : 1.0 - (lf-0.35)/0.65*0.55;
        const sz = Math.max(0.001,(0.045+lf*0.060)*sc*scale*bMul);
        _dummy.position.set(o.px[i],o.py[i],o.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix(); oMesh.setMatrixAt(i,_dummy.matrix);
      }
      oMesh.instanceMatrix.needsUpdate = true;
      outerMat.opacity = (0.58 + whiteHot*0.20) * inten;
    }

    // ── Bright hot embers ───────────────────────────────────────────────────────
    const b = bp.current;
    if (!b.born) { for (let i=0;i<_NEB;i++) _spawnBrightEmber(i,b.px,b.py,b.pz,b.vx,b.vy,b.vz,b.life,b.maxLife,b.phase,orbR,false); b.born=true; }
    const bMesh = brightIM.current;
    const d2 = dp2.current;
    const dMesh = dyingIM.current;
    if (bMesh) {
      for (let i=0;i<_NEB;i++) {
        b.life[i] += dt * inten;
        if (b.life[i] >= b.maxLife[i]) {
          // Snap-to-crimson: spawn a dying ember at the last position before respawning
          if (dMesh && b.px[i] !== 999) {
            const ds = d2.nextSlot % _NED; d2.nextSlot++;
            _spawnDyingEmber(ds,d2.px,d2.py,d2.pz,d2.vx,d2.vy,d2.vz,d2.life,d2.maxLife,d2.phase,b.px[i],b.py[i],b.pz[i]);
          }
          _spawnBrightEmber(i,b.px,b.py,b.pz,b.vx,b.vy,b.vz,b.life,b.maxLife,b.phase,orbR,burst); continue;
        }
        if (b.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); bMesh.setMatrixAt(i,_dummy.matrix); continue; }
        const lf = b.life[i]/b.maxLife[i];
        b.vx[i]*=0.933; b.vz[i]*=0.933; b.vy[i]*=0.956;
        b.px[i]+=b.vx[i]*dt; b.py[i]+=(b.vy[i]+0.40)*dt; b.pz[i]+=b.vz[i]*dt;
        // High-freq sine brightness flicker
        const flickHz = 20 + (b.phase[i]*17 % 14);
        const fl = 0.48 + Math.abs(Math.sin(t*flickHz + b.phase[i])) * 0.52;
        const sz = Math.max(0.001,(0.020+(1-lf)*0.035)*fl*scale);
        _dummy.position.set(b.px[i],b.py[i],b.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix(); bMesh.setMatrixAt(i,_dummy.matrix);
      }
      bMesh.instanceMatrix.needsUpdate = true;
      brightMat.opacity = (0.50 + Math.sin(t*19.3)*0.28) * inten;
    }

    // ── Dying-crimson embers ────────────────────────────────────────────────────
    if (dMesh) {
      for (let i=0;i<_NED;i++) {
        if (d2.maxLife[i] <= 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); dMesh.setMatrixAt(i,_dummy.matrix); continue; }
        d2.life[i] += dt;
        if (d2.life[i] >= d2.maxLife[i]) { d2.maxLife[i]=0; _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); dMesh.setMatrixAt(i,_dummy.matrix); continue; }
        const lf = d2.life[i]/d2.maxLife[i];
        d2.px[i]+=d2.vx[i]*dt; d2.py[i]+=d2.vy[i]*dt; d2.pz[i]+=d2.vz[i]*dt;
        const sz = Math.max(0.001, scale*0.014*(1-lf));
        _dummy.position.set(d2.px[i],d2.py[i],d2.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix(); dMesh.setMatrixAt(i,_dummy.matrix);
      }
      dMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* fBm-driven amber fire light */}
      <pointLight ref={lightRef} color="#ff6600" intensity={3.6} distance={5.8} decay={2} />
      {/* Inner combustion shell — dual-frequency displacement + blackbody ramp */}
      <mesh scale={innerR}  material={innerMat}  geometry={_fireShellGeo}  />
      {/* Outer corona shell — cooler, edge-glow focused */}
      <mesh scale={coronaR} material={coronaMat} geometry={_fireCoronaGeo} />
      {/* Heat-haze sphere — NdotV edge falloff */}
      <mesh scale={hazeR}   material={hazeMat}   geometry={_hazeGeoF}      />
      {/* Core orange-hot flame particles */}
      <instancedMesh ref={coreIM}   args={[_fPartGeo,  coreMat,   _NC]}  frustumCulled={false} />
      {/* Outer crimson flame particles */}
      <instancedMesh ref={outerIM}  args={[_fPartGeo,  outerMat,  _NO]}  frustumCulled={false} />
      {/* Bright hot ember sparks */}
      <instancedMesh ref={brightIM} args={[_emberGeoF, brightMat, _NEB]} frustumCulled={false} />
      {/* Dying-crimson ember snaps */}
      <instancedMesh ref={dyingIM}  args={[_emberGeoF, dyingMat,  _NED]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Crystalline Aura — Prismatic Crystal Shell & Chromatic Dispersion VFX
//    Dual-layer refractive GLSL shells, dual-Voronoi caustic rays, 200-particle
//    camera-glint crystal dust, 12 orbiting shards, flickering jewel light.
// ─────────────────────────────────────────────────────────────────────────────

// ── GLSL: inner crystal shell (Fresnel facets + chromatic IOR split) ──────────
const _crystInnerVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec4 wp   = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vViewDir  = normalize(cameraPosition - wp.xyz);
  float b   = sin(uTime * 1.9 + position.y * 3.2) * 0.013 * uIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + b), 1.0);
}`;

const _crystInnerFrag = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec3 flatN  = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float nv    = max(0.0, dot(flatN, vViewDir));
  float fr    = pow(1.0 - nv, 4.0);
  float frR   = pow(1.0 - max(0.0, dot(flatN + vec3(0.04,0.0,0.0), vViewDir)), 4.0);
  float frB   = pow(1.0 - max(0.0, dot(flatN - vec3(0.04,0.0,0.0), vViewDir)), 4.0);
  float cy    = fract(uTime * 0.15);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 base;
  if      (cy < 0.33) base = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) base = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                base = mix(cQ, cS, (cy - 0.66) * 3.030);
  vec3 col  = mix(base, vec3(1.0), pow(fr, 2.0) * 0.85);
  col.r     = min(1.0, col.r + frR * 0.55);
  col.b     = min(1.0, col.b + frB * 0.55);
  float alpha = (0.12 + fr * 0.60) * uIntensity;
  gl_FragColor = vec4(col * (1.0 + fr * 0.9), alpha);
}`;

// ── GLSL: outer crystal shell (dual-Voronoi caustics + stronger dispersion) ───
const _crystOuterVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec4 wp   = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vViewDir  = normalize(cameraPosition - wp.xyz);
  float b   = sin(uTime * 1.3 + position.y * 2.5) * 0.018 * uIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + b), 1.0);
}`;

const _crystOuterFrag = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
float h2(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 73.2); return fract(p.x * p.y); }
float voronoi(vec2 p, float spd) {
  vec2 i = floor(p); vec2 f = fract(p); float md = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 nb = vec2(float(x), float(y));
    vec2 pt = nb + 0.5 + 0.45 * sin(uTime * spd + 6.2832 * vec2(h2(i+nb), h2(i+nb+vec2(34.2,11.5))));
    vec2 r = pt - f; md = min(md, dot(r, r));
  }
  return sqrt(md);
}
void main() {
  vec3 flatN  = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float nv    = max(0.0, dot(flatN, vViewDir));
  float fr    = pow(1.0 - nv, 3.0);
  float frR   = pow(1.0 - max(0.0, dot(flatN + vec3(0.06,0.0,0.0), vViewDir)), 3.0);
  float frB   = pow(1.0 - max(0.0, dot(flatN - vec3(0.06,0.0,0.0), vViewDir)), 3.0);
  float v1    = voronoi(vWorldPos.xy * 2.2,  1.1);
  float v2    = voronoi(vWorldPos.yz * 2.0, -0.85);
  float caust = pow(1.0 - (v1 + v2) * 0.5, 2.5);
  float cy    = fract(uTime * 0.15 + 0.17);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 base;
  if      (cy < 0.33) base = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) base = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                base = mix(cQ, cS, (cy - 0.66) * 3.030);
  vec3 col  = mix(base, vec3(1.0), pow(fr, 1.5) * 0.75);
  col      += caust * vec3(0.25, 0.55, 1.0) * 0.55;
  col.r     = min(1.0, col.r + frR * 0.65);
  col.b     = min(1.0, col.b + frB * 0.65);
  float alpha = (0.08 + fr * 0.50 + caust * 0.20) * uIntensity;
  gl_FragColor = vec4(col * (1.0 + fr * 0.8 + caust * 0.5), alpha);
}`;

// ── GLSL: caustic ray cones (dual-Voronoi scrolled in opposite directions) ────
const _crystRayVert = /* glsl */`
varying vec2 vUv2;
void main() { vUv2 = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const _crystRayFrag = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv2;
float h2r(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 73.2); return fract(p.x * p.y); }
float voronoiR(vec2 p, float spd) {
  vec2 i = floor(p); vec2 f = fract(p); float md = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 nb = vec2(float(x), float(y));
    vec2 pt = nb + 0.5 + 0.45 * sin(uTime * spd + 6.2832 * vec2(h2r(i+nb), h2r(i+nb+vec2(34.2,11.5))));
    vec2 r = pt - f; md = min(md, dot(r, r));
  }
  return sqrt(md);
}
void main() {
  // vUv2.y: 0 = tip (near crystal), 1 = base (far end); fade bright→transparent
  float fade = 1.0 - vUv2.y;
  float v1   = voronoiR(vUv2 * 3.5 + vec2(uTime * 0.28, 0.0),  1.2);
  float v2   = voronoiR(vUv2 * 3.0 - vec2(uTime * 0.22, 0.0), -0.9);
  float caust = pow(1.0 - (v1 + v2) * 0.5, 2.2);
  float cy   = fract(uTime * 0.18);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 col;
  if      (cy < 0.33) col = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) col = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                col = mix(cQ, cS, (cy - 0.66) * 3.030);
  col += caust * 0.38;
  float pulse = 0.55 + 0.45 * sin(uTime * 2.5 + vUv2.y * 4.5);
  float alpha = caust * fade * pulse * 0.60 * uIntensity;
  gl_FragColor = vec4(col, alpha);
}`;

// ── Shared module-level geometries ────────────────────────────────────────────
const _crystInnerGeo = new THREE.IcosahedronGeometry(1.0, 2);
const _crystOuterGeo = new THREE.IcosahedronGeometry(1.0, 1);
const _crystDustGeo  = new THREE.SphereGeometry(1.0, 3, 2);
const _crystShardGeo = new THREE.OctahedronGeometry(1.0, 0);

// ── Zero-GC temp vectors ──────────────────────────────────────────────────────
const _v3cam = new THREE.Vector3();
const _v3p   = new THREE.Vector3();

// ── Module-level crystalline state + public API ───────────────────────────────
const _crystState = { intensity: 1.0, burstTimer: 0.0 };
export function setCrystallineIntensity(f: number) {
  _crystState.intensity = Math.max(0.2, Math.min(2.0, f));
}
export function shatterBurst() { _crystState.burstTimer = 0.60; }

// ── Dust particle pool ────────────────────────────────────────────────────────
const _N_CDUST = 200;

function _spawnDust(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  driftR: number,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = driftR * (0.45 + Math.random() * 0.55);
  px[i] = r * Math.sin(phi) * Math.cos(theta);
  py[i] = r * Math.cos(phi);
  pz[i] = r * Math.sin(phi) * Math.sin(theta);
  vx[i] = (Math.random() - 0.5) * 0.14;
  vy[i] = (Math.random() - 0.5) * 0.14;
  vz[i] = (Math.random() - 0.5) * 0.14;
  life[i]    = -(Math.random() * 1.6);
  maxLife[i] = 1.6 + Math.random() * 2.0;
  phase[i]   = Math.random() * Math.PI * 2;
}

function CrystallineAura({ scale }: RingProps) {
  const innerR   = scale * 0.70;
  const outerR   = scale * 0.90;
  const rayLen   = scale * 1.55;
  const rayBase  = rayLen * 0.17;
  const driftR   = scale * 1.45;
  const shardOR  = scale * 1.10;

  // ── Materials (in useMemo — avoids vertexColors module-level pitfall) ────────
  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystInnerVert, fragmentShader: _crystInnerFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), []);
  const outerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystOuterVert, fragmentShader: _crystOuterFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), []);
  const rayMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystRayVert, fragmentShader: _crystRayFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);
  // Scale-dependent ray cone geometry
  const rayGeo = useMemo(() => new THREE.ConeGeometry(rayBase, rayLen, 6, 4), [rayBase, rayLen]);
  const dustMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: "#99ccff", transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  // Three shard colors: sapphire / amethyst / aquamarine
  const matS = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0044ff", transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const matA = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8822ee", transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const matQ = useMemo(() => new THREE.MeshBasicMaterial({ color: "#00ffcc", transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  useEffect(() => () => {
    innerMat.dispose(); outerMat.dispose(); rayMat.dispose(); rayGeo.dispose();
    dustMat.dispose(); matS.dispose(); matA.dispose(); matQ.dispose();
  }, [innerMat, outerMat, rayMat, rayGeo, dustMat, matS, matA, matQ]);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const lightRef  = useRef<THREE.PointLight>(null);
  const raysRef   = useRef<THREE.Group>(null);
  const dustIM    = useRef<THREE.InstancedMesh>(null);
  const shardImS  = useRef<THREE.InstancedMesh>(null);
  const shardImA  = useRef<THREE.InstancedMesh>(null);
  const shardImQ  = useRef<THREE.InstancedMesh>(null);

  // ── Dust particle pool ───────────────────────────────────────────────────────
  const dp = useRef({
    px: new Float32Array(_N_CDUST), py: new Float32Array(_N_CDUST), pz: new Float32Array(_N_CDUST),
    vx: new Float32Array(_N_CDUST), vy: new Float32Array(_N_CDUST), vz: new Float32Array(_N_CDUST),
    life: new Float32Array(_N_CDUST), maxLife: new Float32Array(_N_CDUST), phase: new Float32Array(_N_CDUST),
    born: false,
  });

  useFrame(({ clock, camera }, delta) => {
    const t   = clock.getElapsedTime();
    const dt  = Math.min(delta, 0.05);
    const inten = _crystState.intensity;
    const burst = _crystState.burstTimer > 0;
    if (burst) _crystState.burstTimer -= dt;
    const bMul = burst ? 1.70 : 1.0;

    // ── Shell + ray uniforms ────────────────────────────────────────────────────
    innerMat.uniforms.uTime.value      = t;
    innerMat.uniforms.uIntensity.value = inten * bMul;
    outerMat.uniforms.uTime.value      = t;
    outerMat.uniforms.uIntensity.value = inten * bMul;
    rayMat.uniforms.uTime.value        = t;
    rayMat.uniforms.uIntensity.value   = inten * (0.55 + Math.sin(t * 2.5) * 0.45) * bMul;

    // ── Slow-rotate caustic ray group ───────────────────────────────────────────
    if (raysRef.current) raysRef.current.rotation.z = t * 0.30;

    // ── Jewel light flicker ─────────────────────────────────────────────────────
    if (lightRef.current) {
      const fl = 0.78 + Math.sin(t * 13.7) * 0.13 + Math.sin(t * 8.3) * 0.09;
      lightRef.current.intensity = 2.8 * fl * inten * bMul;
    }

    // ── 12 orbiting crystal shards (4 per color group) ──────────────────────────
    const orbitR = shardOR * (burst ? 1.38 : 1.0);
    const inclinations = [0, Math.PI / 5, Math.PI / 3, Math.PI * 2 / 5];
    ([
      { im: shardImS.current, mat: matS, offset: 0 },
      { im: shardImA.current, mat: matA, offset: 1 },
      { im: shardImQ.current, mat: matQ, offset: 2 },
    ] as const).forEach(({ im, mat, offset }) => {
      if (!im) return;
      for (let k = 0; k < 4; k++) {
        const gi    = offset * 4 + k;
        const incl  = inclinations[k];
        const spd   = burst ? 4.0 : (0.65 + offset * 0.20 + k * 0.13);
        const a     = (gi / 12) * Math.PI * 2 + t * spd;
        const x     = orbitR * Math.cos(a);
        const y     = orbitR * Math.sin(a) * Math.cos(incl);
        const z     = orbitR * Math.sin(a) * Math.sin(incl);
        const glint = 0.85 + Math.sin(t * 4.8 + gi * 1.2) * 0.45;
        const sc    = scale * 0.078 * glint * (burst ? 1.45 : 1.0);
        _dummy.position.set(x, y, z);
        _dummy.rotation.x = t * 1.3 + gi;
        _dummy.rotation.y = t * 0.8 + gi * 0.6;
        _dummy.scale.setScalar(Math.max(0.001, sc));
        _dummy.updateMatrix();
        im.setMatrixAt(k, _dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      mat.opacity = 0.70 + Math.sin(t * 3.3 + offset) * 0.22;
    });

    // ── Crystal dust — 200-particle zero-gravity glint field ────────────────────
    const d = dp.current;
    if (!d.born) {
      for (let i = 0; i < _N_CDUST; i++) _spawnDust(i, d.px,d.py,d.pz,d.vx,d.vy,d.vz,d.life,d.maxLife,d.phase,driftR);
      d.born = true;
    }
    const dMesh = dustIM.current;
    if (dMesh) {
      _v3cam.copy(camera.position).normalize(); // camera view direction (zero-alloc)
      for (let i = 0; i < _N_CDUST; i++) {
        d.life[i] += dt * inten;
        if (d.life[i] >= d.maxLife[i]) {
          _spawnDust(i, d.px,d.py,d.pz,d.vx,d.vy,d.vz,d.life,d.maxLife,d.phase, driftR * (burst ? 1.55 : 1.0));
          continue;
        }
        if (d.life[i] < 0) {
          _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix();
          dMesh.setMatrixAt(i, _dummy.matrix); continue;
        }
        const lf = d.life[i] / d.maxLife[i];
        // Zero-gravity drift + gentle curl
        d.px[i] += (d.vx[i] + Math.sin(t * 0.8 + d.phase[i]) * 0.038) * dt;
        d.py[i] += d.vy[i] * dt;
        d.pz[i] += (d.vz[i] + Math.cos(t * 0.7 + d.phase[i]) * 0.038) * dt;
        // Camera-dot glint: particles aligned with camera → starburst scale
        _v3p.set(d.px[i], d.py[i], d.pz[i]).normalize();
        const camDot   = Math.max(0, _v3p.dot(_v3cam));
        const starburst = Math.pow(camDot, 6) * 3.8 + 1.0;
        // Opacity envelope
        const fadeLf = lf < 0.1 ? lf * 10 : (lf > 0.85 ? (1 - lf) / 0.15 : 1.0);
        const sparkle = 0.68 + Math.sin(t * 22 + d.phase[i]) * 0.32;
        const sz = Math.max(0.001, scale * 0.021 * starburst * sparkle * fadeLf);
        _dummy.position.set(d.px[i], d.py[i], d.pz[i]);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        dMesh.setMatrixAt(i, _dummy.matrix);
      }
      dMesh.instanceMatrix.needsUpdate = true;
      dustMat.opacity = (0.78 + Math.sin(t * 11.3) * 0.18) * inten;
    }
  });

  // Pre-compute 8 ray cone transforms (tip near crystal, base fans outward)
  // Cone +Y = tip; rotating [0,0, π/2 + a] makes tip point toward center.
  const rayTransforms = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a    = (i / 8) * Math.PI * 2;
    const dist = innerR + rayLen / 2;
    return {
      position: [Math.cos(a) * dist, Math.sin(a) * dist, 0] as [number, number, number],
      rotZ: Math.PI / 2 + a,
    };
  }), [innerR, rayLen]);

  return (
    <group>
      {/* Flickering jewel point light */}
      <pointLight ref={lightRef} color="#6633ff" intensity={2.8} distance={6} decay={2} />

      {/* Inner faceted crystal shell — Fresnel + chromatic IOR split */}
      <mesh scale={innerR} material={innerMat} geometry={_crystInnerGeo} />

      {/* Outer faceted crystal shell — Voronoi caustics + stronger dispersion */}
      <mesh scale={outerR} material={outerMat} geometry={_crystOuterGeo} />

      {/* 8 caustic ray cones — rotate as a group, dual-Voronoi shader */}
      <group ref={raysRef}>
        {rayTransforms.map((rt, i) => (
          <mesh key={i} position={rt.position} rotation={[0, 0, rt.rotZ]}
                material={rayMat} geometry={rayGeo} />
        ))}
      </group>

      {/* 200-particle zero-gravity crystal dust — camera-glint starburst */}
      <instancedMesh ref={dustIM} args={[_crystDustGeo, dustMat, _N_CDUST]} frustumCulled={false} />

      {/* 12 orbiting shards: 4 sapphire + 4 amethyst + 4 aquamarine */}
      <instancedMesh ref={shardImS} args={[_crystShardGeo, matS, 4]} frustumCulled={false} />
      <instancedMesh ref={shardImA} args={[_crystShardGeo, matA, 4]} frustumCulled={false} />
      <instancedMesh ref={shardImQ} args={[_crystShardGeo, matQ, 4]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Void Tendril Vortex — Dark Matter Fluid (indigo / magenta)
//    Pure particle system — no solid geometry. Curl-noise-like swirl.
// ─────────────────────────────────────────────────────────────────────────────
const _N_VOID = 80;
const _mat_void = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function VoidTendril({ scale }: RingProps) {
  const r   = scale * 2.0;
  const ref = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = ref.current;
    if (!im) return;
    for (let i = 0; i < _N_VOID; i++) {
      const base  = (i / _N_VOID) * Math.PI * 2;
      const curl1 = Math.sin(base * 3 + t * 1.2) * 0.5;
      const curl2 = Math.cos(base * 2 + t * 0.9) * 0.4;
      const a     = base + t * 0.7 + curl1;
      const rad   = r * (0.42 + Math.abs(Math.sin(base * 2 + t * 0.6)) * 0.60 + curl2 * 0.25);
      _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, Math.sin(t * 2 + i * 0.4) * 0.15);
      _dummy.scale.setScalar(0.55 + Math.sin(t * 5 + i * 0.8) * 0.42);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      const frac = i / _N_VOID;
      _col.setHex(frac < 0.4 ? 0x1A002C : frac < 0.7 ? 0x660044 : 0xFF0055);
      _col.multiplyScalar(0.65 + Math.sin(t * 6 + i) * 0.35);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#aa0066" intensity={1.2} distance={4} decay={2} />
      <instancedMesh ref={ref} args={[_geo_sm, _mat_void, _N_VOID]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Hyper-Tech Collider — Particle Accelerator (carbon + white plasma beams)
//    Twin beams orbit at extreme speed in opposite directions inside housing ring.
// ─────────────────────────────────────────────────────────────────────────────
const _N_BEAM = 80;
const _mat_beam = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function HyperCollider({ scale }: RingProps) {
  const r      = scale * 2.0;
  const beamRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = beamRef.current;
    if (!im) return;
    const half = _N_BEAM / 2;
    for (let i = 0; i < _N_BEAM; i++) {
      const dir  = i < half ? 1 : -1;
      const idx  = i < half ? i : i - half;
      const a    = (idx / half) * Math.PI * 2 + t * dir * 8.0;
      const beamR = r * 0.85;
      _dummy.position.set(Math.cos(a) * beamR, Math.sin(a) * beamR, 0.04);
      _dummy.scale.setScalar(0.38 + Math.sin(t * 22 + i) * 0.25);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(dir > 0 ? "#FFFFFF" : "#AADDFF");
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#aaddff" intensity={1.6} distance={4} decay={2} />
      {/* Carbon-fiber housing */}
      <mesh>
        <ringGeometry args={[r * 0.79, r, 64]} />
        <meshBasicMaterial color="#16161e" transparent opacity={0.92} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Glowing glass track */}
      <mesh>
        <ringGeometry args={[r * 0.82, r * 0.88, 64]} />
        <meshBasicMaterial color="#4488FF" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={beamRef} args={[_geo_xs, _mat_beam, _N_BEAM]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Solar Flare Corona — Sunspot Plasma Waves (white-gold GLSL torus + embers)
//    Custom ShaderMaterial drives vertex displacement solar prominences.
// ─────────────────────────────────────────────────────────────────────────────
const _solarVert = /* glsl */`
  uniform float u_time;
  varying float vDisp;
  void main() {
    vec3 p = position;
    float d = sin(p.x * 14.0 + u_time * 3.0) * cos(p.z * 9.0 + u_time * 2.2) * 0.18;
    d += cos(p.y * 11.0 + u_time * 4.0) * sin(p.x * 6.0 + u_time * 1.5) * 0.10;
    vDisp = d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + normal * d, 1.0);
  }
`;
const _solarFrag = /* glsl */`
  uniform float u_time;
  varying float vDisp;
  void main() {
    float heat = clamp(vDisp * 5.0 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.45, 0.0), vec3(1.0, 1.0, 0.92), heat);
    gl_FragColor = vec4(col, 0.82 - abs(heat - 0.5) * 0.5);
  }
`;
const _N_EMBERS = 36;
const _mat_embers = new THREE.MeshBasicMaterial({ color: "#FFA500", transparent: true, depthWrite: false });

function SolarCorona({ scale }: RingProps) {
  const r        = scale * 2.0;
  const torusRef = useRef<THREE.Mesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const uTime    = useRef({ value: 0 });
  const solarMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   _solarVert,
    fragmentShader: _solarFrag,
    uniforms: { u_time: uTime.current },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);
  useEffect(() => () => { solarMat.dispose(); }, [solarMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uTime.current.value = t;
    if (torusRef.current) {
      torusRef.current.rotation.z = t * 0.35;
      torusRef.current.rotation.x = Math.sin(t * 0.4) * 0.14;
    }
    const im = emberRef.current;
    if (!im) return;
    for (let i = 0; i < _N_EMBERS; i++) {
      const baseA = (i / _N_EMBERS) * Math.PI * 2;
      const drift = t * (0.38 + (i % 5) * 0.08) + Math.sin(t * 1.5 + i) * 0.4;
      const a     = baseA + drift;
      const rr    = r * (1.04 + Math.sin(t * 2 + i * 0.8) * 0.2);
      _dummy.position.set(Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(t * 3 + i) * 0.1);
      _dummy.scale.setScalar(0.45 + Math.sin(t * 8 + i * 1.2) * 0.38);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#FF8800" intensity={1.5} distance={5} decay={2} />
      <mesh ref={torusRef} material={solarMat}>
        <torusGeometry args={[r * 0.88, r * 0.11, 24, 64]} />
      </mesh>
      <instancedMesh ref={emberRef} args={[_geo_xs, _mat_embers, _N_EMBERS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Prismatic Lattice — Crystalline Light Refraction (rainbow crystal shards)
//    12 crystal cone shards bob individually on sine waves + rainbow color cycle.
// ─────────────────────────────────────────────────────────────────────────────
const _mat_crystal = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });
const _N_CRYSTALS  = 12;

function PrismaticLattice({ scale }: RingProps) {
  const r        = scale * 2.0;
  const shardRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = shardRef.current;
    if (!im) return;
    for (let i = 0; i < _N_CRYSTALS; i++) {
      const baseA = (i / _N_CRYSTALS) * Math.PI * 2;
      const drift = t * 0.5 * (i % 2 === 0 ? 1 : -1);
      const a     = baseA + drift;
      const bob   = Math.sin(t * 1.8 + i * 0.7) * 0.22 * scale;
      _dummy.position.set(
        Math.cos(a) * r * 0.90,
        Math.sin(a) * r * 0.90 + bob,
        Math.sin(t * 2.5 + i * 0.5) * 0.10
      );
      _dummy.rotation.z = a + t * (i % 2 === 0 ? 0.8 : -0.6);
      _dummy.scale.setScalar(0.78 + Math.sin(t * 3 + i * 1.3) * 0.28);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setHSL((t * 0.08 + i / _N_CRYSTALS) % 1, 1.0, 0.65);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ffffff" intensity={1.2} distance={4} decay={2} />
      <mesh>
        <ringGeometry args={[r * 0.85, r, 64]} />
        <meshBasicMaterial color="#88FFFF" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={shardRef} args={[_geo_cone, _mat_crystal, _N_CRYSTALS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Zero-Point Tesla — High-Voltage Energy Grid (copper rings + arc lightning)
//    12 procedural lightning arcs updated every frame; copper conductor rings.
// ─────────────────────────────────────────────────────────────────────────────
const _ZT_ARCS = 12;
const _ZT_SEGS = 10; // points per arc

function ZeroTesla({ scale }: RingProps) {
  const r        = scale * 2.0;
  const groupRef = useRef<THREE.Group>(null);

  // Create arc lines imperatively (geometry updated every frame)
  const arcData = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, depthWrite: false });
    const arcs = Array.from({ length: _ZT_ARCS }, () => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(_ZT_SEGS * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return { line: new THREE.Line(geo, mat), geo, pos };
    });
    return { arcs, mat };
  }, []);

  // Add lines to group after first render; dispose on unmount
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    arcData.arcs.forEach(({ line }) => g.add(line));
    return () => {
      arcData.arcs.forEach(({ line, geo }) => { g.remove(line); geo.dispose(); });
      arcData.mat.dispose();
    };
  }, [arcData]);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    arcData.arcs.forEach(({ line, geo, pos }, i) => {
      const startA = (i / _ZT_ARCS) * Math.PI * 2;
      const span   = Math.PI * 2 * (0.14 + (i % 3) * 0.06);
      const endA   = startA + span;
      const sx = Math.cos(startA) * r * 0.9, sy = Math.sin(startA) * r * 0.9;
      const ex = Math.cos(endA)   * r * 0.9, ey = Math.sin(endA)   * r * 0.9;
      pos[0] = sx; pos[1] = sy; pos[2] = 0.05;
      for (let s = 1; s < _ZT_SEGS - 1; s++) {
        const frac   = s / (_ZT_SEGS - 1);
        const spread = 0.38 * (1 - Math.abs(frac - 0.5) * 2);
        const nx = Math.sin(t * 22 + i * 3.7 + s * 1.9) * spread * r * 0.50;
        const ny = Math.cos(t * 18 + i * 2.3 + s * 2.5) * spread * r * 0.50;
        pos[s * 3]     = sx + (ex - sx) * frac + nx;
        pos[s * 3 + 1] = sy + (ey - sy) * frac + ny;
        pos[s * 3 + 2] = 0.05;
      }
      pos[(_ZT_SEGS - 1) * 3]     = ex;
      pos[(_ZT_SEGS - 1) * 3 + 1] = ey;
      pos[(_ZT_SEGS - 1) * 3 + 2] = 0.05;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (line.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(t * 30 + i * 4.1) * 0.38;
    });
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#ffffff" intensity={2.0} distance={4} decay={2} />
      {/* Copper conductor ring 1 */}
      <mesh>
        <ringGeometry args={[r * 0.84, r * 0.93, 48]} />
        <meshBasicMaterial color="#B87333" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Copper conductor ring 2 — tilted */}
      <mesh rotation={[Math.PI / 6, 0, 0]}>
        <ringGeometry args={[r * 0.84, r * 0.93, 48]} />
        <meshBasicMaterial color="#CD7F32" transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Astral Nebula Ring — Stardust Cosmic Halo (magenta / teal / gold)
//     200 twinkling star instances orbiting in a gentle miniature galaxy swirl.
// ─────────────────────────────────────────────────────────────────────────────
const _N_STARS   = 200;
const _STAR_COLS = ["#FF00AA", "#00F0FF", "#FFD700", "#FF88CC", "#88FFFF", "#FFEE88"] as const;
const _mat_stars = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function AstralNebula({ scale }: RingProps) {
  const r       = scale * 2.0;
  const starRef = useRef<THREE.InstancedMesh>(null);

  const starData = useMemo(() => Array.from({ length: _N_STARS }, (_, i) => ({
    baseAngle: (i / _N_STARS) * Math.PI * 2 + (Math.sin(i * 7.3) * 0.3),
    radius:    r * (0.48 + (Math.sin(i * 3.1) * 0.5 + 0.5) * 0.57),
    speed:     0.12 + (Math.sin(i * 11.7) * 0.5 + 0.5) * 0.24,
    phase:     Math.sin(i * 5.9) * Math.PI * 2,
    size:      0.28 + (Math.sin(i * 8.3) * 0.5 + 0.5) * 0.72,
    colorIdx:  i % _STAR_COLS.length,
    zOff:      Math.sin(i * 4.1) * 0.12,
  })), [r]);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = starRef.current;
    if (!im) return;
    for (let i = 0; i < _N_STARS; i++) {
      const s = starData[i];
      const a = s.baseAngle + t * s.speed;
      _dummy.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius, s.zOff);
      _dummy.scale.setScalar(s.size * (0.48 + Math.sin(t * 4 + s.phase) * 0.46));
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(_STAR_COLS[s.colorIdx]);
      _col.multiplyScalar(0.55 + Math.sin(t * 3 + s.phase) * 0.45);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff44aa" intensity={1.2} distance={5} decay={2} />
      {/* Soft nebula haze */}
      <mesh>
        <ringGeometry args={[r * 0.43, r * 1.08, 64]} />
        <meshBasicMaterial color="#440022" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={starRef} args={[_geo_xs, _mat_stars, _N_STARS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — mounts the active ring set based on equipped style
// ─────────────────────────────────────────────────────────────────────────────
export function OrbitalRings({ style, scale }: { style: RingStyle; scale: number }) {
  switch (style) {
    // Both fire-themed aura slots use the new radial ember effect. The
    // legacy combustion shell remains available in this module only for
    // backwards-compatible source history, never as equipped gear VFX.
    case "fire_aura":          return <FireAura          scale={scale * 2} />;
    case "eclipse_horizon":   return <ElectrifiedAura  scale={scale} />;
    case "singularity_event": return <SingularityEvent scale={scale} />;
    case "celestial_aegis":   return <FireAura          scale={scale * 2} />;
    case "chronos_clockwork": return <CrystallineAura  scale={scale} />;
    case "void_tendril":      return <VoidTendril      scale={scale} />;
    case "hyper_collider":    return <HyperCollider    scale={scale} />;
    case "solar_corona":      return <SolarCorona      scale={scale} />;
    case "prismatic_lattice": return <PrismaticLattice scale={scale} />;
    case "zero_tesla":        return <ZeroTesla        scale={scale} />;
    case "astral_nebula":     return <AstralNebula     scale={scale} />;
    default:                  return null;
  }
}
