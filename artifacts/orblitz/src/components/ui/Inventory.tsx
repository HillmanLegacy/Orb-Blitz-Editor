import { motion, AnimatePresence } from "framer-motion";
import { useShop, SHOP_ITEMS, ShopItem, OrbSkin, TrailEffect, RingStyle, WeaponType, DefenseType, MagiOrbType } from "@/lib/stores/useShop";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useModalAccessibility } from "@/components/ui/useModalAccessibility";
import { getWeaponProgress, isProgressionWeapon, type ProgressionWeapon } from "@/game-runtime/WeaponProgression";

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

type GearStat = { label: string; value: string };
type GearDetail = { role: string; stats: GearStat[]; mechanic: string };

const CLEAR_ITEM_ID = "__loadout_clear__";

const SPECIFIC_GEAR_STATS: Record<string, GearStat[]> = {
  orbital_rapid_blaster: [
    { label: "RATE", value: "6 shots / sec" },
    { label: "PATTERN", value: "Single fire" },
    { label: "DAMAGE", value: "1 enemy / shot" },
  ],
  orbital_scattershot: [
    { label: "VOLLEY", value: "3 projectiles" },
    { label: "PATTERN", value: "Wedge spread" },
    { label: "DAMAGE", value: "1 enemy / shot" },
  ],
  spiral_shooter: [
    { label: "VOLLEY", value: "3 spiral shots" },
    { label: "PIERCE", value: "Up to 3 enemies" },
    { label: "TRADEOFF", value: "1 particle / hit" },
  ],
  overcharged_blaster: [
    { label: "RATE", value: "1 shot / 1.5 sec" },
    { label: "POWER", value: "5 boss damage" },
    { label: "CLEAR", value: "Enemies + projectiles" },
  ],
  homing_launcher: [
    { label: "TARGETING", value: "Nearest enemy" },
    { label: "TRACKING", value: "Homing" },
    { label: "ROLE", value: "Auto-aim pressure" },
  ],
  sub_blaster: [
    { label: "PLATFORM", value: "Autonomous orb" },
    { label: "TARGETING", value: "Nearby enemies" },
    { label: "FIRE", value: "Automatic" },
  ],
  orbital_teletransfer: [
    { label: "RANGE", value: "Any location" },
    { label: "COOLDOWN", value: "5 seconds" },
    { label: "INPUT", value: "Tap to trigger" },
  ],
  distort_field: [
    { label: "DURATION", value: "5 seconds" },
    { label: "COOLDOWN", value: "5 seconds" },
    { label: "EFFECT", value: "Stops enemies" },
  ],
  pulse_shield: [
    { label: "RANGE", value: "Close-range" },
    { label: "COOLDOWN", value: "5 seconds" },
    { label: "EFFECT", value: "Reflects enemies" },
  ],
  defense_system: [
    { label: "ORBS", value: "5 perishable" },
    { label: "ROLE", value: "Orbiting defense" },
    { label: "TRIGGER", value: "Enemy collision" },
  ],
  spatial_relocation: [
    { label: "TRIGGER", value: "On damage" },
    { label: "EFFECT", value: "Nearby teleport" },
    { label: "ROLE", value: "Emergency escape" },
  ],
  restoration: [
    { label: "RECOVERY", value: "+1 HP" },
    { label: "INTERVAL", value: "10 seconds" },
    { label: "ROLE", value: "Sustain" },
  ],
  armor: [
    { label: "BONUS", value: "+3 max HP" },
    { label: "TRIGGER", value: "Always active" },
    { label: "ROLE", value: "Durability" },
  ],
  magi_orb_1: [
    { label: "MOVEMENT", value: "Circular pattern" },
    { label: "ROLE", value: "Evasion" },
    { label: "TRIGGER", value: "Always active" },
  ],
  magi_orb_2: [
    { label: "COOLDOWN", value: "15 seconds" },
    { label: "EFFECT", value: "Clears non-bosses" },
    { label: "BONUS", value: "Energy siphon" },
  ],
  magi_orb_3: [
    { label: "VOLLEY", value: "10 projectiles" },
    { label: "TARGETING", value: "Indirect homing" },
    { label: "TRIGGER", value: "Activated" },
  ],
  magi_orb_4: [
    { label: "DURATION", value: "10 seconds" },
    { label: "COOLDOWN", value: "15 seconds" },
    { label: "FORM", value: "Quarter barrier" },
  ],
  magi_orb_5: [
    { label: "SHIELD HP", value: "5 HP" },
    { label: "ROLE", value: "Damage buffer" },
    { label: "FORM", value: "Protective cube" },
  ],
  magi_orb_6: [
    { label: "INTERVAL", value: "5 seconds" },
    { label: "EFFECT", value: "Random teleport" },
    { label: "ROLE", value: "Displacement" },
  ],
  magi_orb_7: [
    { label: "SLOW", value: "25% enemy speed" },
    { label: "COOLDOWN", value: "15 seconds" },
    { label: "RANGE", value: "360-degree pulse" },
  ],
  magi_orb_8: [
    { label: "ALLY HP", value: "Player max HP" },
    { label: "FIRE", value: "Fires with player" },
    { label: "PLACEMENT", value: "Random orbit" },
  ],
  magi_orb_9: [
    { label: "INTERVAL", value: "15 seconds" },
    { label: "EFFECT", value: "Resets spawn rate" },
    { label: "ROLE", value: "Crowd control" },
  ],
};

function getGearDetail(item: ShopItem | null, slot: SlotDef): GearDetail {
  if (!item) {
    return {
      role: "EMPTY SLOT",
      stats: [
        { label: "STATUS", value: "Offline" },
        { label: "EFFECT", value: "No gear active" },
        { label: "SLOT", value: slot.label },
      ],
      mechanic: clearMeta(slot.cat).desc,
    };
  }

  const categoryStats: Record<Category, GearStat[]> = {
    weapon: [
      { label: "TYPE", value: "Combat weapon" },
      { label: "PROGRESSION", value: "Run XP enabled" },
      { label: "SLOT", value: "Primary" },
    ],
    defense: [
      { label: "TYPE", value: "Defensive system" },
      { label: "SLOTS", value: "1 of 2" },
      { label: "ROLE", value: "Survival" },
    ],
    magi_orb: [
      { label: "TYPE", value: "Arcane system" },
      { label: "SLOT", value: "1 active" },
      { label: "ROLE", value: "Special ability" },
    ],
    skin: [
      { label: "TYPE", value: "Visual shell" },
      { label: "COMBAT", value: "No stat change" },
      { label: "EFFECT", value: "Player appearance" },
    ],
    trail: [
      { label: "TYPE", value: "Projectile VFX" },
      { label: "COMBAT", value: "No stat change" },
      { label: "EFFECT", value: "Shot presentation" },
    ],
    aura: [
      { label: "TYPE", value: "Player VFX" },
      { label: "COMBAT", value: "No stat change" },
      { label: "EFFECT", value: "Orbital presentation" },
    ],
  };

  return {
    role: item.category === "magi_orb" ? "SPECIAL SYSTEM" : `${item.category.toUpperCase()} MODULE`,
    stats: SPECIFIC_GEAR_STATS[item.value as string] ?? categoryStats[item.category],
    mechanic: item.description,
  };
}

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
export function Inventory({ onExitComplete }: { onExitComplete?: () => void }) {
  const {
    inventoryOpen, closeInventory,
    ownedItems,
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
    weaponProgression,
    equipSkin, equipTrail, equipRing, equipWeapon, equipDefense, equipMagiOrb,
  } = useShop(useShallow((s) => ({
    inventoryOpen: s.inventoryOpen,
    closeInventory: s.closeInventory,
    ownedItems: s.ownedItems,
    equippedSkin: s.equippedSkin,
    equippedTrail: s.equippedTrail,
    equippedRing: s.equippedRing,
    equippedWeapon: s.equippedWeapon,
    equippedDefenses: s.equippedDefenses,
    equippedMagiOrb: s.equippedMagiOrb,
    weaponProgression: s.weaponProgression,
    equipSkin: s.equipSkin,
    equipTrail: s.equipTrail,
    equipRing: s.equipRing,
    equipWeapon: s.equipWeapon,
    equipDefense: s.equipDefense,
    equipMagiOrb: s.equipMagiOrb,
  })));

  const [activeSlot, setActiveSlot] = useState<SlotDef>(SLOTS[0]);
  const [selectedItemId, setSelectedItemId] = useState(CLEAR_ITEM_ID);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const dialogRef = useModalAccessibility<HTMLDivElement>(
    inventoryOpen,
    closeInventory,
    '[data-orblitz-modal-opener="inventory"]',
  );

  const eq: EquippedState = useMemo(() => ({
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
  }), [equippedSkin, equippedTrail, equippedRing, equippedWeapon, equippedDefenses, equippedMagiOrb]);

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

  const ownedCatItems = useMemo(() => SHOP_ITEMS.filter(
    i => i.category === slot.cat && ownedItems.includes(i.id)
  ), [ownedItems, slot.cat]);

  useEffect(() => {
    const equippedItem = ownedCatItems.find(item => item.value === currentVal);
    setSelectedItemId(equippedItem?.id ?? CLEAR_ITEM_ID);
  }, [activeSlot.key, inventoryOpen, ownedCatItems]);

  const selectedItem = selectedItemId === CLEAR_ITEM_ID
    ? null
    : ownedCatItems.find(item => item.id === selectedItemId) ?? null;
  const selectedIsEquipped = selectedItem
    ? currentVal === selectedItem.value
    : isDefaultSelected;
  const actionDisabled = !selectedItem && isDefaultSelected;
  const detail = getGearDetail(selectedItem, slot);
  const selectedWeaponProgress = selectedItem
    && selectedItem.category === "weapon"
    && isProgressionWeapon(selectedItem.value as WeaponType)
    ? getWeaponProgress(
        selectedItem.value as ProgressionWeapon,
        weaponProgression[selectedItem.value as ProgressionWeapon],
      )
    : null;

  const handleDetailAction = () => {
    if (selectedItem) {
      doEquip(slot, selectedIsEquipped ? null : selectedItem);
      return;
    }
    if (!isDefaultSelected) doEquip(slot, null);
  };

  const handleInspect = () => {
    if (selectedItem) setInspectionOpen(true);
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {inventoryOpen && <motion.div
        className="orblitz-loadout-screen fixed inset-0 z-50 flex items-center justify-center"
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
          aria-hidden="true"
        />

        {/* Card — matches Shop dimensions exactly */}
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="orblitz-loadout-title"
          tabIndex={-1}
          className="orblitz-loadout-dialog relative flex flex-col w-full"
          style={{
            maxWidth: "min(1080px, 100%)",
            maxHeight: "min(90vh, 760px)",
            background: "rgba(4,4,18,0.97)",
            border: "1px solid rgba(0,255,255,0.18)",
            borderRadius: "clamp(18px, 2.5vw, 26px)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 0 100px rgba(0,255,255,0.08), 0 28px 90px rgba(0,0,0,0.78)",
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
          <div className="orblitz-loadout-header relative flex-none flex items-center justify-between px-5 pt-4 pb-3" style={{ zIndex: 1 }}>
            <div>
              <span
                id="orblitz-loadout-title"
                className="orblitz-loadout-title font-black text-lg tracking-[0.18em] uppercase"
              >
                LOADOUT
              </span>
            </div>
            <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={closeInventory}
              aria-label="Close loadout"
              title="Close loadout"
              className="orblitz-loadout-close flex items-center justify-center rounded-lg"
              style={{
                width: 32, height: 32,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer",
              }}
            >
              ×
            </motion.button>
            </div>
          </div>

          {/* ── Body: slot rail + item picker + detail panel ─────────────── */}
          <div className="orblitz-modal-body orblitz-loadout-body relative flex flex-1 min-h-0 flex-col min-[760px]:flex-row" style={{ zIndex: 1 }}>

            {/* Slot rail — every gear slot is always one tap away */}
            <div
              className="orblitz-modal-sidebar orblitz-loadout-slots flex-none flex flex-col max-[759px]:flex-row max-[759px]:overflow-x-auto max-[759px]:!w-full max-[759px]:!border-r-0 max-[759px]:border-b gap-1 py-3 px-2"
              style={{
                width: "clamp(148px, 18%, 184px)",
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
                    onClick={() => { setActiveSlot(s); setInspectionOpen(false); }}
                    aria-pressed={active}
                    aria-label={`Edit ${s.label.toLowerCase()}`}
                    data-testid={`button-loadout-slot-${s.key}`}
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

            {/* Item picker for the active slot */}
            <div className="orblitz-loadout-picker flex flex-col flex-1 min-w-0">

              <div className="orblitz-loadout-panel-head flex-none flex items-center justify-between px-4 py-3">
                <div>
                  <p className="orblitz-loadout-panel-title" style={{ color: slot.color }}>{slot.label}</p>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "thin", scrollbarColor: `${slot.color}22 transparent` }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slot.key}
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <PickerRow
                      label={clear.label}
                      desc={clear.desc}
                      isFocused={selectedItemId === CLEAR_ITEM_ID}
                      isEquipped={isDefaultSelected}
                      color={slot.color}
                      onClick={() => { setSelectedItemId(CLEAR_ITEM_ID); setInspectionOpen(false); }}
                      itemId={`${slot.key}-clear`}
                    />

                    {ownedCatItems.length === 0 && (
                      <div className="orblitz-loadout-empty py-8 text-center">
                        <p className="text-white/20 text-sm uppercase tracking-widest">No items owned</p>
                        <p className="text-white/15 text-xs mt-1">Visit the Shop to get some!</p>
                      </div>
                    )}

                    {ownedCatItems.map(item => (
                      <PickerRow
                        key={item.id}
                        label={item.name}
                        desc={item.description}
                        isFocused={selectedItemId === item.id}
                        isEquipped={currentVal === item.value}
                        color={slot.color}
                        onClick={() => { setSelectedItemId(item.id); setInspectionOpen(true); }}
                        itemId={item.id}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Selected item detail and explicit equip action */}
            <aside className="orblitz-gear-detail flex flex-col min-w-0" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedItem?.id ?? CLEAR_ITEM_ID}
                  className="flex flex-col h-full"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="orblitz-gear-detail-head">
                    <div className="orblitz-gear-detail-icon" style={{ color: slot.color, borderColor: `${slot.color}55`, background: `${slot.color}16`, boxShadow: `0 0 24px ${slot.shadow}` }}>
                      {slot.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="orblitz-gear-detail-title">{selectedItem?.name ?? clear.label}</h3>
                    </div>
                  </div>

                  <div className="orblitz-gear-action-dock">
                    <div className="orblitz-gear-action-row">
                      <motion.button
                        whileTap={{ scale: selectedItem ? 0.97 : 1 }}
                        type="button"
                        onClick={handleInspect}
                        disabled={!selectedItem}
                        data-testid="button-loadout-inspect"
                        className="orblitz-gear-inspect"
                        style={{
                          color: !selectedItem ? "rgba(255,255,255,0.22)" : slot.color,
                          borderColor: !selectedItem ? "rgba(255,255,255,0.1)" : `${slot.color}55`,
                          background: !selectedItem ? "rgba(255,255,255,0.04)" : `${slot.color}0d`,
                        }}
                      >
                        INSPECT
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: actionDisabled ? 1 : 0.97 }}
                        type="button"
                        onClick={handleDetailAction}
                        disabled={actionDisabled}
                        data-testid="button-loadout-equip"
                        className="orblitz-gear-action"
                        style={{
                          color: actionDisabled ? "rgba(255,255,255,0.22)" : slot.color,
                          borderColor: actionDisabled ? "rgba(255,255,255,0.1)" : `${slot.color}66`,
                          background: actionDisabled ? "rgba(255,255,255,0.04)" : `${slot.color}14`,
                          boxShadow: actionDisabled ? "none" : `0 0 22px ${slot.shadow}`,
                        }}
                      >
                        {selectedItem && selectedIsEquipped ? "UNEQUIP" : selectedItem ? "EQUIP GEAR" : "UNEQUIP SLOT"}
                      </motion.button>
                    </div>
                  </div>

                  <div className="orblitz-gear-stats">
                    {detail.stats.map(stat => (
                      <div key={stat.label} className="orblitz-gear-stat">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="orblitz-gear-mechanics">
                    <p className="orblitz-loadout-panel-kicker">MECHANICS</p>
                    <p>{detail.mechanic}</p>
                  </div>

                  {selectedWeaponProgress && (
                    <div className="orblitz-gear-progression">
                      <div className="flex items-center justify-between gap-2">
                        <span>WEAPON LEVEL {selectedWeaponProgress.level}</span>
                        <span>{selectedWeaponProgress.isMaxLevel ? "MAX / Lv3" : `${selectedWeaponProgress.xp} / ${selectedWeaponProgress.nextThreshold} XP`}</span>
                      </div>
                      <div className="orblitz-gear-progress-track">
                        <div className="orblitz-gear-progress-fill" style={{ width: `${selectedWeaponProgress.progressPercent}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1" style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.38)" }}>
                        <span>{selectedWeaponProgress.isMaxLevel ? "LEVEL CAP REACHED" : `${selectedWeaponProgress.xpRemaining} XP TO NEXT LEVEL`}</span>
                        <span>LEVEL-RELATIVE XP</span>
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </aside>
          </div>
        </motion.div>

        {inspectionOpen && selectedItem && typeof document !== "undefined" && createPortal(
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <button
                type="button"
                className="absolute inset-0 cursor-pointer"
                style={{ border: 0, background: "rgba(0,0,8,0.72)", backdropFilter: "blur(10px)" }}
                onClick={() => setInspectionOpen(false)}
                aria-label="Close gear inspection"
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="orblitz-inspection-title"
                className="orblitz-gear-inspection relative w-full"
                initial={{ scale: 0.9, y: 18, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, y: 12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="orblitz-gear-inspection-line" style={{ background: slot.color, boxShadow: `0 0 18px ${slot.color}` }} />
                <div className="orblitz-gear-inspection-header">
                  <div>
                    <p className="orblitz-loadout-kicker">MODULE INSPECTION / {slot.label}</p>
                    <h2 id="orblitz-inspection-title">{selectedItem.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectionOpen(false)}
                    aria-label="Close gear inspection"
                    title="Close inspection"
                    className="orblitz-gear-inspection-close"
                    data-testid="button-close-loadout-inspect"
                  >
                    ×
                  </button>
                </div>

                <div className="orblitz-gear-inspection-stats">
                  {detail.stats.map(stat => (
                    <div key={stat.label} className="orblitz-gear-inspection-stat">
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="orblitz-gear-inspection-mechanics">
                  <p className="orblitz-loadout-panel-kicker">HOW IT WORKS</p>
                  <p>{detail.mechanic}</p>
                </div>

                {selectedWeaponProgress && (
                  <div className="orblitz-gear-progression">
                    <div className="flex items-center justify-between gap-2">
                      <span>WEAPON LEVEL {selectedWeaponProgress.level}</span>
                      <span>{selectedWeaponProgress.isMaxLevel ? "MAX / Lv3" : `${selectedWeaponProgress.xp} / ${selectedWeaponProgress.nextThreshold} XP`}</span>
                    </div>
                    <div className="orblitz-gear-progress-track">
                      <div className="orblitz-gear-progress-fill" style={{ width: `${selectedWeaponProgress.progressPercent}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1" style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.38)" }}>
                      <span>{selectedWeaponProgress.isMaxLevel ? "LEVEL CAP REACHED" : `${selectedWeaponProgress.xpRemaining} XP TO NEXT LEVEL`}</span>
                      <span>LEVEL-RELATIVE XP</span>
                    </div>
                  </div>
                )}

                <p className="orblitz-gear-inspection-footer">
                  Close this readout to equip or unequip the selected module.
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
      </motion.div>}
    </AnimatePresence>
  );
}

// ─── Single picker row ────────────────────────────────────────────────────────
function PickerRow({ label, desc, isFocused, isEquipped, color, onClick, itemId }: {
  label: string; desc: string; isFocused: boolean; isEquipped: boolean; color: string; onClick: () => void; itemId: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      type="button"
      aria-pressed={isFocused}
      data-testid={`button-loadout-item-${itemId}`}
      className="w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl"
      style={{
        background: isFocused ? `${color}12` : isEquipped ? `${color}08` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isFocused ? color + "66" : isEquipped ? color + "35" : "rgba(255,255,255,0.07)"}`,
        boxShadow: isFocused ? `0 0 16px ${color}30` : "none",
        cursor: "pointer",
        transition: "all 0.14s",
      }}
    >
      {/* Selection dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
         background: isFocused || isEquipped ? color : "rgba(255,255,255,0.12)",
         boxShadow: isFocused || isEquipped ? `0 0 8px ${color}` : "none",
        transition: "all 0.14s",
      }} />
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-white leading-tight truncate">{label}</p>
        <p className="text-white/35 text-[11px] leading-tight mt-0.5">{desc}</p>
      </div>
      {/* Equipped badge */}
      {isEquipped && (
        <span
          className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md"
          style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
        >
          EQUIPPED
        </span>
      )}
      {isFocused && !isEquipped && (
        <span
          className="flex-shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md"
          style={{ color, background: `${color}12`, border: `1px solid ${color}35` }}
        >
          INSPECT
        </span>
      )}
    </motion.button>
  );
}
