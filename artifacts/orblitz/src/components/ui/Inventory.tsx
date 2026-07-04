import { motion, AnimatePresence } from "framer-motion";
import { useShop, SHOP_ITEMS, ShopItem, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useState } from "react";

// ─── Per-slot design tokens ───────────────────────────────────────────────────
type SlotKey = "weapon" | "defense_0" | "defense_1" | "magi_orb" | "skin" | "trail" | "ring";
type Category = "weapon" | "defense" | "magi_orb" | "skin" | "trail" | "ring";

interface SlotDef {
  key: SlotKey;
  label: string;
  icon: string;
  color: string;
  shadow: string;
  cat: Category;
  defSlot?: 0 | 1;
}

// Typed snapshot of equipped state passed down as props
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
  { key: "ring",      label: "RING",       icon: "○", color: "#00ccee", shadow: "rgba(0,204,238,0.4)",   cat: "ring"     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEquippedValue(slot: SlotDef, eq: EquippedState): string {
  switch (slot.cat) {
    case "weapon":   return eq.equippedWeapon;
    case "defense":  return eq.equippedDefenses[slot.defSlot!];
    case "magi_orb": return eq.equippedMagiOrb;
    case "skin":     return eq.equippedSkin;
    case "trail":    return eq.equippedTrail;
    case "ring":     return eq.equippedRing;
  }
}

function getEquippedName(slot: SlotDef, val: string): string {
  if (!val || val === "none" || val === "default") return "— none —";
  return SHOP_ITEMS.find(i => i.value === val && i.category === slot.cat)?.name ?? val;
}

// The "clear" option label and description per category
function clearMeta(cat: Category): { label: string; desc: string; value: string } {
  if (cat === "skin")  return { label: "Default Skin",  desc: "Standard orb appearance",   value: "default" };
  if (cat === "ring")  return { label: "Default Ring",  desc: "Standard orbital ring",      value: "default" };
  if (cat === "trail") return { label: "No Trail",      desc: "Remove trail effect",        value: "none" };
  if (cat === "weapon") return { label: "No Weapon",    desc: "Unequip weapon",             value: "none" };
  if (cat === "defense") return { label: "Empty Slot",  desc: "Remove defense from slot",   value: "none" };
  return { label: "None",          desc: "Unequip item",                value: "none" };
}

// ─── Popup shell helpers ──────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: "rgba(4,4,18,0.97)",
  border: "1px solid rgba(0,255,255,0.14)",
  backdropFilter: "blur(32px)",
  boxShadow: "0 0 60px rgba(0,255,255,0.07), 0 24px 80px rgba(0,0,0,0.7)",
};

const SCANLINES = (
  <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden" style={{ zIndex: 0 }}>
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,255,255,0.007) 5px,rgba(255,255,255,0.007) 6px)",
    }} />
  </div>
);

// ─── Main Inventory (Gear) popup ──────────────────────────────────────────────
export function Inventory() {
  const {
    inventoryOpen, closeInventory,
    ownedItems,
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
    equipSkin, equipTrail, equipRing, equipWeapon, equipDefense, equipMagiOrb,
  } = useShop();

  const [pickingSlot, setPickingSlot] = useState<SlotDef | null>(null);

  const eq: EquippedState = {
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
  };

  const doEquip = (slot: SlotDef, item: ShopItem | null) => {
    // null → reset to default/none
    switch (slot.cat) {
      case "skin":     equipSkin(item ? item.value as OrbSkin : "default"); break;
      case "trail":    equipTrail(item ? item.value as TrailEffect : "none"); break;
      case "ring":     equipRing(item ? item.value as RingStyle : "default"); break;
      case "weapon":   equipWeapon(item ? item.value as WeaponType : "none"); break;
      case "defense":  equipDefense(item ? item.value as DefenseType : "none", slot.defSlot!); break;
      case "magi_orb": equipMagiOrb(item ? item.value as MagiOrbType : "none"); break;
    }
    setPickingSlot(null);
  };

  if (!inventoryOpen) return null;

  return (
    <AnimatePresence>
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
          onClick={() => { setPickingSlot(null); closeInventory(); }}
        />

        {/* Card */}
        <motion.div
          className="relative flex flex-col w-full overflow-hidden"
          style={{
            maxWidth: "min(440px, 100%)",
            maxHeight: "min(86vh, 640px)",
            borderRadius: "clamp(16px,2.5vw,24px)",
            ...GLASS,
          }}
          initial={{ scale: 0.88, y: 28, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
        >
          {SCANLINES}

          <AnimatePresence mode="wait">
            {pickingSlot === null
              ? <LoadoutView
                  key="loadout"
                  slots={SLOTS}
                  eq={eq}
                  onSlotClick={setPickingSlot}
                  onClose={() => { setPickingSlot(null); closeInventory(); }}
                />
              : <PickerView
                  key={pickingSlot.key}
                  slot={pickingSlot}
                  ownedItems={ownedItems}
                  eq={eq}
                  onPick={doEquip}
                  onBack={() => setPickingSlot(null)}
                />
            }
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Loadout overview ─────────────────────────────────────────────────────────
function LoadoutView({ slots, eq, onSlotClick, onClose }: {
  slots: SlotDef[];
  eq: EquippedState;
  onSlotClick: (s: SlotDef) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="relative flex flex-col flex-1 min-h-0"
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ duration: 0.22 }}
      style={{ zIndex: 1 }}
    >
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="font-black text-lg tracking-[0.18em] uppercase"
          style={{
            background: "linear-gradient(90deg,#ff7700,#ff00ff,#8844ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 8px rgba(255,119,0,0.4))",
          }}>
          LOADOUT
        </span>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32, height: 32,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer",
          }}>
          ×
        </motion.button>
      </div>

      {/* Slot grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,119,0,0.15) transparent" }}>
        <div className="grid grid-cols-2 gap-2.5">
          {slots.map(slot => {
            const val = getEquippedValue(slot, eq);
            const name = getEquippedName(slot, val);
            const hasItem = val !== "none" && val !== "default" && !!val;
            return (
              <motion.button key={slot.key}
                whileTap={{ scale: 0.94 }}
                onClick={() => onSlotClick(slot)}
                className="relative flex items-center gap-2.5 text-left rounded-xl px-3 py-3 overflow-hidden"
                style={{
                  background: hasItem ? `${slot.color}0c` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${hasItem ? slot.color + "44" : "rgba(255,255,255,0.08)"}`,
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Radial glow when equipped */}
                {hasItem && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: `radial-gradient(ellipse at 0% 50%, ${slot.color}14 0%, transparent 70%)`,
                  }} />
                )}
                {/* Icon */}
                <div className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 34, height: 34,
                    background: `${slot.color}18`, border: `1px solid ${slot.color}44`,
                    color: slot.color, fontSize: "1rem",
                  }}>
                  {slot.icon}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black tracking-widest uppercase"
                    style={{ color: slot.color, opacity: 0.7 }}>{slot.label}</p>
                  <p className="text-white font-semibold text-xs leading-tight truncate mt-0.5"
                    style={{ opacity: hasItem ? 1 : 0.3 }}>{name}</p>
                </div>
                {/* Chevron */}
                <span className="flex-shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-center text-white/20 text-[10px] uppercase tracking-widest mt-4">
          Tap a slot to change item
        </p>
      </div>
    </motion.div>
  );
}

// ─── Slot picker view ─────────────────────────────────────────────────────────
function PickerView({ slot, ownedItems, eq, onPick, onBack }: {
  slot: SlotDef;
  ownedItems: string[];
  eq: EquippedState;
  onPick: (slot: SlotDef, item: ShopItem | null) => void;
  onBack: () => void;
}) {
  const currentVal = getEquippedValue(slot, eq);
  const clear = clearMeta(slot.cat);

  const ownedCatItems = SHOP_ITEMS.filter(
    i => i.category === slot.cat && ownedItems.includes(i.id)
  );

  const isDefaultSelected = currentVal === "none" || currentVal === "default";

  return (
    <motion.div
      className="relative flex flex-col flex-1 min-h-0"
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ duration: 0.22 }}
      style={{ zIndex: 1 }}
    >
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase px-2.5 py-1.5 rounded-lg"
          style={{
            color: slot.color, background: `${slot.color}12`,
            border: `1px solid ${slot.color}44`, cursor: "pointer",
          }}>
          ← BACK
        </motion.button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span style={{ color: slot.color, fontSize: "1.1rem", flexShrink: 0 }}>{slot.icon}</span>
          <span className="font-black text-sm tracking-widest uppercase truncate" style={{ color: slot.color }}>
            {slot.label}
          </span>
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: `${slot.color}22 transparent` }}>

        {/* Default / clear option — always first */}
        <PickerRow
          label={clear.label}
          desc={clear.desc}
          isSelected={isDefaultSelected}
          color={slot.color}
          onClick={() => onPick(slot, null)}
        />

        {ownedCatItems.length === 0 && (
          <div className="py-6 text-center">
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
            onClick={() => onPick(slot, item)}
          />
        ))}
      </div>
    </motion.div>
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
        <p className="text-white/35 text-[11px] leading-tight mt-0.5 line-clamp-1">{desc}</p>
      </div>
      {/* Equipped badge */}
      {isSelected && (
        <span className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md"
          style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}>
          EQUIPPED
        </span>
      )}
    </motion.button>
  );
}
