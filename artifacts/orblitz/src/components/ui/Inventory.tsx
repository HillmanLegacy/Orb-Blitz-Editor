import { motion } from "framer-motion";
import { useShop, SHOP_ITEMS, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useState } from "react";

export function Inventory() {
  const { 
    inventoryOpen, 
    closeInventory, 
    ownedItems,
    equippedSkin,
    equippedTrail,
    equippedRing,
    equippedWeapon,
    equippedDefenses,
    equippedMagiOrb,
    equipSkin,
    equipTrail,
    equipRing,
    equipWeapon,
    equipDefense,
    equipMagiOrb,
  } = useShop();
  
  const [selectedDefenseSlot, setSelectedDefenseSlot] = useState<0 | 1>(0);

  if (!inventoryOpen) return null;

  const ownedSkins = SHOP_ITEMS.filter(item => item.category === "skin" && ownedItems.includes(item.id));
  const ownedTrails = SHOP_ITEMS.filter(item => item.category === "trail" && ownedItems.includes(item.id));
  const ownedRings = SHOP_ITEMS.filter(item => item.category === "ring" && ownedItems.includes(item.id));
  const ownedWeapons = SHOP_ITEMS.filter(item => item.category === "weapon" && ownedItems.includes(item.id));
  const ownedDefenses = SHOP_ITEMS.filter(item => item.category === "defense" && ownedItems.includes(item.id));
  const ownedMagiOrbs = SHOP_ITEMS.filter(item => item.category === "magi_orb" && ownedItems.includes(item.id));

  const handleEquip = (category: string, value: string, isEquipped: boolean) => {
    switch (category) {
      case "skin":
        equipSkin(isEquipped ? "default" : value as OrbSkin);
        break;
      case "trail":
        equipTrail(isEquipped ? "none" : value as TrailEffect);
        break;
      case "ring":
        equipRing(isEquipped ? "default" : value as RingStyle);
        break;
      case "weapon":
        equipWeapon(isEquipped ? "none" : value as WeaponType);
        break;
      case "defense":
        if (isEquipped) {
          const slot = equippedDefenses[0] === value ? 0 : 1;
          equipDefense("none", slot as 0 | 1);
        } else {
          equipDefense(value as DefenseType, selectedDefenseSlot);
        }
        break;
      case "magi_orb":
        equipMagiOrb(isEquipped ? "none" : value as MagiOrbType);
        break;
    }
  };

  const isItemEquipped = (category: string, value: string) => {
    switch (category) {
      case "skin": return equippedSkin === value;
      case "trail": return equippedTrail === value;
      case "ring": return equippedRing === value;
      case "weapon": return equippedWeapon === value;
      case "defense": return equippedDefenses.includes(value as DefenseType);
      case "magi_orb": return equippedMagiOrb === value;
      default: return false;
    }
  };
  
  const getDefenseSlotInfo = (value: string) => {
    if (equippedDefenses[0] === value) return "Slot 1";
    if (equippedDefenses[1] === value) return "Slot 2";
    return null;
  };

  const renderCategory = (title: string, items: typeof SHOP_ITEMS, category: string, slotInfo?: boolean) => {
    if (items.length === 0) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-400 mb-3">{title}</h3>
          <p className="text-gray-500 text-sm">No items owned</p>
        </div>
      );
    }

    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-purple-300 mb-3">{title}</h3>
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => {
            const isEquipped = isItemEquipped(item.category, item.value as string);
            const slotText = slotInfo ? getDefenseSlotInfo(item.value as string) : null;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEquip(item.category, item.value as string, isEquipped)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isEquipped
                    ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-400/30"
                    : "border-gray-600 bg-black/30 hover:border-purple-400"
                }`}
              >
                <p className="font-semibold text-white text-sm">{item.name}</p>
                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                <p className={`text-xs mt-2 font-bold ${isEquipped ? "text-cyan-400" : "text-gray-500"}`}>
                  {isEquipped ? (slotText ? `Equipped (${slotText})` : "Equipped") : "Tap to equip"}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-gradient-to-b from-purple-800 to-indigo-900 p-6 rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/30 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Loadout & Inventory
          </h2>
          <button
            onClick={closeInventory}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/30">
          <h3 className="text-lg font-bold text-white mb-3">Current Loadout</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <p className="text-xs text-red-300 font-medium">Weapon</p>
              <p className="text-sm text-white font-bold">{equippedWeapon === "none" ? "None" : SHOP_ITEMS.find(i => i.value === equippedWeapon && i.category === "weapon")?.name || equippedWeapon}</p>
            </div>
            <div className="p-3 rounded-lg bg-violet-500/20 border border-violet-500/30">
              <p className="text-xs text-violet-300 font-medium">Magi-Orb</p>
              <p className="text-sm text-white font-bold">{equippedMagiOrb === "none" ? "None" : SHOP_ITEMS.find(i => i.value === equippedMagiOrb)?.name || equippedMagiOrb}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-green-300 font-medium">Defense Slot 1</p>
                <button 
                  onClick={() => setSelectedDefenseSlot(0)}
                  className={`text-xs px-2 py-0.5 rounded ${selectedDefenseSlot === 0 ? 'bg-green-500 text-white' : 'bg-green-500/30 text-green-300'}`}
                >
                  Select
                </button>
              </div>
              <p className="text-sm text-white font-bold">{equippedDefenses[0] === "none" ? "Empty" : SHOP_ITEMS.find(i => i.value === equippedDefenses[0])?.name || equippedDefenses[0]}</p>
            </div>
            <div className="p-3 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-teal-300 font-medium">Defense Slot 2</p>
                <button 
                  onClick={() => setSelectedDefenseSlot(1)}
                  className={`text-xs px-2 py-0.5 rounded ${selectedDefenseSlot === 1 ? 'bg-teal-500 text-white' : 'bg-teal-500/30 text-teal-300'}`}
                >
                  Select
                </button>
              </div>
              <p className="text-sm text-white font-bold">{equippedDefenses[1] === "none" ? "Empty" : SHOP_ITEMS.find(i => i.value === equippedDefenses[1])?.name || equippedDefenses[1]}</p>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Tap an item to equip. Select a defense slot above before equipping defenses.
        </p>

        {renderCategory("Weapons (1 slot)", ownedWeapons, "weapon")}
        {renderCategory("Defenses (2 slots)", ownedDefenses, "defense", true)}
        {renderCategory("Magi-Orbs (1 slot)", ownedMagiOrbs, "magi_orb")}
        {renderCategory("Orb Skins", ownedSkins, "skin")}
        {renderCategory("Trail Effects", ownedTrails, "trail")}
        {renderCategory("Ring Styles", ownedRings, "ring")}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={closeInventory}
          className="w-full px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-xl mt-4"
        >
          Close
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
