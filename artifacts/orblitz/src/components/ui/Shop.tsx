import { motion, AnimatePresence } from "framer-motion";
import { useShop, SHOP_ITEMS, ShopItem, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useState, useRef } from "react";

// ─── Per-category design tokens ──────────────────────────────────────────────
const PALETTE: Record<string, { color: string; shadow: string; icon: string; label: string }> = {
  weapon:   { color: "#ff7700", shadow: "rgba(255,119,0,0.5)",   icon: "⚡", label: "WEAPONS"  },
  defense:  { color: "#00ffff", shadow: "rgba(0,255,255,0.5)",   icon: "◎", label: "DEFENSE"  },
  magi_orb: { color: "#8844ff", shadow: "rgba(136,68,255,0.5)",  icon: "◆", label: "MAGI-ORB" },
  skin:     { color: "#ff00ff", shadow: "rgba(255,0,255,0.5)",   icon: "●", label: "SKINS"    },
  trail:    { color: "#ddcc00", shadow: "rgba(221,204,0,0.45)",  icon: "≋", label: "TRAILS"   },
  ring:     { color: "#00ccee", shadow: "rgba(0,204,238,0.45)",  icon: "○", label: "RINGS"    },
};

const CAT_ORDER = ["weapon", "defense", "magi_orb", "skin", "trail", "ring"] as const;
type CatKey = typeof CAT_ORDER[number];

// ─── Compact item row ─────────────────────────────────────────────────────────
function ItemRow({
  item, isOwned, isEquipped, canAfford, onPurchase, onEquip,
}: {
  item: ShopItem; isOwned: boolean; isEquipped: boolean;
  canAfford: boolean; onPurchase: () => void; onEquip: () => void;
}) {
  const pal = PALETTE[item.category];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
      style={{
        background: isEquipped ? `${pal.color}0e` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isEquipped ? pal.color + "50" : "rgba(255,255,255,0.07)"}`,
        boxShadow: isEquipped ? `0 0 14px ${pal.shadow}` : "none",
      }}
    >
      {/* Accent bar */}
      <div style={{
        width: 3, alignSelf: "stretch", minHeight: 36,
        background: pal.color, borderRadius: 2, opacity: isEquipped ? 1 : 0.35, flexShrink: 0,
      }} />
      {/* Category icon */}
      <div className="flex items-center justify-center flex-shrink-0" style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${pal.color}16`, border: `1px solid ${pal.color}44`,
        color: pal.color, fontSize: "1.1rem", lineHeight: 1,
      }}>
        {pal.icon}
      </div>
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight truncate">{item.name}</p>
        <p className="text-white/40 text-[11px] leading-tight mt-0.5 line-clamp-1">{item.description}</p>
      </div>
      {/* Action */}
      {isEquipped ? (
        <span className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg"
          style={{ color: pal.color, background: `${pal.color}18`, border: `1px solid ${pal.color}55` }}>
          EQUIPPED
        </span>
      ) : isOwned ? (
        <motion.button whileTap={{ scale: 0.9 }} onClick={onEquip}
          className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg cursor-pointer"
          style={{ color: pal.color, background: `${pal.color}12`, border: `1px solid ${pal.color}55` }}>
          EQUIP
        </motion.button>
      ) : (
        <motion.button whileTap={{ scale: canAfford ? 0.9 : 1 }} onClick={canAfford ? onPurchase : undefined}
          disabled={!canAfford}
          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black tracking-wider px-2 py-1 rounded-lg"
          style={{
            color: canAfford ? "#ddcc00" : "#555",
            background: canAfford ? "rgba(221,204,0,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${canAfford ? "rgba(221,204,0,0.45)" : "rgba(255,255,255,0.08)"}`,
            cursor: canAfford ? "pointer" : "default",
          }}>
          <span>★</span>
          <span>{item.price.toLocaleString()}</span>
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── Main Shop popup ──────────────────────────────────────────────────────────
export function Shop() {
  const {
    coins: stars, shopOpen, closeShop,
    purchaseItem, isOwned, canAfford,
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
    equipSkin, equipTrail, equipRing, equipWeapon, equipDefense, equipMagiOrb,
  } = useShop();

  const [cat, setCat] = useState<CatKey>("weapon");
  const tabsRef = useRef<HTMLDivElement>(null);

  const filteredItems = SHOP_ITEMS
    .filter(i => i.category === cat)
    .sort((a, b) => a.price - b.price);

  const isItemEquipped = (item: ShopItem): boolean => {
    if (item.category === "skin")     return equippedSkin === item.value;
    if (item.category === "trail")    return equippedTrail === item.value;
    if (item.category === "ring")     return equippedRing === item.value;
    if (item.category === "weapon")   return equippedWeapon === item.value;
    if (item.category === "defense")  return equippedDefenses.includes(item.value as DefenseType);
    if (item.category === "magi_orb") return equippedMagiOrb === item.value;
    return false;
  };

  const handlePurchase = (item: ShopItem) => {
    if (!purchaseItem(item.id)) return;
    handleEquip(item);
  };

  const handleEquip = (item: ShopItem) => {
    if (item.category === "skin")     return equipSkin(item.value as OrbSkin);
    if (item.category === "trail")    return equipTrail(item.value as TrailEffect);
    if (item.category === "ring")     return equipRing(item.value as RingStyle);
    if (item.category === "weapon")   return equipWeapon(item.value as WeaponType);
    if (item.category === "defense") {
      const slot = equippedDefenses[0] === "none" ? 0 : equippedDefenses[1] === "none" ? 1 : 0;
      return equipDefense(item.value as DefenseType, slot as 0 | 1);
    }
    if (item.category === "magi_orb") return equipMagiOrb(item.value as MagiOrbType);
  };

  return (
    <AnimatePresence>
      {shopOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ padding: "clamp(12px,3vw,24px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 cursor-pointer"
            style={{ background: "rgba(0,0,8,0.82)", backdropFilter: "blur(8px)" }}
            onClick={closeShop}
          />

          {/* Card */}
          <motion.div
            className="relative flex flex-col w-full"
            style={{
              maxWidth: "min(440px, 100%)",
              maxHeight: "min(86vh, 640px)",
              background: "rgba(4,4,18,0.97)",
              border: "1px solid rgba(0,255,255,0.14)",
              borderRadius: "clamp(16px,2.5vw,24px)",
              backdropFilter: "blur(32px)",
              boxShadow: "0 0 60px rgba(0,255,255,0.08), 0 24px 80px rgba(0,0,0,0.7)",
            }}
            initial={{ scale: 0.88, y: 28, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            {/* Top scanline texture */}
            <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden" style={{ zIndex: 0 }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,255,255,0.008) 5px,rgba(255,255,255,0.008) 6px)",
              }} />
            </div>

            {/* ── Header ── */}
            <div className="relative flex-none flex items-center justify-between px-5 pt-4 pb-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 1 }}>
              {/* Title */}
              <span className="font-black text-lg tracking-[0.18em] uppercase"
                style={{
                  background: "linear-gradient(90deg,#00ffff,#8844ff,#ff00ff)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 8px rgba(0,255,255,0.4))",
                }}>
                SHOP
              </span>
              {/* Stars */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(221,204,0,0.1)", border: "1px solid rgba(221,204,0,0.3)" }}>
                  <span style={{ color: "#ddcc00", fontSize: "1rem" }}>★</span>
                  <span className="font-black text-sm" style={{ color: "#ddcc00" }}>{stars.toLocaleString()}</span>
                </div>
                {/* Close */}
                <motion.button whileTap={{ scale: 0.85 }} onClick={closeShop}
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer" }}>
                  ×
                </motion.button>
              </div>
            </div>

            {/* ── Category tabs ── */}
            <div ref={tabsRef} className="relative flex-none flex gap-2 px-4 py-3 overflow-x-auto"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                scrollbarWidth: "none", zIndex: 1,
              }}>
              {CAT_ORDER.map(c => {
                const pal = PALETTE[c];
                const active = cat === c;
                return (
                  <motion.button key={c}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setCat(c)}
                    className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase whitespace-nowrap"
                    style={{
                      color: active ? pal.color : "rgba(255,255,255,0.35)",
                      background: active ? `${pal.color}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? pal.color + "66" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: active ? `0 0 14px ${pal.shadow}` : "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                    <span>{pal.icon}</span>
                    <span>{pal.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* ── Item list ── */}
            <div className="relative flex-1 min-h-0 overflow-y-auto px-4 py-3"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,255,255,0.15) transparent", zIndex: 1 }}>
              <AnimatePresence mode="wait">
                <motion.div key={cat} className="flex flex-col gap-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}>
                  {filteredItems.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isOwned={isOwned(item.id)}
                      isEquipped={isItemEquipped(item)}
                      canAfford={canAfford(item.price)}
                      onPurchase={() => handlePurchase(item)}
                      onEquip={() => handleEquip(item)}
                    />
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="text-center py-8 text-white/25 text-sm uppercase tracking-widest">No items</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
