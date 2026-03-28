import { motion, AnimatePresence } from "framer-motion";
import { useShop, SHOP_ITEMS, ShopItem, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useState } from "react";
import { StarShop } from "./StarShop";

function ItemPreview({ item }: { item: ShopItem }) {
  const getSkinColors = (value: string) => {
    const colors: Record<string, string[]> = {
      golden: ["#FFD700", "#FFA500"],
      neon: ["#00FF00", "#00FFFF"],
      rainbow: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#8B00FF"],
      crystal: ["#87CEEB", "#ADD8E6"],
      void: ["#1a0a2e", "#2d1b4e"],
      plasma: ["#FF00FF", "#00FFFF"],
      galaxy: ["#1a1a3e", "#4B0082"],
      phoenix: ["#FF4500", "#FF8C00"],
      shadow: ["#2d2d2d", "#4a4a4a"],
      aurora: ["#00FF7F", "#00CED1"],
      diamond: ["#B9F2FF", "#E6E6FA"],
      inferno: ["#FF4500", "#DC143C"],
      frost: ["#00BFFF", "#E0FFFF"],
      toxic: ["#32CD32", "#ADFF2F"],
      electric: ["#FFFF00", "#00FFFF"],
    };
    return colors[value] || ["#FFFFFF", "#CCCCCC"];
  };

  if (item.category === "skin") {
    const colors = getSkinColors(item.value as string);
    return (
      <motion.div
        className="w-10 h-10 rounded-full mx-auto mb-2"
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1] || colors[0]})`,
          boxShadow: `0 0 15px ${colors[0]}66`,
        }}
        animate={{
          scale: [1, 1.1, 1],
          boxShadow: [`0 0 15px ${colors[0]}66`, `0 0 25px ${colors[0]}99`, `0 0 15px ${colors[0]}66`],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    );
  }

  if (item.category === "trail") {
    return (
      <div className="relative w-16 h-6 mx-auto mb-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: item.value === "rainbow" 
                ? `hsl(${(i * 72)}, 100%, 60%)` 
                : item.value === "fire" ? "#FF4500"
                : item.value === "ice" ? "#00BFFF"
                : "#00FFFF",
            }}
            animate={{
              x: [64 - i * 10, 0 - i * 10],
              opacity: [1 - i * 0.15, 0.3],
              scale: [1 - i * 0.1, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>
    );
  }

  if (item.category === "ring") {
    return (
      <div className="relative w-12 h-12 mx-auto mb-2">
        <motion.div
          className="absolute inset-1 rounded-full border-2 border-yellow-400/60"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        {item.value === "double" || item.value === "triple" || item.value === "spiral" ? (
          <motion.div
            className="absolute inset-2.5 rounded-full border-2 border-orange-400/60"
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </div>
    );
  }

  if (item.category === "weapon") {
    return (
      <div className="relative w-12 h-6 mx-auto mb-2 overflow-hidden">
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-500"
          animate={{ x: [-10, 50] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (item.category === "defense") {
    return (
      <motion.div
        className="w-10 h-10 rounded-full mx-auto mb-2 border-2 border-green-400/60"
        style={{ background: "radial-gradient(circle, transparent 40%, rgba(74, 222, 128, 0.2) 100%)" }}
        animate={{
          scale: [1, 1.15, 1],
          borderColor: ["rgba(74, 222, 128, 0.6)", "rgba(74, 222, 128, 1)", "rgba(74, 222, 128, 0.6)"],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    );
  }

  if (item.category === "magi_orb") {
    return (
      <motion.div
        className="w-10 h-10 rounded-full mx-auto mb-2"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.8), rgba(99, 102, 241, 0.6))",
          boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          boxShadow: [
            "0 0 15px rgba(139, 92, 246, 0.5)",
            "0 0 30px rgba(99, 102, 241, 0.8)",
            "0 0 15px rgba(139, 92, 246, 0.5)",
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    );
  }

  return null;
}

function ShopItemCard({ item, isOwned, isEquipped, canAfford, onPurchase, onEquip }: {
  item: ShopItem;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "skin": return "from-purple-500 to-pink-500";
      case "trail": return "from-cyan-500 to-blue-500";
      case "ring": return "from-yellow-500 to-orange-500";
      case "weapon": return "from-red-500 to-pink-500";
      case "defense": return "from-green-500 to-teal-500";
      case "magi_orb": return "from-violet-500 to-indigo-500";
      default: return "from-gray-500 to-gray-600";
    }
  };

  return (
    <motion.div
      className={`relative p-4 rounded-xl border-2 ${
        isEquipped 
          ? "border-green-400 bg-green-900/30" 
          : isOwned 
            ? "border-purple-400/50 bg-purple-900/20" 
            : "border-purple-500/30 bg-purple-900/10"
      }`}
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r ${getCategoryColor(item.category)}`} />
      
      <ItemPreview item={item} />
      
      <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
      <p className="text-sm text-purple-300/70 mb-3">{item.description}</p>
      
      <div className="flex justify-between items-center">
        <span className="text-yellow-400 font-bold flex items-center gap-1">
          <span className="text-lg">&#9733;</span>
          {item.price}
        </span>
        
        {isEquipped ? (
          <span className="px-4 py-1.5 rounded-full bg-green-500/30 text-green-300 text-sm font-medium">
            Equipped
          </span>
        ) : isOwned ? (
          <button
            onClick={onEquip}
            className="px-4 py-1.5 rounded-full bg-purple-500/50 text-white text-sm font-medium hover:bg-purple-500/70 transition-colors"
          >
            Equip
          </button>
        ) : (
          <button
            onClick={onPurchase}
            disabled={!canAfford}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              canAfford 
                ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400" 
                : "bg-gray-600/50 text-gray-400 cursor-not-allowed"
            }`}
          >
            Buy
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function Shop() {
  const { 
    coins: stars, 
    shopOpen, 
    closeShop, 
    purchaseItem, 
    isOwned, 
    canAfford,
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
  
  const [selectedCategory, setSelectedCategory] = useState<"all" | "skin" | "trail" | "ring" | "weapon" | "defense" | "magi_orb">("all");
  const [showStarShop, setShowStarShop] = useState(false);
  
  const filteredItems = (selectedCategory === "all" 
    ? SHOP_ITEMS 
    : SHOP_ITEMS.filter(item => item.category === selectedCategory)
  ).sort((a, b) => a.price - b.price);
  
  const handlePurchase = (item: ShopItem) => {
    const success = purchaseItem(item.id);
    if (success) {
      if (item.category === "skin") equipSkin(item.value as OrbSkin);
      else if (item.category === "trail") equipTrail(item.value as TrailEffect);
      else if (item.category === "ring") equipRing(item.value as RingStyle);
      else if (item.category === "weapon") equipWeapon(item.value as WeaponType);
      else if (item.category === "defense") equipDefense(item.value as DefenseType, 0);
      else if (item.category === "magi_orb") equipMagiOrb(item.value as MagiOrbType);
    }
  };
  
  const handleEquip = (item: ShopItem) => {
    if (item.category === "skin") equipSkin(item.value as OrbSkin);
    else if (item.category === "trail") equipTrail(item.value as TrailEffect);
    else if (item.category === "ring") equipRing(item.value as RingStyle);
    else if (item.category === "weapon") equipWeapon(item.value as WeaponType);
    else if (item.category === "defense") {
      const emptySlot = equippedDefenses[0] === "none" ? 0 : equippedDefenses[1] === "none" ? 1 : 0;
      equipDefense(item.value as DefenseType, emptySlot as 0 | 1);
    }
    else if (item.category === "magi_orb") equipMagiOrb(item.value as MagiOrbType);
  };
  
  const isItemEquipped = (item: ShopItem) => {
    if (item.category === "skin") return equippedSkin === item.value;
    if (item.category === "trail") return equippedTrail === item.value;
    if (item.category === "ring") return equippedRing === item.value;
    if (item.category === "weapon") return equippedWeapon === item.value;
    if (item.category === "defense") return equippedDefenses.includes(item.value as DefenseType);
    if (item.category === "magi_orb") return equippedMagiOrb === item.value;
    return false;
  };

  return (
    <AnimatePresence>
      {shopOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900"
            onClick={closeShop}
          />
          
          <motion.div
            className="relative w-full max-w-2xl max-h-[80vh] bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-violet-900/95 rounded-2xl border border-purple-500/30 overflow-hidden"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            <div className="p-6 border-b border-purple-500/30">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                  Orblitz Shop
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-purple-800/50 px-3 py-2 rounded-lg border border-purple-500/30">
                    <span className="text-yellow-400 text-xl">&#9733;</span>
                    <span className="text-yellow-300 font-bold text-lg">{stars}</span>
                  </div>
                  <motion.button
                    onClick={() => setShowStarShop(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 rounded-lg shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-white font-bold text-sm">Buy Stars</span>
                    <span className="text-white text-lg">+</span>
                  </motion.button>
                  <button
                    onClick={closeShop}
                    className="text-purple-300 hover:text-white text-2xl transition-colors ml-2"
                  >
                    &times;
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4 flex-wrap">
                {(["all", "weapon", "defense", "magi_orb", "skin", "trail", "ring"] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? "bg-purple-500 text-white"
                        : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/40"
                    }`}
                  >
                    {category === "all" ? "All" : 
                     category === "magi_orb" ? "Magi-Orbs" :
                     category.charAt(0).toUpperCase() + category.slice(1) + "s"}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <ShopItemCard
                    key={item.id}
                    item={item}
                    isOwned={isOwned(item.id)}
                    isEquipped={isItemEquipped(item)}
                    canAfford={canAfford(item.price)}
                    onPurchase={() => handlePurchase(item)}
                    onEquip={() => handleEquip(item)}
                  />
                ))}
              </div>
              
              {filteredItems.length === 0 && (
                <div className="text-center text-purple-400 py-8">
                  No items in this category
                </div>
              )}
            </div>
          </motion.div>
          
          {showStarShop && <StarShop onClose={() => setShowStarShop(false)} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
