import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type OrbSkin = "default" | "golden" | "neon" | "rainbow" | "crystal" | "void" | "plasma" | "galaxy" | "phoenix" | "shadow" | "aurora" | "diamond" | "inferno" | "frost" | "toxic" | "electric";
export type TrailEffect = "none" | "sparkle" | "fire" | "ice" | "cosmic" | "lightning" | "rainbow" | "plasma" | "shadow" | "stardust" | "meteor" | "spirit" | "neon" | "sakura" | "galaxy" | "particle_swarm";
export type RingStyle = "default" | "double" | "triple" | "spiral" | "none" | "pulse" | "orbit" | "halo" | "shield" | "hex" | "prism";
export type WeaponType = "none" | "orbital_rapid_blaster" | "orbital_scattershot" | "spiral_shooter" | "overcharged_blaster" | "homing_launcher" | "sub_blaster";
export type DefenseType = "none" | "orbital_teletransfer" | "distort_field" | "pulse_shield" | "defense_system" | "spatial_relocation" | "restoration" | "armor";
export type MagiOrbType = "none" | "magi_orb_1" | "magi_orb_2" | "magi_orb_3" | "magi_orb_4" | "magi_orb_5" | "magi_orb_6" | "magi_orb_7" | "magi_orb_8" | "magi_orb_9";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "skin" | "trail" | "ring" | "weapon" | "defense" | "magi_orb";
  value: OrbSkin | TrailEffect | RingStyle | WeaponType | DefenseType | MagiOrbType;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "skin_golden", name: "Golden Orb", description: "A luxurious golden glow with sparkle particles", price: 500, category: "skin", value: "golden" },
  { id: "skin_neon", name: "Neon Surge", description: "Electric neon colors with pulse effect", price: 500, category: "skin", value: "neon" },
  { id: "skin_rainbow", name: "Rainbow Prism", description: "Constantly shifting colors with light rays", price: 500, category: "skin", value: "rainbow" },
  { id: "skin_crystal", name: "Crystal Core", description: "Transparent crystalline look with refraction", price: 500, category: "skin", value: "crystal" },
  { id: "skin_void", name: "Void Walker", description: "Dark matter essence with particle absorption", price: 500, category: "skin", value: "void" },
  { id: "skin_plasma", name: "Plasma Core", description: "Unstable plasma energy with electric arcs", price: 500, category: "skin", value: "plasma" },
  { id: "skin_galaxy", name: "Galaxy Soul", description: "Swirling cosmos with stars and nebulae", price: 500, category: "skin", value: "galaxy" },
  { id: "skin_phoenix", name: "Phoenix Flame", description: "Eternal fire with rising ember particles", price: 500, category: "skin", value: "phoenix" },
  { id: "skin_shadow", name: "Shadow Essence", description: "Dark wisps with smoke trail effects", price: 500, category: "skin", value: "shadow" },
  { id: "skin_aurora", name: "Aurora Borealis", description: "Northern lights with color waves", price: 500, category: "skin", value: "aurora" },
  { id: "skin_diamond", name: "Diamond Core", description: "Brilliant faceted gem with light prisma", price: 500, category: "skin", value: "diamond" },
  { id: "skin_inferno", name: "Inferno Heart", description: "Molten core with lava cracks", price: 500, category: "skin", value: "inferno" },
  { id: "skin_frost", name: "Frost Nova", description: "Frozen essence with ice crystals", price: 500, category: "skin", value: "frost" },
  { id: "skin_toxic", name: "Toxic Glow", description: "Radioactive aura with dripping particles", price: 500, category: "skin", value: "toxic" },
  { id: "skin_electric", name: "Electric Storm", description: "Lightning charged with bolt effects", price: 500, category: "skin", value: "electric" },
  
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
  
  { id: "ring_double", name: "Double Rings", description: "Two glowing orbital rings", price: 300, category: "ring", value: "double" },
  { id: "ring_triple", name: "Triple Rings", description: "Three intersecting rings", price: 300, category: "ring", value: "triple" },
  { id: "ring_spiral", name: "Spiral Rings", description: "Spiraling energy rings with particles", price: 300, category: "ring", value: "spiral" },
  { id: "ring_none", name: "No Rings", description: "Clean orbless look", price: 300, category: "ring", value: "none" },
  { id: "ring_pulse", name: "Pulse Rings", description: "Expanding pulse waves", price: 300, category: "ring", value: "pulse" },
  { id: "ring_orbit", name: "Orbit Rings", description: "Orbiting energy spheres", price: 300, category: "ring", value: "orbit" },
  { id: "ring_halo", name: "Halo Ring", description: "Angelic golden halo effect", price: 300, category: "ring", value: "halo" },
  { id: "ring_shield", name: "Shield Ring", description: "Hexagonal force field", price: 300, category: "ring", value: "shield" },
  { id: "ring_hex", name: "Hex Rings", description: "Geometric hexagon patterns", price: 300, category: "ring", value: "hex" },
  { id: "ring_prism", name: "Prism Rings", description: "Light-splitting crystal rings", price: 300, category: "ring", value: "prism" },
  
  { id: "weapon_orbital_rapid_blaster", name: "Orbital Rapid Blaster", description: "Fires 6 shots per second. Each projectile destroys 1 enemy.", price: 2000, category: "weapon", value: "orbital_rapid_blaster" },
  { id: "weapon_orbital_scattershot", name: "Orbital Scattershot", description: "Fires 3 projectiles in a wedge pattern. Each destroys 1 enemy.", price: 2000, category: "weapon", value: "orbital_scattershot" },
  { id: "weapon_spiral_shooter", name: "Orbital Spiral Blaster", description: "Fires 3 small spiraling projectiles. Each destroys 1 enemy.", price: 2000, category: "weapon", value: "spiral_shooter" },
  { id: "weapon_overcharged_blaster", name: "Orbital Overcharged Blaster", description: "Slow-firing large projectiles that pierce through 3 enemies.", price: 2000, category: "weapon", value: "overcharged_blaster" },
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
  { id: "magi_orb_2", name: "Magi-Orb II", description: "Become invisible and phase through enemies for 5s (15s cooldown)", price: 3000, category: "magi_orb", value: "magi_orb_2" },
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
  equippedDefenses: [DefenseType, DefenseType];
  equippedMagiOrb: MagiOrbType;
  shopOpen: boolean;
  inventoryOpen: boolean;
  
  addCoins: (amount: number) => void;
  purchaseItem: (itemId: string) => boolean;
  equipSkin: (skin: OrbSkin) => void;
  equipTrail: (trail: TrailEffect) => void;
  equipRing: (ring: RingStyle) => void;
  equipWeapon: (weapon: WeaponType) => void;
  equipDefense: (defense: DefenseType, slot: 0 | 1) => void;
  equipMagiOrb: (magiOrb: MagiOrbType) => void;
  openShop: () => void;
  closeShop: () => void;
  openInventory: () => void;
  closeInventory: () => void;
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
  equippedDefenses: [DefenseType, DefenseType];
  equippedMagiOrb: MagiOrbType;
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
      
      const result = {
        coins: data.coins ?? 0,
        ownedItems,
        equippedSkin: data.equippedSkin ?? "default",
        equippedTrail: data.equippedTrail ?? "none",
        equippedRing: data.equippedRing ?? "none",
        equippedWeapon: equippedWeapon === "orbital_teletransfer" ? "none" as WeaponType : equippedWeapon,
        equippedDefenses: equippedDefenses as [DefenseType, DefenseType],
        equippedMagiOrb: data.equippedMagiOrb ?? "none",
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
    equippedDefenses: ["none", "none"],
    equippedMagiOrb: "none",
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
  equippedDefenses: state.equippedDefenses,
  equippedMagiOrb: state.equippedMagiOrb,
});

export const useShop = create<ShopState>()(
  subscribeWithSelector((set, get) => ({
    coins: storedData.coins,
    ownedItems: storedData.ownedItems,
    equippedSkin: storedData.equippedSkin,
    equippedTrail: storedData.equippedTrail,
    equippedRing: storedData.equippedRing,
    equippedWeapon: storedData.equippedWeapon,
    equippedDefenses: storedData.equippedDefenses as [DefenseType, DefenseType],
    equippedMagiOrb: storedData.equippedMagiOrb as MagiOrbType,
    shopOpen: false,
    inventoryOpen: false,
    
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
      import("./useMagicOrb").then(({ useMagicOrb }) => {
        useMagicOrb.getState().updateProjectiles([]);
      });
      set({ equippedWeapon: weapon });
      saveShopData(createSaveData({ ...get(), equippedWeapon: weapon }));
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
        import("./useMagicOrb").then(({ useMagicOrb }) => {
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
        });
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
    
    isOwned: (itemId) => get().ownedItems.includes(itemId),
    canAfford: (price) => get().coins >= price,
  }))
);
