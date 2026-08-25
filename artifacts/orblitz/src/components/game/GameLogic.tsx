import { useRef, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, Projectile, PowerUp, PowerUpType, OrbShape, MovementPattern, ProjectileType } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { gameRuntime } from "@/game-runtime/GameRuntime";

const orbShapes: OrbShape[] = ["sphere", "cube", "tetrahedron", "octahedron", "dodecahedron"];
const allOrbShapes: OrbShape[] = ["sphere", "cube", "tetrahedron", "octahedron", "dodecahedron", "circle", "star", "arrow", "triangle", "trapezoid", "lightning", "tentacle", "monster", "bird"];
const worldOrbShapes: OrbShape[] = ["circle", "star", "triangle", "trapezoid", "cube", "lightning", "arrow", "tentacle", "monster"];
const movementPatterns: MovementPattern[] = ["direct", "zigzag", "spiral", "wave", "orbit"];

const getWorldShape = (worldLevel: number): OrbShape => {
  switch (worldLevel) {
    case 1: return "circle";
    case 2: return "star";
    case 3: return "triangle";
    case 4: return "trapezoid";
    case 5: return "cube";
    case 6: return "lightning";
    case 7: return "arrow";
    case 8: return "tentacle";
    case 9: return "monster";
    default: return "monster";
  }
};

const arcadeLevelColors: Record<number, string> = {
  1: "#00ffff",
  2: "#00ff00",
  3: "#ffff00",
  4: "#ff8800",
  5: "#ff00ff",
  6: "#ff0000",
  7: "#8800ff",
  8: "#0088ff",
};

let orbIdCounter = 0;
let projectileIdCounter = 0;
let powerUpIdCounter = 0;

const sharedRaycaster = new THREE.Raycaster();
const sharedMouse = new THREE.Vector2();
const sharedPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const sharedHitPoint = new THREE.Vector3();

export function GameLogic() {
  const phase                 = useMagicOrb(s => s.phase);
  const gameMode              = useMagicOrb(s => s.gameMode);
  const arcadeLevel           = useMagicOrb(s => s.arcadeLevel);
  const boss                  = useMagicOrb(s => s.boss);
  const addDarkOrb            = useMagicOrb(s => s.addDarkOrb);
  const addProjectile         = useMagicOrb(s => s.addProjectile);
  const addPowerUp            = useMagicOrb(s => s.addPowerUp);
  const spawnRate             = useMagicOrb(s => s.spawnRate);
  const difficultyMultiplier  = useMagicOrb(s => s.difficultyMultiplier);
  const hasChargeBeam         = useMagicOrb(s => s.hasChargeBeam);
  const isDying               = useMagicOrb(s => s.isDying);
  const selectedWeapon        = useMagicOrb(s => s.selectedWeapon);
  const setSelectedWeapon     = useMagicOrb(s => s.setSelectedWeapon);
  const fireOrbaniteBeam      = useMagicOrb(s => s.fireOrbaniteBeam);
  const activateDistortField  = useMagicOrb(s => s.activateDistortField);
  const updateLaserBeams      = useMagicOrb(s => s.updateLaserBeams);
  const laserBeams            = useMagicOrb(s => s.laserBeams);
  const hasDistort            = useMagicOrb(s => s.hasDistort);
  const orbaniteBeamCooldown  = useMagicOrb(s => s.orbaniteBeamCooldown);
  const distortCooldown       = useMagicOrb(s => s.distortCooldown);
  const distortActive         = useMagicOrb(s => s.distortActive);
  
  const { playShoot } = useAudio();
  
  const prevBossRef = useRef<typeof boss>(null);
  useEffect(() => {
    prevBossRef.current = boss;
  }, [boss]);
  
  const { equippedWeapon, equippedDefenses, equippedMagiOrb } = useShop();
  const hasRapidBlaster = equippedWeapon === "orbital_rapid_blaster";
  const hasScattershot = equippedWeapon === "orbital_scattershot";
  const hasSpiralBlaster = equippedWeapon === "spiral_shooter";
  const hasOverchargedBlaster = equippedWeapon === "overcharged_blaster";
  const hasHomingBlaster = equippedWeapon === "homing_launcher";
  const hasSubBlaster = equippedWeapon === "sub_blaster";
  const hasTeletransfer = equippedDefenses.includes("orbital_teletransfer");
  const hasDistortDefense = equippedDefenses.includes("distort_field");
  const hasPulseShield = equippedDefenses.includes("pulse_shield");
  const hasDefenseSystem = equippedDefenses.includes("defense_system");
  const hasSpatialRelocation = equippedDefenses.includes("spatial_relocation");
  const hasRestoration = equippedDefenses.includes("restoration");
  const hasArmor = equippedDefenses.includes("armor");
  
  const hasMagiOrb1 = equippedMagiOrb === "magi_orb_1";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb6 = equippedMagiOrb === "magi_orb_6";
  const hasMagiOrb8 = equippedMagiOrb === "magi_orb_8";
  const hasMagiOrb9 = equippedMagiOrb === "magi_orb_9";
  const teleportPlayer = useMagicOrb((s) => s.teleportPlayer);
  const useTeletransfer = useMagicOrb((s) => s.useTeletransfer);
  const teletransferCooldown = useMagicOrb((s) => s.teletransferCooldown);
  const playerPosition = useMagicOrb((s) => s.playerPosition);
  
  const hasRapidFire = useMagicOrb((s) => s.hasRapidFire);
  const isStaggered = useMagicOrb((s) => s.isStaggered);
  
  const { camera, gl } = useThree();
  const lastOrbSpawn = useRef(0);
  const lastPowerUpSpawn = useRef(0);
  const lastFireTime = useRef(0);
  
  const cameraRef = useRef(camera);
  const addProjectileRef = useRef(addProjectile);
  const hasChargeBeamRef = useRef(hasChargeBeam);
  const phaseRef = useRef(phase);
  const isDyingRef = useRef(isDying);
  const selectedWeaponRef = useRef(selectedWeapon);
  const setSelectedWeaponRef = useRef(setSelectedWeapon);
  const fireOrbaniteBeamRef = useRef(fireOrbaniteBeam);
  const activateDistortFieldRef = useRef(activateDistortField);
  const hasRapidBlasterRef = useRef(hasRapidBlaster);
  const hasScattershotRef = useRef(hasScattershot);
  const hasSpiralBlasterRef = useRef(hasSpiralBlaster);
  const hasOverchargedBlasterRef = useRef(hasOverchargedBlaster);
  const hasHomingBlasterRef = useRef(hasHomingBlaster);
  const hasSubBlasterRef = useRef(hasSubBlaster);
  const hasTeletransferRef = useRef(hasTeletransfer);
  const hasDistortDefenseRef = useRef(hasDistortDefense);
  const hasPulseShieldRef = useRef(hasPulseShield);
  const hasDefenseSystemRef = useRef(hasDefenseSystem);
  const hasSpatialRelocationRef = useRef(hasSpatialRelocation);
  const hasRestorationRef = useRef(hasRestoration);
  const hasArmorRef = useRef(hasArmor);
  const hasMagiOrb1Ref = useRef(hasMagiOrb1);
  const hasMagiOrb5Ref = useRef(hasMagiOrb5);
  const hasMagiOrb6Ref = useRef(hasMagiOrb6);
  const hasMagiOrb8Ref = useRef(hasMagiOrb8);
  const hasMagiOrb9Ref = useRef(hasMagiOrb9);
  const lastSubBlasterFire = useRef(0);
  const lastSpiralFire = useRef(0);
  const lastScattershotFire = useRef(0);
  const lastOverchargedFire = useRef(0);
  const lastHomingFire = useRef(0);
  const triggerRapidBlasterFireRef  = useRef(useMagicOrb.getState().triggerRapidBlasterFire);
  const triggerSpiralBlasterFireRef = useRef(useMagicOrb.getState().triggerSpiralBlasterFire);
  const triggerScatterFireRef       = useRef(useMagicOrb.getState().triggerScatterFire);
  const triggerHomingFireRef        = useRef(useMagicOrb.getState().triggerHomingFire);
  const lastRestorationTick = useRef(0);
  const lastMagiOrb6Teleport = useRef(0);
  const lastMagiOrb8PlayerFire = useRef(0);
  const lastMagiOrb9Reset = useRef(0);
  const magiOrb1Angle = useRef(0);
  const defenseOrbsSpawned = useRef(false);
  const teleportPlayerRef = useRef(teleportPlayer);
  const useTeletransferRef = useRef(useTeletransfer);
  const teletransferCooldownRef = useRef(teletransferCooldown);
  const playerPositionRef = useRef(playerPosition);
  const hasDistortRef = useRef(hasDistort);
  const orbaniteBeamCooldownRef = useRef(orbaniteBeamCooldown);
  const distortCooldownRef = useRef(distortCooldown);
  const distortActiveRef = useRef(distortActive);
  const playShootRef = useRef(playShoot);
  
  const isPointerDown = useRef(false);
  const pointerPosition = useRef({ x: 0, y: 0 });
  
  const hasRapidFireRef = useRef(hasRapidFire);
  hasRapidFireRef.current = hasRapidFire;
  
  cameraRef.current = camera;
  addProjectileRef.current = addProjectile;
  hasChargeBeamRef.current = hasChargeBeam;
  phaseRef.current = phase;
  isDyingRef.current = isDying;
  selectedWeaponRef.current = selectedWeapon;
  setSelectedWeaponRef.current = setSelectedWeapon;
  fireOrbaniteBeamRef.current = fireOrbaniteBeam;
  activateDistortFieldRef.current = activateDistortField;
  hasRapidBlasterRef.current = hasRapidBlaster;
  hasScattershotRef.current = hasScattershot;
  hasSpiralBlasterRef.current = hasSpiralBlaster;
  hasOverchargedBlasterRef.current = hasOverchargedBlaster;
  hasHomingBlasterRef.current = hasHomingBlaster;
  hasSubBlasterRef.current = hasSubBlaster;
  hasTeletransferRef.current = hasTeletransfer;
  hasDistortDefenseRef.current = hasDistortDefense;
  hasPulseShieldRef.current = hasPulseShield;
  hasDefenseSystemRef.current = hasDefenseSystem;
  hasSpatialRelocationRef.current = hasSpatialRelocation;
  hasRestorationRef.current = hasRestoration;
  hasArmorRef.current = hasArmor;
  hasMagiOrb1Ref.current = hasMagiOrb1;
  hasMagiOrb5Ref.current = hasMagiOrb5;
  hasMagiOrb6Ref.current = hasMagiOrb6;
  hasMagiOrb8Ref.current = hasMagiOrb8;
  hasMagiOrb9Ref.current = hasMagiOrb9;
  teleportPlayerRef.current = teleportPlayer;
  useTeletransferRef.current = useTeletransfer;
  teletransferCooldownRef.current = teletransferCooldown;
  playerPositionRef.current = playerPosition;
  hasDistortRef.current = hasDistort;
  orbaniteBeamCooldownRef.current = orbaniteBeamCooldown;
  distortCooldownRef.current = distortCooldown;
  distortActiveRef.current = distortActive;
  playShootRef.current = playShoot;
  
  const getFireInterval = () => {
    let baseInterval: number;
    if (hasRapidBlasterRef.current) {
      baseInterval = 1 / 6;
    } else if (hasSpiralBlasterRef.current) {
      baseInterval = 0.5;
    } else if (hasOverchargedBlasterRef.current) {
      baseInterval = 0.8;
    } else if (hasScattershotRef.current) {
      baseInterval = 0.4;
    } else {
      baseInterval = 0.333;
    }
    return hasRapidFireRef.current ? baseInterval * 0.8 : baseInterval;
  };
  
  const spawnDarkOrb = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 18 + Math.random() * 4;
    
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const z = 0;
    
    const { gameMode: mode, arcadeLevel: level, killSpeedBonus, timeDifficultyBonus } = useMagicOrb.getState();
    
    let shape: OrbShape;
    let pattern: MovementPattern;
    let speed: number;
    
    speed = 1.44 + Math.random() * 0.7;
    
    if (mode === "arcade") {
      const worldLevel = Math.floor(level);
      
      shape = getWorldShape(worldLevel);
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    } else if (mode === "chill") {
      shape = worldOrbShapes[Math.floor(Math.random() * worldOrbShapes.length)];
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    } else if (mode === "survival") {
      shape = worldOrbShapes[Math.floor(Math.random() * worldOrbShapes.length)];
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    } else if (mode === "gauntlet") {
      shape = allOrbShapes[Math.floor(Math.random() * allOrbShapes.length)];
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    } else {
      shape = orbShapes[Math.floor(Math.random() * orbShapes.length)];
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    }
    
    const dirX = -x / distance;
    const dirY = -y / distance;
    
    const orb: DarkOrb = {
      id: `orb-${orbIdCounter++}`,
      position: [x, y, z],
      direction: [dirX, dirY, 0],
      speed,
      size: 0.48 + Math.random() * 0.32,
      seed: Math.random(),
      shape,
      pattern,
      patternPhase: Math.random() * Math.PI * 2,
      frozen: distortActiveRef.current,
    };
    
    addDarkOrb(orb);
  }, [addDarkOrb, difficultyMultiplier]);
  
  const spawnPowerUp = useCallback(() => {
    const availableTypes: PowerUpType[] = ["chargeBeam", "shield", "healing", "doubleCoins", "rapidFire"];
    
    const weights = availableTypes.map(() => 1 / availableTypes.length);
    
    let random = Math.random();
    let type: PowerUpType = availableTypes[0];
    for (let i = 0; i < availableTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        type = availableTypes[i];
        break;
      }
    }
    
    const isTop = Math.random() > 0.5;
    const fromLeft = Math.random() > 0.5;
    
    const y = isTop ? 9 : -9;
    const x = fromLeft ? -18 : 18;
    const z = 0;
    
    const speed = 1.5 + Math.random() * 0.5;
    const vx = fromLeft ? speed : -speed;
    const vy = 0;
    const vz = 0;
    
    const powerUp: PowerUp = {
      id: `powerup-${powerUpIdCounter++}`,
      type,
      position: [x, y, z],
      velocity: [vx, vy, vz],
    };
    
    addPowerUp(powerUp);
  }, [addPowerUp]);
  
  const isStaggeredRef = useRef(isStaggered);
  isStaggeredRef.current = isStaggered;
  
  const fireProjectile = useCallback((clientX: number, clientY: number) => {
    if (phaseRef.current !== "playing" || isDyingRef.current || isStaggeredRef.current) return false;
    
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    sharedMouse.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    
    sharedRaycaster.setFromCamera(sharedMouse, cameraRef.current);
    const intersected = sharedRaycaster.ray.intersectPlane(sharedPlane, sharedHitPoint);
    
    let dirX: number, dirY: number, dirZ: number;
    
    if (intersected) {
      dirX = sharedHitPoint.x;
      dirY = sharedHitPoint.y;
      dirZ = sharedHitPoint.z;
    } else {
      dirX = sharedRaycaster.ray.direction.x;
      dirY = sharedRaycaster.ray.direction.y;
      dirZ = sharedRaycaster.ray.direction.z;
    }
    
    const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    if (len > 0.001) {
      dirX /= len;
      dirY /= len;
      dirZ /= len;
    } else {
      return false;
    }
    
    if (selectedWeaponRef.current === "distort" && hasDistortRef.current && distortCooldownRef.current <= 0) {
      activateDistortFieldRef.current();
      return true;
    }
    
    if (selectedWeaponRef.current === "teletransfer" && hasTeletransferRef.current && teletransferCooldownRef.current <= 0) {
      let teleportX: number, teleportY: number;
      if (intersected) {
        teleportX = sharedHitPoint.x;
        teleportY = sharedHitPoint.y;
      } else {
        const playerPos = playerPositionRef.current;
        teleportX = playerPos[0] + dirX * 5;
        teleportY = playerPos[1] + dirY * 5;
      }
      teleportPlayerRef.current([teleportX, teleportY, 0]);
      useTeletransferRef.current();
      setSelectedWeaponRef.current("normal");
      return true;
    }
    
    const playerPos = playerPositionRef.current;
    const projectileOrigin: [number, number, number] = [playerPos[0], playerPos[1], playerPos[2]];
    
    let targetDirX = dirX;
    let targetDirY = dirY;
    let targetDirZ = dirZ;
    if (intersected) {
      targetDirX = sharedHitPoint.x - playerPos[0];
      targetDirY = sharedHitPoint.y - playerPos[1];
      targetDirZ = sharedHitPoint.z - playerPos[2];
      const targetLen = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY + targetDirZ * targetDirZ);
      if (targetLen > 0.001) {
        targetDirX /= targetLen;
        targetDirY /= targetLen;
        targetDirZ /= targetLen;
      }
    }

    // Admission is decided before creating a weapon's projectiles. Scattershot
    // is atomic: it either emits all three projectiles or leaves its cooldown
    // and presentation state untouched. The other player weapons emit one.
    const requestedProjectileCount = hasScattershotRef.current ? 3 : 1;
    if (!useMagicOrb.getState().canAddProjectiles(requestedProjectileCount)) return false;
    
    if (hasRapidBlasterRef.current) {
      // Spawn at front perimeter of the player orb
      const _rb_offset = 0.75;
      // Apply ±2° directional spread for kinetic spray feel
      const spreadAngle = (Math.random() - 0.5) * (4 * Math.PI / 180);
      const cosS = Math.cos(spreadAngle), sinS = Math.sin(spreadAngle);
      const spreadDirX = targetDirX * cosS - targetDirY * sinS;
      const spreadDirY = targetDirX * sinS + targetDirY * cosS;
      const lenS = Math.sqrt(spreadDirX * spreadDirX + spreadDirY * spreadDirY) || 1;
      const sdx = spreadDirX / lenS, sdy = spreadDirY / lenS;

      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [
          projectileOrigin[0] + sdx * _rb_offset,
          projectileOrigin[1] + sdy * _rb_offset,
          projectileOrigin[2],
        ] as [number, number, number],
        direction: [sdx, sdy, 0],
        isCharged: hasChargeBeamRef.current,
        size: 0.10,
        type: "rapidblaster",
        hitCount: 1,
        speed: 22.0,
      };
      if (!addProjectileRef.current(projectile)) return false;
      useMagicOrb.getState().triggerCameraOnlyShake();
      triggerRapidBlasterFireRef.current(targetDirX, targetDirY);
    } else if (hasScattershotRef.current) {
      const now = Date.now();
      if (now - lastScattershotFire.current < 500) {
        return false;
      }
      const wedgeAngle = Math.PI / 12; // 15°
      const angles = [-wedgeAngle, 0, wedgeAngle];
      const scatterVolleyId = `volley-${now}-scatter`;
      const _sc_offset = 0.75; // spawn at front perimeter

      angles.forEach((angleOffset) => {
        const cosA = Math.cos(angleOffset);
        const sinA = Math.sin(angleOffset);
        const newDirX = targetDirX * cosA - targetDirY * sinA;
        const newDirY = targetDirX * sinA + targetDirY * cosA;
        const lenN = Math.sqrt(newDirX * newDirX + newDirY * newDirY) || 1;
        const ndx = newDirX / lenN, ndy = newDirY / lenN;

        const projectile: Projectile = {
          id: `proj-${projectileIdCounter++}`,
          position: [
            projectileOrigin[0] + ndx * _sc_offset,
            projectileOrigin[1] + ndy * _sc_offset,
            projectileOrigin[2],
          ] as [number, number, number],
          direction: [ndx, ndy, targetDirZ],
          isCharged: hasChargeBeamRef.current,
          size: 0.15,
          type: "scattershot",
          hitCount: 1,
          speed: 20.0,
          volleyId: scatterVolleyId,
        };
        addProjectileRef.current(projectile);
      });

      lastScattershotFire.current = now;
      useMagicOrb.getState().triggerBackgroundShake();
      triggerScatterFireRef.current(targetDirX, targetDirY);
    } else if (hasSpiralBlasterRef.current) {
      const now = Date.now();
      if (now - lastSpiralFire.current < 500) {
        return false;
      }
      // Orbital Spiral Blaster — 3 individually-hittable sub-spheres orbiting a central path
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [...projectileOrigin] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: false,
        size: 0.15,
        type: "spiral",
        hitCount: 3,
        piercing: true,
        noMissTracking: true,
        spiralAngle: 0,
        subSphereAlive: [true, true, true],
      };
      if (!addProjectileRef.current(projectile)) return false;
      lastSpiralFire.current = now;
      useMagicOrb.getState().triggerBackgroundShake();
      triggerSpiralBlasterFireRef.current(targetDirX, targetDirY);
    } else if (hasOverchargedBlasterRef.current) {
      const now = Date.now();
      if (now - lastOverchargedFire.current < 1500) {
        return false;
      }
      // Spawn slightly outside the player orb's front edge
      const _oc_offset = 0.85;
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [
          projectileOrigin[0] + targetDirX * _oc_offset,
          projectileOrigin[1] + targetDirY * _oc_offset,
          projectileOrigin[2] + targetDirZ * _oc_offset,
        ] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: true,
        size: 1.0,
        type: "overcharged",
        piercing: true,
        speed: 5.0,
        spawnScale: 0.05,
        spawnScaleTimer: 0,
        travelTimer: 0,
        volleyId: `volley-${now}-overcharged`,
      };
      if (!addProjectileRef.current(projectile)) return false;
      lastOverchargedFire.current = now;
      // Camera shake + fire signal for squash/recoil in PlayerOrb
      useMagicOrb.getState().triggerBackgroundShake();
      useMagicOrb.getState().triggerOverchargedFire(targetDirX, targetDirY);
    } else if (hasHomingBlasterRef.current) {
      const now = Date.now();
      if (now - lastHomingFire.current < 333) {
        return false;
      }
      const _hm_offset = 0.75;
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [
          projectileOrigin[0] + targetDirX * _hm_offset,
          projectileOrigin[1] + targetDirY * _hm_offset,
          projectileOrigin[2],
        ] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: hasChargeBeamRef.current,
        size: 0.15,
        type: "homing",
        hitCount: 1,
        homing: true,
      };
      if (!addProjectileRef.current(projectile)) return false;
      lastHomingFire.current = now;
      useMagicOrb.getState().triggerBackgroundShake();
      triggerHomingFireRef.current(targetDirX, targetDirY);
    } else {
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [...projectileOrigin] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: hasChargeBeamRef.current,
        size: hasChargeBeamRef.current ? 0.25 : 0.15,
        type: "normal",
        hitCount: 1,
      };
      
      if (!addProjectileRef.current(projectile)) return false;
    }
    
    playShootRef.current();
    return true;
  }, [gl]);
  
  const armorApplied = useRef(false);
  
  useEffect(() => {
    if (phase === "playing" && hasArmorRef.current && !armorApplied.current) {
      armorApplied.current = true;
      const { health, maxHealth } = useMagicOrb.getState();
      const armorBonus = 3;
      useMagicOrb.setState({
        maxHealth: maxHealth + armorBonus,
        health: health + armorBonus,
      });
    }
    if (phase !== "playing" && phase !== "paused") {
      armorApplied.current = false;
      defenseOrbsSpawned.current = false;
    }
    
    if (phase === "playing" && hasDefenseSystemRef.current && !defenseOrbsSpawned.current) {
      defenseOrbsSpawned.current = true;
      useMagicOrb.getState().spawnDefenseOrbs();
    }
  }, [phase]);
  
  useEffect(() => {
    if (phase !== "playing") return;
    
    const isUIElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      const uiSelectors = 'button, .pointer-events-auto, [data-ui], [role="button"], .z-50';
      return target.closest(uiSelectors) !== null;
    };
    
    const stopFiring = () => {
      isPointerDown.current = false;
    };

    let moveFrame: number | null = null;
    let pendingX = 0;
    let pendingY = 0;
    const flushPointerMove = () => {
      moveFrame = null;
      if (isPointerDown.current) {
        // One update per animation frame keeps high-frequency pointer devices
        // from doing work that cannot affect firing any sooner.
        pointerPosition.current.x = pendingX;
        pointerPosition.current.y = pendingY;
      }
    };
    
    const onPointerDown = (e: PointerEvent) => {
      if (isUIElement(e.target)) return;
      e.preventDefault();
      isPointerDown.current = true;
      pointerPosition.current = { x: e.clientX, y: e.clientY };
      if (fireProjectile(e.clientX, e.clientY)) {
        lastFireTime.current = performance.now();
      }
    };
    
    const onPointerMove = (e: PointerEvent) => {
      if (isPointerDown.current) {
        pendingX = e.clientX;
        pendingY = e.clientY;
        if (moveFrame === null) moveFrame = requestAnimationFrame(flushPointerMove);
      }
    };
    
    const onPointerUp = () => {
      stopFiring();
    };
    
    const onBlur = () => {
      stopFiring();
    };
    
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = "none";
    document.addEventListener("pointerdown", onPointerDown, { passive: false });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onBlur);
    
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onBlur);
      if (moveFrame !== null) cancelAnimationFrame(moveFrame);
      document.body.style.touchAction = previousTouchAction;
      isPointerDown.current = false;
    };
  }, [phase, gl, fireProjectile]);
  
  useFrame((state, delta) => {
    if (phaseRef.current !== "playing") return;
    gameRuntime.pipeline.enter("run");
    
    // Single batched timer tick — replaces ~17 individual set() calls
    useMagicOrb.getState().tickGameTimers(delta);
    
    if (isPointerDown.current && !isDying && !isStaggered && selectedWeapon === "normal" && !hasSpiralBlasterRef.current) {
      const now = performance.now();
      const elapsed = (now - lastFireTime.current) / 1000;
      if (elapsed >= getFireInterval()) {
        if (fireProjectile(pointerPosition.current.x, pointerPosition.current.y)) {
          lastFireTime.current = now;
        }
      }
    }
    
    // Sub-blaster drone targeting + firing is handled entirely by SubBlasterOrb.tsx
    
    if (hasRestorationRef.current && !isDying) {
      const { gameTime, health, maxHealth } = useMagicOrb.getState();
      if (gameTime - lastRestorationTick.current >= 10 && health < maxHealth) {
        lastRestorationTick.current = gameTime;
        useMagicOrb.setState({ health: Math.min(health + 1, maxHealth) });
      }
    }
    
    if (hasMagiOrb1Ref.current && !isDying) {
      magiOrb1Angle.current += delta * 1.5;
      const radius = 2.5;
      const newX = Math.cos(magiOrb1Angle.current) * radius;
      const newY = Math.sin(magiOrb1Angle.current) * radius;
      teleportPlayerRef.current([newX, newY, 0]);
    }
    
    if (hasMagiOrb6Ref.current && !isDying) {
      const { gameTime } = useMagicOrb.getState();
      if (gameTime - lastMagiOrb6Teleport.current >= 5) {
        lastMagiOrb6Teleport.current = gameTime;
        const randomX = (Math.random() - 0.5) * 10;
        const randomY = (Math.random() - 0.5) * 6;
        teleportPlayerRef.current([randomX, randomY, 0]);
      }
    }
    
    if (hasMagiOrb8Ref.current && !isDying && lastFireTime.current > lastMagiOrb8PlayerFire.current) {
      const { magiOrb8Position, magiOrb8HP } = useMagicOrb.getState();
      if (magiOrb8Position && magiOrb8HP > 0) {
        const now = performance.now();
        const liveTargets = Array.from(gameRuntime.enemies.byId.values());
        if (liveTargets.length > 0) {
            const closest = liveTargets.reduce((min, orb) => {
              const dist2 = (orb.position[0] - magiOrb8Position[0]) ** 2 + (orb.position[1] - magiOrb8Position[1]) ** 2;
              const minDist2 = (min.position[0] - magiOrb8Position[0]) ** 2 + (min.position[1] - magiOrb8Position[1]) ** 2;
              return dist2 < minDist2 ? orb : min;
            });
            const dirX = closest.position[0] - magiOrb8Position[0];
            const dirY = closest.position[1] - magiOrb8Position[1];
            const len = Math.sqrt(dirX * dirX + dirY * dirY);
            if (len > 0.1) {
              const projectile: Projectile = {
                id: `magi8-proj-${projectileIdCounter++}`,
                position: [...magiOrb8Position] as [number, number, number],
                direction: [dirX / len, dirY / len, 0],
                isCharged: false,
                size: 0.15,
                type: "normal",
                hitCount: 1,
              };
              if (addProjectileRef.current(projectile)) {
                lastMagiOrb8PlayerFire.current = lastFireTime.current;
              }
            }
        } else {
          // Keep the trigger pending until a live target exists.
          lastMagiOrb8PlayerFire.current = lastFireTime.current - 1;
        }
      }
    }
    
    if (hasMagiOrb9Ref.current && !isDying) {
      const { gameTime, killSpawnBonus, timeDifficultyBonus } = useMagicOrb.getState();
      if (gameTime - lastMagiOrb9Reset.current >= 15) {
        lastMagiOrb9Reset.current = gameTime;
        useMagicOrb.setState({
          killSpawnBonus: Math.max(0, killSpawnBonus - 10),
          timeDifficultyBonus: Math.max(0, timeDifficultyBonus - 5),
        });
      }
    }
    
    if (laserBeams.length > 0) {
      const updatedBeams = laserBeams
        .map(b => ({ ...b, timer: b.timer - delta }))
        .filter(b => b.timer > 0);
      updateLaserBeams(updatedBeams);
    }
    
    lastOrbSpawn.current += delta;
    const worldLevel = Math.floor(arcadeLevel);
    const { killSpawnBonus, timeDifficultyBonus, survivalBossPending } = useMagicOrb.getState();
    const spawnBonus = 1 - (killSpawnBonus / 200);
    const timeBonus = 1 - (timeDifficultyBonus / 200);
    const worldSpawnBonus = worldLevel >= 2 ? 1 + ((worldLevel - 1) * 0.05) : 1;
    const arcadeSpawnRate = gameMode === "arcade" ? Math.max(0.3, (spawnRate / worldSpawnBonus) * Math.max(0.2, spawnBonus * timeBonus)) : spawnRate;
    const { gameTime, gauntletOrbsDestroyed } = useMagicOrb.getState();
    const gauntletSpawnRate = Math.max(0.4, 2.5 - (gameTime * 0.02) - (gauntletOrbsDestroyed * 0.01));
    const effectiveSpawnRate = gameMode === "chill" ? spawnRate * 0.4 : (gameMode === "gauntlet" ? gauntletSpawnRate : arcadeSpawnRate);
    const isBossLevel = boss !== null;
    const { bossDefeating } = useMagicOrb.getState();
    
    if (lastOrbSpawn.current >= effectiveSpawnRate && !isDying && !isBossLevel && !bossDefeating && !survivalBossPending) {
      lastOrbSpawn.current = 0;
      spawnDarkOrb();
      
      if (gameMode === "survival") {
        if (difficultyMultiplier > 1.5 && Math.random() < 0.3) {
          spawnDarkOrb();
        }
        if (difficultyMultiplier > 2.5 && Math.random() < 0.3) {
          spawnDarkOrb();
        }
      } else if (gameMode === "arcade") {
        const subLevel = Math.round((arcadeLevel % 1) * 10);
        if (subLevel >= 5 && Math.random() < 0.35) {
          spawnDarkOrb();
        }
        if (worldLevel >= 2 && Math.random() < 0.25) {
          spawnDarkOrb();
        }
      } else if (gameMode === "chill") {
        spawnDarkOrb();
        if (Math.random() < 0.5) {
          spawnDarkOrb();
        }
      } else if (gameMode === "gauntlet") {
        if (gameTime > 30 && Math.random() < 0.3) {
          spawnDarkOrb();
        }
        if (gameTime > 60 && Math.random() < 0.3) {
          spawnDarkOrb();
        }
      }
    }
    
    lastPowerUpSpawn.current += delta;
    if (lastPowerUpSpawn.current >= 18 + Math.random() * 12 && !isDying) {
      lastPowerUpSpawn.current = 0;
      spawnPowerUp();
    }
  });
  
  return null;
}
