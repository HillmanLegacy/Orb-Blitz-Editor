import { useRef, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, Projectile, PowerUp, PowerUpType, OrbShape, MovementPattern, ProjectileType } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

const orbShapes: OrbShape[] = ["sphere", "cube", "tetrahedron", "octahedron", "dodecahedron"];
const allOrbShapes: OrbShape[] = ["sphere", "cube", "tetrahedron", "octahedron", "dodecahedron", "circle", "star", "arrow", "triangle", "trapezoid", "lightning", "tentacle", "monster", "bird"];
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
  const { 
    phase,
    gameMode,
    arcadeLevel,
    boss,
    addDarkOrb,
    addProjectile,
    addPowerUp,
    updateGameTime,
    updateDifficulty,
    updateChargeBeamTimer,
    updateDamageTimer,
    updateDeathTimer,
    updateOrbaniteBeamCooldown,
    updateDistortCooldown,
    updateDistortTimer,
    updateTeletransferCooldown,
    spawnRate,
    difficultyMultiplier,
    hasChargeBeam,
    isDying,
    selectedWeapon,
    setSelectedWeapon,
    fireOrbaniteBeam,
    activateDistortField,
    updateLaserBeams,
    laserBeams,
    hasDistort,
    orbaniteBeamCooldown,
    distortCooldown,
    distortActive,
  } = useMagicOrb();
  
  const { playShoot, startBossMusic, startGameMusic } = useAudio();
  
  const prevBossRef = useRef<typeof boss>(null);
  
  useEffect(() => {
    if (phase === "playing") {
      if (boss !== null && prevBossRef.current === null) {
        startBossMusic();
      }
    }
    prevBossRef.current = boss;
  }, [boss, phase, startBossMusic]);
  
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
  const updateDoubleCoinsTimer = useMagicOrb((s) => s.updateDoubleCoinsTimer);
  const updateRapidFireTimer = useMagicOrb((s) => s.updateRapidFireTimer);
  const updateStaggerTimer = useMagicOrb((s) => s.updateStaggerTimer);
  const updateTimeDifficulty = useMagicOrb((s) => s.updateTimeDifficulty);
  const updateSurvivalBossTimer = useMagicOrb((s) => s.updateSurvivalBossTimer);
  
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
  const lastRestorationTick = useRef(0);
  const lastMagiOrb6Teleport = useRef(0);
  const lastMagiOrb8Fire = useRef(0);
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
      baseInterval = 3.0;
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
    const distance = 12 + Math.random() * 3;
    
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
      shape = orbShapes[Math.floor(Math.random() * orbShapes.length)];
      pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
    } else if (mode === "survival" || mode === "gauntlet") {
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
      size: 0.3 + Math.random() * 0.2,
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
    
    const y = isTop ? 5 : -5;
    const x = fromLeft ? -12 : 12;
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
    if (phaseRef.current !== "playing" || isDyingRef.current || isStaggeredRef.current) return;
    
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
      return;
    }
    
    if (selectedWeaponRef.current === "distort" && hasDistortRef.current && distortCooldownRef.current <= 0) {
      activateDistortFieldRef.current();
      return;
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
      return;
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
    
    if (hasScattershotRef.current) {
      const now = Date.now();
      if (now - lastScattershotFire.current < 500) {
        return;
      }
      lastScattershotFire.current = now;
      
      const wedgeAngle = Math.PI / 12;
      const angles = [-wedgeAngle, 0, wedgeAngle];
      const scatterVolleyId = `volley-${now}-scatter`;
      
      angles.forEach((angleOffset) => {
        const cosA = Math.cos(angleOffset);
        const sinA = Math.sin(angleOffset);
        const newDirX = targetDirX * cosA - targetDirY * sinA;
        const newDirY = targetDirX * sinA + targetDirY * cosA;
        
        const projectile: Projectile = {
          id: `proj-${projectileIdCounter++}`,
          position: [...projectileOrigin] as [number, number, number],
          direction: [newDirX, newDirY, targetDirZ],
          isCharged: hasChargeBeamRef.current,
          size: 0.15,
          type: "scattershot",
          hitCount: 1,
          volleyId: scatterVolleyId,
        };
        addProjectileRef.current(projectile);
      });
    } else if (hasSpiralBlasterRef.current) {
      const now = Date.now();
      if (now - lastSpiralFire.current < 500) {
        return;
      }
      lastSpiralFire.current = now;
      
      const spiralVolleyId = `volley-${now}-spiral`;
      for (let i = 0; i < 3; i++) {
        const spiralAngle = (i / 3) * Math.PI * 2;
        const projectile: Projectile = {
          id: `proj-${projectileIdCounter++}`,
          position: [...projectileOrigin] as [number, number, number],
          direction: [Math.cos(spiralAngle), Math.sin(spiralAngle), 0],
          isCharged: false,
          size: 0.15,
          type: "spiral",
          hitCount: 1,
          piercing: false,
          spiralAngle,
          volleyId: spiralVolleyId,
          createdAt: now,
        };
        addProjectileRef.current(projectile);
      }
    } else if (hasOverchargedBlasterRef.current) {
      const now = Date.now();
      if (now - lastOverchargedFire.current < 500) {
        return;
      }
      lastOverchargedFire.current = now;
      
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [...projectileOrigin] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: true,
        size: 0.4,
        type: "overcharged",
        hitCount: 3,
        piercing: true,
        volleyId: `volley-${now}-overcharged`,
      };
      addProjectileRef.current(projectile);
    } else if (hasHomingBlasterRef.current) {
      const now = Date.now();
      if (now - lastHomingFire.current < 333) {
        return;
      }
      lastHomingFire.current = now;
      
      const projectile: Projectile = {
        id: `proj-${projectileIdCounter++}`,
        position: [...projectileOrigin] as [number, number, number],
        direction: [targetDirX, targetDirY, targetDirZ],
        isCharged: hasChargeBeamRef.current,
        size: 0.15,
        type: "homing",
        hitCount: 1,
        homing: true,
      };
      addProjectileRef.current(projectile);
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
      
      addProjectileRef.current(projectile);
    }
    
    playShootRef.current();
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
    if (phase === "menu") {
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
    
    const onPointerDown = (e: PointerEvent) => {
      if (isUIElement(e.target)) return;
      e.preventDefault();
      isPointerDown.current = true;
      pointerPosition.current = { x: e.clientX, y: e.clientY };
      fireProjectile(e.clientX, e.clientY);
      lastFireTime.current = performance.now();
    };
    
    const onPointerMove = (e: PointerEvent) => {
      if (isPointerDown.current) {
        // Mutate in-place — avoids one { x, y } object allocation per pointer event
        pointerPosition.current.x = e.clientX;
        pointerPosition.current.y = e.clientY;
      }
    };
    
    const onPointerUp = () => {
      stopFiring();
    };
    
    const onBlur = () => {
      stopFiring();
    };
    
    document.body.style.touchAction = "none";
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onBlur);
    
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onBlur);
      isPointerDown.current = false;
    };
  }, [phase, gl, fireProjectile]);
  
  useFrame((state, delta) => {
    if (phaseRef.current !== "playing") return;
    
    updateGameTime(delta);
    if (gameMode === "survival") {
      updateDifficulty();
      updateSurvivalBossTimer(delta);
    }
    updateChargeBeamTimer(delta);
    updateDamageTimer(delta);
    updateDeathTimer(delta);
    updateOrbaniteBeamCooldown(delta);
    updateDistortCooldown(delta);
    updateDistortTimer(delta);
    updateTeletransferCooldown(delta);
    
    const updatePulseShieldCooldown = useMagicOrb.getState().updatePulseShieldCooldown;
    const updateSpatialRelocationCooldown = useMagicOrb.getState().updateSpatialRelocationCooldown;
    updatePulseShieldCooldown(delta);
    updateSpatialRelocationCooldown(delta);
    
    updateDoubleCoinsTimer(delta);
    updateRapidFireTimer(delta);
    updateStaggerTimer(delta);
    updateTimeDifficulty();
    
    if (isPointerDown.current && !isDying && !isStaggered && selectedWeapon === "normal" && !hasSpiralBlasterRef.current) {
      const now = performance.now();
      const elapsed = (now - lastFireTime.current) / 1000;
      if (elapsed >= getFireInterval()) {
        fireProjectile(pointerPosition.current.x, pointerPosition.current.y);
        lastFireTime.current = now;
      }
    }
    
    if (hasSubBlasterRef.current && !isDying) {
      const now = performance.now();
      const elapsed = (now - lastSubBlasterFire.current) / 1000;
      if (elapsed >= 1.0) {
        lastSubBlasterFire.current = now;
        const { darkOrbs } = useMagicOrb.getState();
        const onScreenOrbs = darkOrbs.filter(orb => 
          orb.position && 
          Math.abs(orb.position[0]) < 10 && 
          Math.abs(orb.position[1]) < 6 &&
          !orb.destroying
        );
        if (onScreenOrbs.length > 0) {
          const playerPos = playerPositionRef.current;
          const closest = onScreenOrbs.reduce((min, orb) => {
            const dist = Math.sqrt((orb.position[0] - playerPos[0]) ** 2 + (orb.position[1] - playerPos[1]) ** 2);
            const minDist = Math.sqrt((min.position[0] - playerPos[0]) ** 2 + (min.position[1] - playerPos[1]) ** 2);
            return dist < minDist ? orb : min;
          });
          const dirX = closest.position[0] - playerPos[0];
          const dirY = closest.position[1] - playerPos[1];
          const len = Math.sqrt(dirX * dirX + dirY * dirY);
          if (len > 0.1) {
            const projectile: Projectile = {
              id: `proj-${projectileIdCounter++}`,
              position: [playerPos[0] + 0.8, playerPos[1], 0],
              direction: [dirX / len, dirY / len, 0],
              isCharged: false,
              size: 0.12,
              type: "subblaster",
              hitCount: 1,
            };
            addProjectileRef.current(projectile);
          }
        }
      }
    }
    
    if (hasRestorationRef.current && !isDying) {
      const { gameTime, health, maxHealth } = useMagicOrb.getState();
      if (gameTime - lastRestorationTick.current >= 10 && health < maxHealth) {
        lastRestorationTick.current = gameTime;
        useMagicOrb.setState({ health: Math.min(health + 1, maxHealth) });
      }
    }
    
    const updateMagiOrbTimers = useMagicOrb.getState().updateMagiOrbTimers;
    updateMagiOrbTimers(delta);
    
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
    
    if (hasMagiOrb8Ref.current && !isDying) {
      const { magiOrb8Position, magiOrb8HP } = useMagicOrb.getState();
      if (magiOrb8Position && magiOrb8HP > 0) {
        const now = performance.now();
        const elapsed = (now - lastMagiOrb8Fire.current) / 1000;
        if (elapsed >= 0.5) {
          lastMagiOrb8Fire.current = now;
          const { darkOrbs } = useMagicOrb.getState();
          const onScreenOrbs = darkOrbs.filter(orb => 
            orb.position && 
            Math.abs(orb.position[0]) < 10 && 
            Math.abs(orb.position[1]) < 6 &&
            !orb.destroying
          );
          if (onScreenOrbs.length > 0) {
            const closest = onScreenOrbs.reduce((min, orb) => {
              const dist = Math.sqrt((orb.position[0] - magiOrb8Position[0]) ** 2 + (orb.position[1] - magiOrb8Position[1]) ** 2);
              const minDist = Math.sqrt((min.position[0] - magiOrb8Position[0]) ** 2 + (min.position[1] - magiOrb8Position[1]) ** 2);
              return dist < minDist ? orb : min;
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
              addProjectileRef.current(projectile);
            }
          }
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
    
    if (lastOrbSpawn.current >= effectiveSpawnRate && !isDying && !isBossLevel && !survivalBossPending) {
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
