import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useMagicOrb } from "./useMagicOrb";
import {
  applyWeaponXp,
  createInitialWeaponProgression,
  getWeaponLevelUpChanges,
  WEAPON_DISPLAY_NAMES,
  isProgressionWeapon,
  normalizeWeaponProgression,
  type WeaponProgressionState,
  type WeaponLevelUpResult,
} from "@/game-runtime/WeaponProgression";
import type { GameplayResultSnapshot } from "@/game-runtime/GameplayGrades";
import {
  applyTrophyResult,
  createInitialTrophyProgression,
  normalizeTrophyProgression,
  type TrophyId,
  type TrophyProgressionState,
  type TrophyUnlock,
} from "@/game-runtime/TrophyProgression";

export type OrbSkin = "default" | "fire" | "star" | "crystal" | "toxic" | "plasma" | "diamond" | "rainbow" | "mecha" | "monster";
export const BOSS_SKIN_TYPES: readonly Exclude<OrbSkin, "default">[] = [
  "fire", "star", "crystal", "toxic", "plasma", "diamond", "rainbow", "mecha", "monster",
];
export type TrailEffect = "none" | "sparkle" | "fire" | "ice" | "cosmic" | "lightning" | "rainbow" | "plasma" | "shadow" | "stardust" | "meteor" | "spirit" | "neon" | "sakura" | "galaxy" | "particle_swarm" | "flame_aura";
export type RingStyle = "default" | "none" | "eclipse_horizon" | "singularity_event" | "celestial_aegis" | "chronos_clockwork" | "void_tendril" | "hyper_collider" | "solar_corona" | "prismatic_lattice" | "zero_tesla" | "astral_nebula";
export type WeaponType = "none" | "orbital_rapid_blaster" | "orbital_scattershot" | "spiral_shooter" | "overcharged_blaster" | "homing_launcher" | "sub_blaster";
export type DefenseType = "none" | "orbital_teletransfer" | "distort_field" | "pulse_shield" | "defense_system" | "spatial_relocation" | "restoration" | "armor";
export type MagiOrbType = "none" | "magi_orb_1" | "magi_orb_2" | "magi_orb_3" | "magi_orb_4" | "magi_orb_5" | "magi_orb_6" | "magi_orb_7" | "magi_orb_8" | "magi_orb_9";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "skin" | "trail" | "aura" | "weapon" | "defense" | "magi_orb";
  value: OrbSkin | TrailEffect | RingStyle | WeaponType | DefenseType | MagiOrbType;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "skin_fire", name: "Fire Boss Skin", description: "The blazing core of the Fire Boss", price: 1000, category: "skin", value: "fire" },
  { id: "skin_star", name: "Star Boss Skin", description: "The radiant gold of the Star Boss", price: 1000, category: "skin", value: "star" },
  { id: "skin_crystal", name: "Crystal Boss Skin", description: "The luminous crystal energy of the Crystal Boss", price: 1000, category: "skin", value: "crystal" },
  { id: "skin_toxic", name: "Toxic Boss Skin", description: "The radioactive green glow of the Toxic Boss", price: 1000, category: "skin", value: "toxic" },
  { id: "skin_plasma", name: "Plasma Boss Skin", description: "The blue-violet plasma of the Plasma Boss", price: 1000, category: "skin", value: "plasma" },
  { id: "skin_diamond", name: "Diamond Boss Skin", description: "The prismatic brilliance of the Diamond Boss", price: 1000, category: "skin", value: "diamond" },
  { id: "skin_rainbow", name: "Rainbow Boss Skin", description: "The shifting spectrum of the Rainbow Boss", price: 1000, category: "skin", value: "rainbow" },
  { id: "skin_mecha", name: "Mecha Boss Skin", description: "The charged steel of the Mecha Boss", price: 1000, category: "skin", value: "mecha" },
  { id: "skin_monster", name: "Monster Boss Skin", description: "The deep void energy of the Monster Boss", price: 1000, category: "skin", value: "monster" },
  
  { id: "trail_sparkle", name: "Sparkle Trail", description: "Leaves sparkling star particles", price: 300, category: "trail", value: "sparkle" },
  { id: "trail_fire", name: "Fire Trail", description: "Blazing fire with ember particles", price: 300, category: "trail", value: "fire" },
  { id: "trail_ice", name: "Ice Trail", description: "Frozen crystal particles with snowflakes", price: 300, category: "trail", value: "ice" },
  { id: "trail_cosmic", name: "Cosmic Trail", description: "Stardust particles with mini galaxies", price: 300, category: "trail", value: "cosmic" },
  { id: "trail_lightning", name: "Lightning Trail", description: "Electric bolts crackling behind", price: 300, category: "trail", value: "lightning" },
  { id: "trail_rainbow", name: "Rainbow Trail", description: "Multicolor ribbon with sparkles", price: 300, category: "trail", value: "rainbow" },
  { id: "trail_plasma", name: "Plasma Trail", description: "Unstable energy with distortion", price: 300, category: "trail", value: "plasma" },
  { id: "trail_shadow", name: "Shadow Trail", description: "Dark smoke wisps following", price: 300, category: "trail", value: "shadow" },
  { id: "trail_stardust", name: "Stardust Trail", description: "Twinkling stars scattered behind", price: 300, category: "trail", value: "stardust" },
  { id: "trail_meteor", name: "Meteor Trail", description: "Burning meteor fragments", price: 300, category: "trail", value: "meteor" },
  { id: "trail_spirit", name: "Spirit Trail", description: "Ghostly wisps with ethereal glow", price: 300, category: "trail", value: "spirit" },
  { id: "trail_neon", name: "Neon Trail", description: "Bright neon streaks with glow", price: 300, category: "trail", value: "neon" },
  { id: "trail_sakura", name: "Sakura Trail", description: "Cherry blossom petals floating", price: 300, category: "trail", value: "sakura" },
  { id: "trail_galaxy", name: "Galaxy Trail", description: "Miniature cosmos in your wake", price: 300, category: "trail", value: "galaxy" },
  { id: "trail_particle_swarm", name: "Particle Swarm", description: "A living swarm of energy particles orbits your projectile", price: 600, category: "trail", value: "particle_swarm" },
  { id: "trail_flame_aura", name: "Flame Aura", description: "Upward-flowing fire embers surround your orb. Awarded for defeating the Fire Boss.", price: 4000, category: "trail", value: "flame_aura" },
  
  { id: "ring_eclipse_horizon",   name: "Electrified Aura",      description: "High-voltage Tesla field — Fresnel plasma shell, 40 crackling arc lines, and 200 ionic sparks that burst on impact", price: 700, category: "aura", value: "eclipse_horizon"   },
  { id: "ring_singularity_event", name: "Singularity Event",     description: "Gravitational accretion disk — black event horizon with violent orange/violet eddies", price: 500, category: "aura", value: "singularity_event" },
  { id: "ring_celestial_aegis",   name: "Fiery Aura",            description: "Roaring combustion shell: GLSL displacement flames, 380 GPU particles, ember sparks, heat-haze sphere and flickering fire light", price: 400, category: "aura", value: "celestial_aegis"   },
  { id: "ring_chronos_clockwork", name: "Crystalline Aura",      description: "Dual refractive GLSL crystal shells with chromatic IOR dispersion, dual-Voronoi caustic rays, 200-particle glint dust and 12 orbiting prismatic shards", price: 450, category: "aura", value: "chronos_clockwork" },
  { id: "ring_void_tendril",      name: "Void Tendril Vortex",   description: "Pure dark-matter fluid — 80 swirling indigo and magenta particles, no solid geometry", price: 500, category: "aura", value: "void_tendril"      },
  { id: "ring_hyper_collider",    name: "Hyper-Tech Collider",   description: "Particle accelerator with twin plasma beams orbiting at extreme speed inside a housing ring", price: 500, category: "aura", value: "hyper_collider"    },
  { id: "ring_solar_corona",      name: "Solar Flare Corona",    description: "Shader-displaced torus with solar prominences, bubbling surface, and burning ember halo", price: 600, category: "aura", value: "solar_corona"      },
  { id: "ring_prismatic_lattice", name: "Prismatic Lattice",     description: "12 crystal cone shards bob in a rainbow-caustic halo with individual sine wave motion",  price: 500, category: "aura", value: "prismatic_lattice" },
  { id: "ring_zero_tesla",        name: "Zero-Point Tesla",      description: "Twin copper conductor rings surrounded by 12 persistent arc lightning branches",         price: 600, category: "aura", value: "zero_tesla"        },
  { id: "ring_astral_nebula",     name: "Astral Nebula Ring",    description: "200 twinkling stardust points orbit in magenta, teal, and gold like a miniature galaxy", price: 600, category: "aura", value: "astral_nebula"     },
  
  { id: "weapon_orbital_rapid_blaster", name: "Orbital Rapid Blaster", description: "Fires 6 shots per second. Each projectile destroys 1 enemy.", price: 2000, category: "weapon", value: "orbital_rapid_blaster" },
  { id: "weapon_orbital_scattershot", name: "Orbital Scattershot", description: "Fires 3 projectiles in a wedge pattern. Each destroys 1 enemy.", price: 2000, category: "weapon", value: "orbital_scattershot" },
  { id: "weapon_spiral_shooter", name: "Orbital Spiral Blaster", description: "Fires 3 intertwined swirling particles toward the target. Pierces through up to 3 enemies, losing one particle per hit.", price: 2000, category: "weapon", value: "spiral_shooter" },
  { id: "weapon_overcharged_blaster", name: "Orbital Overcharged Blaster", description: "Fires one massive slow projectile every 1.5s that destroys all enemies and boss projectiles in its path. Deals 5 damage to bosses.", price: 2000, category: "weapon", value: "overcharged_blaster" },
  { id: "weapon_homing_launcher", name: "Orbital Homing Blaster", description: "Fires homing projectiles that track the nearest enemy.", price: 2000, category: "weapon", value: "homing_launcher" },
  { id: "weapon_sub_blaster", name: "Orbital Autonomous Sub Blaster", description: "A small orb orbits you and auto-fires at nearby enemies.", price: 2000, category: "weapon", value: "sub_blaster" },
  
  { id: "defense_orbital_teletransfer", name: "Orbital Teletransfer", description: "Teleport to any location by tapping (5s cooldown)", price: 2000, category: "defense", value: "orbital_teletransfer" },
  { id: "defense_distort_field", name: "Orbital Distortion Field", description: "Stops incoming enemies within range for 5 seconds (5s cooldown)", price: 2000, category: "defense", value: "distort_field" },
  { id: "defense_pulse_shield", name: "Orbital Pulse Shield", description: "Close-range pulse that reflects incoming enemies (5s cooldown)", price: 2000, category: "defense", value: "pulse_shield" },
  { id: "defense_defense_system", name: "Orbital Defense System", description: "Five perishable orbs that circle and collide with enemies", price: 2000, category: "defense", value: "defense_system" },
  { id: "defense_spatial_relocation", name: "Orbital Spatial Relocation", description: "Teleports player to a nearby location when taking damage", price: 2000, category: "defense", value: "spatial_relocation" },
  { id: "defense_restoration", name: "Orbital Restoration System", description: "Recovers 1 HP every 10 seconds", price: 2000, category: "defense", value: "restoration" },
  { id: "defense_armor", name: "Orbital Armor", description: "Adds +3 maximum HP", price: 2000, category: "defense", value: "armor" },
  
  { id: "magi_orb_1", name: "Magi-Orb I", description: "Player constantly moves in a circular pattern to evade enemies", price: 3000, category: "magi_orb", value: "magi_orb_1" },
  { id: "magi_orb_2", name: "Magi-Orb II", description: "Arcane Annihilator — obliterates all non-boss enemies on screen and siphons their energy to you (15s cooldown)", price: 3000, category: "magi_orb", value: "magi_orb_2" },
  { id: "magi_orb_3", name: "Magi-Orb III", description: "Fires 10 indirect homing projectiles when activated", price: 3000, category: "magi_orb", value: "magi_orb_3" },
  { id: "magi_orb_4", name: "Magi-Orb IV", description: "Quarter-circle barrier destroys enemies on contact for 10s (15s cooldown)", price: 3000, category: "magi_orb", value: "magi_orb_4" },
  { id: "magi_orb_5", name: "Magi-Orb V", description: "Protective cube with 5 HP that must be destroyed before player takes damage", price: 3000, category: "magi_orb", value: "magi_orb_5" },
  { id: "magi_orb_6", name: "Magi-Orb VI", description: "Randomly teleports player to another location every 5 seconds", price: 3000, category: "magi_orb", value: "magi_orb_6" },
  { id: "magi_orb_7", name: "Magi-Orb VII", description: "360-degree pulse slows all enemies to 25% speed (15s cooldown)", price: 3000, category: "magi_orb", value: "magi_orb_7" },
  { id: "magi_orb_8", name: "Magi-Orb VIII", description: "Allied orb with player's max HP placed randomly, fires when player fires", price: 3000, category: "magi_orb", value: "magi_orb_8" },
  { id: "magi_orb_9", name: "Magi-Orb IX", description: "Resets enemy spawn frequency every 15 seconds", price: 3000, category: "magi_orb", value: "magi_orb_9" },
];

interface ShopState {
  coins: number;
  ownedItems: string[];
  equippedSkin: OrbSkin;
  equippedTrail: TrailEffect;
  equippedRing: RingStyle;
  equippedWeapon: WeaponType;
  weaponProgression: WeaponProgressionState;
  trophyProgression: TrophyProgressionState;
  equippedDefenses: [DefenseType, DefenseType];
  equippedMagiOrb: MagiOrbType;
  shopOpen: boolean;
  inventoryOpen: boolean;
  trophiesOpen: boolean;
  
  devMode: boolean;
  addCoins: (amount: number) => void;
  purchaseItem: (itemId: string) => boolean;
  activateDevMode: () => void;
  equipSkin: (skin: OrbSkin) => void;
  equipTrail: (trail: TrailEffect) => void;
  equipRing: (ring: RingStyle) => void;
  equipWeapon: (weapon: WeaponType) => void;
  addWeaponXp: (weapon: WeaponType, amount: number) => WeaponLevelUpResult | null;
  recordTrophyResult: (result: GameplayResultSnapshot) => TrophyUnlock[];
  setSelectedTitle: (trophyId: TrophyId | null) => void;
  equipDefense: (defense: DefenseType, slot: 0 | 1) => void;
  equipMagiOrb: (magiOrb: MagiOrbType) => void;
  openShop: () => void;
  closeShop: () => void;
  openInventory: () => void;
  closeInventory: () => void;
  openTrophies: () => void;
  closeTrophies: () => void;
  isOwned: (itemId: string) => boolean;
  canAfford: (price: number) => boolean;
}

interface StoredShopData {
  coins: number;
  ownedItems: string[];
  equippedSkin: OrbSkin;
  equippedTrail: TrailEffect;
  equippedRing: RingStyle;
  equippedWeapon: WeaponType;
  weaponProgression?: unknown;
  trophyProgression?: unknown;
  equippedDefenses: [DefenseType, DefenseType];
  equippedMagiOrb: MagiOrbType;
  devMode?: boolean;
}

const saveShopData = (data: StoredShopData) => {
  try {
    localStorage.setItem("orblitz_shop", JSON.stringify(data));
  } catch {}
};

const getStoredShopData = (): StoredShopData => {
  try {
    const stored = localStorage.getItem("orblitz_shop");
    if (stored) {
      const data = JSON.parse(stored);
      // devMode field handled at end
      let ownedItems = data.ownedItems ?? [];
      let needsSave = false;
      if (ownedItems.includes("weapon_orbital_laser") && !ownedItems.includes("weapon_orbital_rapid_blaster")) {
        ownedItems = ownedItems.map((item: string) => 
          item === "weapon_orbital_laser" ? "weapon_orbital_rapid_blaster" : item
        );
        needsSave = true;
      }
      if (ownedItems.includes("weapon_orbital_teletransfer") && !ownedItems.includes("defense_orbital_teletransfer")) {
        ownedItems = ownedItems.map((item: string) => 
          item === "weapon_orbital_teletransfer" ? "defense_orbital_teletransfer" : item
        );
        needsSave = true;
      }
      const equippedWeapon = data.equippedWeapon === "orbital_laser" ? "orbital_rapid_blaster" : (data.equippedWeapon ?? "none");
      if (data.equippedWeapon === "orbital_laser") needsSave = true;
      
      let equippedDefenses = data.equippedDefenses ?? ["none", "none"];
      if (data.equippedWeapon === "orbital_teletransfer") {
        equippedDefenses = ["orbital_teletransfer", equippedDefenses[1] === "orbital_teletransfer" ? "none" : equippedDefenses[1]];
        needsSave = true;
      }
      
      // ── Ring migration: old ring values → "none" + strip legacy owned IDs ──
      const _validRings = new Set(["none","default","eclipse_horizon","singularity_event","celestial_aegis","chronos_clockwork","void_tendril","hyper_collider","solar_corona","prismatic_lattice","zero_tesla","astral_nebula"]);
      const _legacyRingIds = new Set(["ring_double","ring_triple","ring_spiral","ring_none","ring_pulse","ring_orbit","ring_halo","ring_shield","ring_hex","ring_prism"]);
      const hadLegacyRings = ownedItems.some((id: string) => _legacyRingIds.has(id));
      if (hadLegacyRings) {
        ownedItems = ownedItems.filter((id: string) => !_legacyRingIds.has(id));
        needsSave = true;
      }
      const equippedRing = _validRings.has(data.equippedRing) ? data.equippedRing : "none";
      if (!_validRings.has(data.equippedRing)) needsSave = true;

       const validSkinValues = new Set<OrbSkin>(["default", ...BOSS_SKIN_TYPES]);
       const retiredSkinIds = new Set([
         "skin_golden", "skin_neon", "skin_rainbow", "skin_crystal", "skin_void",
         "skin_plasma", "skin_galaxy", "skin_phoenix", "skin_shadow", "skin_aurora",
         "skin_diamond", "skin_inferno", "skin_frost", "skin_toxic", "skin_electric",
       ]);
       const migratedOwnedItems = ownedItems.filter((id: string) => !retiredSkinIds.has(id));
       if (migratedOwnedItems.length !== ownedItems.length) {
         ownedItems = migratedOwnedItems;
         needsSave = true;
       }
       const equippedSkin = validSkinValues.has(data.equippedSkin)
         ? data.equippedSkin
         : "default";
       if (equippedSkin !== data.equippedSkin) needsSave = true;

       const result: StoredShopData = {
        coins: data.coins ?? 0,
        ownedItems,
         equippedSkin,
        equippedTrail: data.equippedTrail ?? "none",
        equippedRing,
        equippedWeapon: equippedWeapon === "orbital_teletransfer" ? "none" as WeaponType : equippedWeapon,
         weaponProgression: normalizeWeaponProgression(data.weaponProgression),
         trophyProgression: normalizeTrophyProgression(data.trophyProgression),
        equippedDefenses: equippedDefenses as [DefenseType, DefenseType],
        equippedMagiOrb: data.equippedMagiOrb ?? "none",
        devMode: data.devMode ?? false,
      };
      if (needsSave) saveShopData(result);
      return result;
    }
  } catch {}
  return {
    coins: 0,
    ownedItems: [],
    equippedSkin: "default",
    equippedTrail: "none",
    equippedRing: "none",
    equippedWeapon: "none",
     weaponProgression: createInitialWeaponProgression(),
     trophyProgression: createInitialTrophyProgression(),
    equippedDefenses: ["none", "none"],
    equippedMagiOrb: "none",
    devMode: false,
  };
};

const storedData = getStoredShopData();

const createSaveData = (state: ShopState): StoredShopData => ({
  coins: state.coins,
  ownedItems: state.ownedItems,
  equippedSkin: state.equippedSkin,
  equippedTrail: state.equippedTrail,
  equippedRing: state.equippedRing,
  equippedWeapon: state.equippedWeapon,
  weaponProgression: state.weaponProgression,
  trophyProgression: state.trophyProgression,
  equippedDefenses: state.equippedDefenses,
  equippedMagiOrb: state.equippedMagiOrb,
  devMode: state.devMode,
});

export const useShop = create<ShopState>()(
  subscribeWithSelector((set, get) => ({
    devMode: storedData.devMode ?? false,
    coins: storedData.coins,
    ownedItems: storedData.ownedItems,
    equippedSkin: storedData.equippedSkin,
    equippedTrail: storedData.equippedTrail,
    equippedRing: storedData.equippedRing,
    equippedWeapon: storedData.equippedWeapon,
    weaponProgression: normalizeWeaponProgression(storedData.weaponProgression),
    trophyProgression: normalizeTrophyProgression(storedData.trophyProgression),
    equippedDefenses: storedData.equippedDefenses as [DefenseType, DefenseType],
    equippedMagiOrb: storedData.equippedMagiOrb as MagiOrbType,
    shopOpen: false,
    inventoryOpen: false,
    trophiesOpen: false,

    activateDevMode: () => {
      const allItemIds = SHOP_ITEMS.map(i => i.id);
      // Unlock all arcade levels
      try {
        localStorage.setItem("orblitz_arcade_progress", JSON.stringify({ highestLevel: 9.9 }));
      } catch {}
      const newState = { devMode: true, ownedItems: allItemIds };
      set(newState);
      saveShopData(createSaveData({ ...get(), ...newState }));
    },
    
    addCoins: (amount) => {
      const newCoins = get().coins + amount;
      set({ coins: newCoins });
      saveShopData(createSaveData({ ...get(), coins: newCoins }));
    },
    
    purchaseItem: (itemId) => {
      const item = SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) return false;
      
      const { coins, ownedItems } = get();
      if (coins < item.price || ownedItems.includes(itemId)) return false;
      
      const newCoins = coins - item.price;
      const newOwned = [...ownedItems, itemId];
      
      set({ coins: newCoins, ownedItems: newOwned });
      saveShopData(createSaveData({ ...get(), coins: newCoins, ownedItems: newOwned }));
      
      return true;
    },
    
    equipSkin: (skin) => {
      set({ equippedSkin: skin });
      saveShopData(createSaveData({ ...get(), equippedSkin: skin }));
    },
    
    equipTrail: (trail) => {
      set({ equippedTrail: trail });
      saveShopData(createSaveData({ ...get(), equippedTrail: trail }));
    },
    
    equipRing: (ring) => {
      set({ equippedRing: ring });
      saveShopData(createSaveData({ ...get(), equippedRing: ring }));
    },
    
    equipWeapon: (weapon) => {
      useMagicOrb.getState().updateProjectiles([]);
      set({ equippedWeapon: weapon });
      saveShopData(createSaveData({ ...get(), equippedWeapon: weapon }));
    },

    addWeaponXp: (weapon, amount) => {
      if (!isProgressionWeapon(weapon)) return null;
      const current = get().weaponProgression[weapon];
      const applied = applyWeaponXp(current, amount);
      const result: WeaponLevelUpResult = {
        weapon,
        displayName: WEAPON_DISPLAY_NAMES[weapon],
        xpAwarded: Math.max(0, Math.floor(amount)),
        previousLevel: applied.previousLevel,
        level: applied.record.level,
        previousXp: current.xp,
        xp: applied.record.xp,
        leveledUp: applied.leveledUp,
        changes: getWeaponLevelUpChanges(weapon, applied.previousLevel, applied.record.level),
      };
      set((state) => ({
        weaponProgression: {
          ...state.weaponProgression,
          [weapon]: applied.record,
        },
      }));
      saveShopData(createSaveData(get()));
      return result;
    },

    recordTrophyResult: (result) => {
      const applied = applyTrophyResult(get().trophyProgression, result);
      set({ trophyProgression: applied.state });
      saveShopData(createSaveData(get()));
      return applied.newlyUnlocked;
    },

    setSelectedTitle: (trophyId) => {
      const { trophyProgression } = get();
      if (trophyId !== null && !trophyProgression.unlockedTrophyIds.includes(trophyId)) return;
      const next = {
        ...trophyProgression,
        selectedTitle: trophyId,
      };
      set({ trophyProgression: next });
      saveShopData(createSaveData({ ...get(), trophyProgression: next }));
    },
    
    equipDefense: (defense, slot) => {
      const prevDefenses = get().equippedDefenses;
      const newDefenses = [...prevDefenses] as [DefenseType, DefenseType];
      if (defense !== "none") {
        const otherSlot = slot === 0 ? 1 : 0;
        if (newDefenses[otherSlot] === defense) {
          newDefenses[otherSlot] = "none";
        }
      }
      newDefenses[slot] = defense;
      
      const removedDefense = prevDefenses[slot];
      if (removedDefense !== defense && removedDefense !== "none") {
        if (removedDefense === "distort_field") {
          useMagicOrb.setState({ distortActive: false, distortCooldown: 0, distortTimer: 0 });
        }
        if (removedDefense === "pulse_shield") {
          useMagicOrb.setState({ pulseShieldCooldown: 0 });
        }
        if (removedDefense === "orbital_teletransfer") {
          useMagicOrb.setState({ teletransferCooldown: 0 });
        }
        if (removedDefense === "defense_system") {
          useMagicOrb.setState({ defenseOrbs: [] });
        }
      }
      
      set({ equippedDefenses: newDefenses });
      saveShopData(createSaveData({ ...get(), equippedDefenses: newDefenses }));
    },
    
    equipMagiOrb: (magiOrb) => {
      set({ equippedMagiOrb: magiOrb });
      saveShopData(createSaveData({ ...get(), equippedMagiOrb: magiOrb }));
    },
    
    openShop: () => set({ shopOpen: true }),
    closeShop: () => set({ shopOpen: false }),
    openInventory: () => set({ inventoryOpen: true }),
    closeInventory: () => set({ inventoryOpen: false }),
    openTrophies: () => set({ trophiesOpen: true, shopOpen: false, inventoryOpen: false }),
    closeTrophies: () => set({ trophiesOpen: false }),
    
    isOwned: (itemId) => get().ownedItems.includes(itemId),
    canAfford: (price) => get().coins >= price,
  }))
);
