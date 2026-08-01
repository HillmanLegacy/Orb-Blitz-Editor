import { motion, AnimatePresence } from "framer-motion";
import { useShop, SHOP_ITEMS, ShopItem, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useState } from "react";

// ─── Slot definitions ─────────────────────────────────────────────────────────
type SlotKey = "weapon" | "defense_0" | "defense_1" | "magi_orb" | "skin" | "trail" | "aura";
type Category = "weapon" | "defense" | "magi_orb" | "skin" | "trail" | "aura";

interface SlotDef {
  key: SlotKey;
  label: string;
  icon: string;
  color: string;
  shadow: string;
  cat: Category;
  defSlot?: 0 | 1;
}

interface EquippedState {
  equippedSkin: string;
  equippedTrail: string;
  equippedRing: string;
  equippedWeapon: string;
  equippedDefenses: [string, string];
  equippedMagiOrb: string;
}

const SLOTS: SlotDef[] = [
  { key: "weapon",    label: "WEAPON",     icon: "⚡", color: "#ff7700", shadow: "rgba(255,119,0,0.45)",  cat: "weapon"   },
  { key: "defense_0", label: "DEFENSE I",  icon: "◎", color: "#00ffff", shadow: "rgba(0,255,255,0.45)",  cat: "defense",  defSlot: 0 },
  { key: "defense_1", label: "DEFENSE II", icon: "◎", color: "#22ddcc", shadow: "rgba(34,221,204,0.4)",  cat: "defense",  defSlot: 1 },
  { key: "magi_orb",  label: "MAGI-ORB",  icon: "◆", color: "#8844ff", shadow: "rgba(136,68,255,0.45)", cat: "magi_orb" },
  { key: "skin",      label: "SKIN",       icon: "●", color: "#ff00ff", shadow: "rgba(255,0,255,0.45)",  cat: "skin"     },
  { key: "trail",     label: "TRAIL",      icon: "≋", color: "#ddcc00", shadow: "rgba(221,204,0,0.4)",   cat: "trail"    },
  { key: "aura",      label: "AURA",       icon: "✦", color: "#00ccee", shadow: "rgba(0,204,238,0.4)",   cat: "aura"     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEquippedValue(slot: SlotDef, eq: EquippedState): string {
  switch (slot.cat) {
    case "weapon":   return eq.equippedWeapon;
    case "defense":  return eq.equippedDefenses[slot.defSlot!];
    case "magi_orb": return eq.equippedMagiOrb;
    case "skin":     return eq.equippedSkin;
    case "trail":    return eq.equippedTrail;
    case "aura":     return eq.equippedRing;
  }
}

function getEquippedName(slot: SlotDef, val: string): string {
  if (!val || val === "none" || val === "default") return "— none —";
  return SHOP_ITEMS.find(i => i.value === val && i.category === slot.cat)?.name ?? val;
}

function clearMeta(cat: Category): { label: string; desc: string } {
  if (cat === "skin")    return { label: "Default Skin",  desc: "Standard orb appearance"  };
  if (cat === "aura")    return { label: "Default Aura",  desc: "No aura equipped"           };
  if (cat === "trail")   return { label: "No Trail",      desc: "Remove trail effect"       };
  if (cat === "weapon")  return { label: "No Weapon",     desc: "Unequip weapon"            };
  if (cat === "defense") return { label: "Empty Slot",    desc: "Remove defense from slot"  };
  return                        { label: "None",          desc: "Unequip item"              };
}

// ─── Main Inventory (Gear) popup ──────────────────────────────────────────────
export function Inventory() {
  const {
    inventoryOpen, closeInventory,
    ownedItems,
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
    equipSkin, equipTrail, equipRing, equipWeapon, equipDefense, equipMagiOrb,
  } = useShop();

  const [activeSlot, setActiveSlot] = useState<SlotDef>(SLOTS[0]);

  const eq: EquippedState = {
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
  };

  const doEquip = (slot: SlotDef, item: ShopItem | null) => {
    switch (slot.cat) {
      case "skin":     equipSkin(item ? item.value as OrbSkin : "default"); break;
      case "trail":    equipTrail(item ? item.value as TrailEffect : "none"); break;
      case "aura":     equipRing(item ? item.value as RingStyle : "default"); break;
      case "weapon":   equipWeapon(item ? item.value as WeaponType : "none"); break;
      case "defense":  equipDefense(item ? item.value as DefenseType : "none", slot.defSlot!); break;
      case "magi_orb": equipMagiOrb(item ? item.value as MagiOrbType : "none"); break;
    }
  };

  const slot = activeSlot;
  const currentVal = getEquippedValue(slot, eq);
  const clear = clearMeta(slot.cat);
  const isDefaultSelected = currentVal === "none" || currentVal === "default";

  const ownedCatItems = SHOP_ITEMS.filter(
    i => i.category === slot.cat && ownedItems.includes(i.id)
  );

  if (!inventoryOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ padding: "clamp(10px, 2.5vw, 20px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ background: "rgba(0,0,8,0.82)", backdropFilter: "blur(8px)" }}
          onClick={closeInventory}
        />

        {/* Card — matches Shop dimensions exactly */}
        <motion.div
          className="relative flex flex-col w-full"
          style={{
            maxWidth: "min(720px, 100%)",
            maxHeight: "min(88vh, 680px)",
            background: "rgba(4,4,18,0.97)",
            border: "1px solid rgba(0,255,255,0.14)",
            borderRadius: "clamp(16px, 2.5vw, 24px)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 0 80px rgba(0,255,255,0.07), 0 28px 90px rgba(0,0,0,0.75)",
          }}
          initial={{ scale: 0.88, y: 28, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
        >
          {/* Scanline texture */}
          <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden" style={{ zIndex: 0 }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,255,255,0.008) 5px,rgba(255,255,255,0.008) 6px)",
            }} />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            className="relative flex-none flex items-center justify-between px-5 pt-4 pb-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 1 }}
          >
            <span
              className="font-black text-lg tracking-[0.18em] uppercase"
              style={{
                background: "linear-gradient(90deg,#ff7700,#ff00ff,#8844ff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 8px rgba(255,119,0,0.4))",
              }}
            >
              LOADOUT
            </span>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={closeInventory}
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 32, height: 32,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer",
              }}
            >
              ×
            </motion.button>
          </div>

          {/* ── Body: slot sidebar + picker ────────────────────────────── */}
          <div className="relative flex flex-1 min-h-0" style={{ zIndex: 1 }}>

            {/* Left sidebar — all 7 slots always visible */}
            <div
              className="flex-none flex flex-col gap-1 py-3 px-2"
              style={{
                width: "clamp(130px, 24%, 164px)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {SLOTS.map(s => {
                const val     = getEquippedValue(s, eq);
                const name    = getEquippedName(s, val);
                const hasItem = val !== "none" && val !== "default" && !!val;
                const active  = activeSlot.key === s.key;
                return (
                  <motion.button
                    key={s.key}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setActiveSlot(s)}
                    className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl w-full text-left"
                    style={{
                      background: active ? `${s.color}16` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? s.color + "55" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: active ? `0 0 18px ${s.shadow}` : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Icon circle */}
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 26, height: 26, borderRadius: 7,
                        background: active ? `${s.color}22` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${active ? s.color + "55" : "rgba(255,255,255,0.08)"}`,
                        color: active ? s.color : "rgba(255,255,255,0.3)",
                        fontSize: "0.8rem", lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      {s.icon}
                    </div>

                    {/* Slot info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-black tracking-widest uppercase leading-none"
                        style={{
                          fontSize: "0.58rem",
                          color: active ? s.color : "rgba(255,255,255,0.28)",
                          textShadow: active ? `0 0 8px ${s.color}88` : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {s.label}
                      </p>
                      <p
                        className="truncate leading-tight mt-0.5"
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 600,
                          color: hasItem
                            ? (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)")
                            : "rgba(255,255,255,0.18)",
                        }}
                      >
                        {name}
                      </p>
                    </div>

                    {/* Active right-edge accent */}
                    {active && (
                      <motion.div
                        layoutId="slot-accent"
                        className="absolute right-0"
                        style={{
                          width: 2, top: "20%", bottom: "20%",
                          background: s.color,
                          borderRadius: "2px 0 0 2px",
                          boxShadow: `0 0 8px ${s.color}`,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Right — item picker for the active slot */}
            <div className="flex flex-col flex-1 min-w-0">

              {/* Picker header */}
              <div
                className="flex-none flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slot.key}
                    className="flex items-center gap-2.5"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: `${slot.color}18`, border: `1px solid ${slot.color}44`,
                        color: slot.color, fontSize: "1rem", lineHeight: 1,
                      }}
                    >
                      {slot.icon}
                    </div>
                    <div>
                      <p
                        className="font-black tracking-widest uppercase leading-none"
                        style={{ color: slot.color, fontSize: "0.72rem", textShadow: `0 0 10px ${slot.color}66` }}
                      >
                        {slot.label}
                      </p>
                      <p className="text-white/30 text-[10px] mt-0.5">
                        Select an item to equip
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Picker list */}
              <div
                className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
                style={{ scrollbarWidth: "thin", scrollbarColor: `${slot.color}22 transparent` }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slot.key}
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Default / clear option */}
                    <PickerRow
                      label={clear.label}
                      desc={clear.desc}
                      isSelected={isDefaultSelected}
                      color={slot.color}
                      onClick={() => doEquip(slot, null)}
                    />

                    {ownedCatItems.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-white/20 text-sm uppercase tracking-widest">No items owned</p>
                        <p className="text-white/15 text-xs mt-1">Visit the Shop to get some!</p>
                      </div>
                    )}

                    {ownedCatItems.map(item => (
                      <PickerRow
                        key={item.id}
                        label={item.name}
                        desc={item.description}
                        isSelected={currentVal === item.value}
                        color={slot.color}
                        onClick={() => doEquip(slot, item)}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Single picker row ────────────────────────────────────────────────────────
function PickerRow({ label, desc, isSelected, color, onClick }: {
  label: string; desc: string; isSelected: boolean; color: string; onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl"
      style={{
        background: isSelected ? `${color}12` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isSelected ? color + "55" : "rgba(255,255,255,0.07)"}`,
        boxShadow: isSelected ? `0 0 16px ${color}30` : "none",
        cursor: "pointer",
        transition: "all 0.14s",
      }}
    >
      {/* Selection dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: isSelected ? color : "rgba(255,255,255,0.12)",
        boxShadow: isSelected ? `0 0 8px ${color}` : "none",
        transition: "all 0.14s",
      }} />
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-white leading-tight truncate">{label}</p>
        <p className="text-white/35 text-[11px] leading-tight mt-0.5">{desc}</p>
      </div>
      {/* Equipped badge */}
      {isSelected && (
        <span
          className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md"
          style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
        >
          EQUIPPED
        </span>
      )}
    </motion.button>
  );
}
