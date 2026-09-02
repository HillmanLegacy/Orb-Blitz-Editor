import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop, SHOP_ITEMS } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconResume()  { return <svg {..._svg}><path d="M7 4 L20 12 L7 20 Z" fill="currentColor" opacity="0.92"/></svg>; }
function IconShop()    { return <svg {..._svg}><path d="M6.5 7.5h11l-1.5 10h-8L6.5 7.5Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><path d="M9.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>; }
function IconStatus()  { return <svg {..._svg}><path d="M12 3 L20 7 V13 C20 17.4 16.5 21 12 22.5 C7.5 21 4 17.4 4 13 V7 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><circle cx="12" cy="10.5" r="1.5" fill="currentColor"/><line x1="12" y1="13.5" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconSound()   { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.85"/><path d="M15 8 C17 9.5 17.5 11.5 17.5 12 S17 14.5 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17.5 5.5 C20.5 7.5 21.5 9.8 21.5 12 S20.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconSoundOff(){ return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.5"/><line x1="16.5" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="22" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function IconQuit()    { return <svg {..._svg}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }

// ─── Shared design tokens ─────────────────────────────────────────────────────
const BTN_H    = "clamp(64px,11vw,88px)";
const ICON_SZ  = "clamp(1.2rem,3.2vw,1.7rem)";
const LABEL_SZ = "clamp(0.48rem,1.25vw,0.66rem)";

function TopLine({ color }: { color: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
      height: 2, opacity: 0.55,
      background: `linear-gradient(90deg,transparent 8%,${color}88 50%,transparent 92%)`,
    }} />
  );
}
function Scanlines() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
      borderRadius: "inherit",
    }} />
  );
}

interface BtnDef { id: string; icon: React.ReactNode; label: string; color: string; shadow: string; action: () => void; }

function OrbBtn({ b, maxW, pressed, setPressed }: { b: BtnDef; maxW: string; pressed: boolean; setPressed: (v: boolean) => void }) {
  return (
    <motion.button
      className="orblitz-command-button orblitz-pause-command relative flex flex-col items-center justify-center overflow-hidden flex-1"
      style={{
        position: "relative", minWidth: 0, maxWidth: maxW, height: BTN_H,
        borderRadius: "clamp(8px, 1.1vw, 14px)",
        border: `1px solid ${pressed ? b.color : b.color + "aa"}`,
        background: pressed
          ? `linear-gradient(145deg, ${b.color}70, ${b.color}28 64%, rgba(7,12,38,0.92))`
          : `linear-gradient(145deg, rgba(220,252,255,0.14), ${b.color}2b 42%, rgba(7,12,38,0.9) 100%)`,
        color: b.color,
        boxShadow: pressed
          ? `2px 3px 0 rgba(3,7,26,0.78), 0 0 30px ${b.shadow}, inset 0 0 20px ${b.color}35`
          : `5px 7px 0 rgba(3,7,26,0.72), 0 0 18px ${b.shadow}, inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 rgba(0,0,0,0.42)`,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        backdropFilter: "blur(8px)",
        transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s, transform 0.14s",
      }}
      variants={{
        hidden:  { opacity: 0, y: 14, scale: 0.88 },
        visible: { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", stiffness: 360, damping: 26 } },
      }}
      whileTap={{ scale: 0.9 }}
      onHoverStart={() => setPressed(true)}
      onHoverEnd={() => setPressed(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={b.action}
      aria-label={b.label}
      data-active={pressed}
    >
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: 3,
        background: `linear-gradient(90deg,${b.color}00 0%,${b.color}cc 20%,rgba(255,255,255,0.95) 50%,${b.color}22 80%,${b.color}00 100%)`,
        opacity: pressed ? 1 : 0.72,
        transition: "opacity 0.14s",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(132deg, rgba(255,255,255,0.11), transparent 30%, transparent 58%, rgba(0,0,0,0.22))",
        borderRadius: "inherit",
      }} />
      <Scanlines />
      <span style={{ fontSize: ICON_SZ, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 7px ${b.color}88) drop-shadow(2px 2px 0 rgba(3,7,26,0.55))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {b.icon}
      </span>
      <span style={{ fontSize: LABEL_SZ, fontWeight: 900, letterSpacing: "0.12em", lineHeight: 1, opacity: 0.96, fontFamily: "var(--font-display)" }}>
        {b.label}
      </span>
    </motion.button>
  );
}

function OrbButtonRow({ buttons, delayStart = 0 }: { buttons: BtnDef[]; delayStart?: number }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const maxW =
    buttons.length <= 2 ? "clamp(90px,28vw,180px)" :
    buttons.length === 3 ? "clamp(68px,21vw,140px)" :
    "clamp(56px,17vw,108px)";
  return (
    <motion.div
      className="flex flex-row items-stretch justify-center w-full"
      style={{ gap: "clamp(6px,1.8vw,14px)" }}
      initial="hidden" animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.06, delayChildren: delayStart } },
        hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
      }}
    >
      {buttons.map(b => (
        <OrbBtn key={b.id} b={b} maxW={maxW} pressed={pressed === b.id} setPressed={v => setPressed(v ? b.id : null)} />
      ))}
    </motion.div>
  );
}

// ─── Status Panel (read-only loadout) ─────────────────────────────────────────
const STATUS_SLOTS = [
  { key: "weapon",    label: "WEAPON",     icon: "⚡", color: "#ff7700", cat: "weapon"   },
  { key: "defense_0", label: "DEFENSE I",  icon: "◎", color: "#00ffff", cat: "defense",  defSlot: 0 },
  { key: "defense_1", label: "DEFENSE II", icon: "◎", color: "#22ddcc", cat: "defense",  defSlot: 1 },
  { key: "magi_orb",  label: "MAGI-ORB",  icon: "◆", color: "#8844ff", cat: "magi_orb" },
  { key: "skin",      label: "SKIN",       icon: "●", color: "#ff00ff", cat: "skin"     },
  { key: "trail",     label: "TRAIL",      icon: "≋", color: "#ddcc00", cat: "trail"    },
  { key: "ring",      label: "RING",       icon: "○", color: "#00ccee", cat: "ring"     },
] as const;

function resolveItemName(cat: string, value: string): string {
  if (!value || value === "none")    return "— none —";
  if (value === "default")           return "Default";
  return SHOP_ITEMS.find(i => i.category === cat && i.value === value)?.name ?? value;
}

function StatusPanel({ onClose }: { onClose: () => void }) {
  const {
    equippedSkin, equippedTrail, equippedRing,
    equippedWeapon, equippedDefenses, equippedMagiOrb,
  } = useShop();

  function getValue(slot: typeof STATUS_SLOTS[number]): string {
    switch (slot.cat) {
      case "weapon":   return equippedWeapon;
      case "defense":  return equippedDefenses[(slot as any).defSlot];
      case "magi_orb": return equippedMagiOrb;
      case "skin":     return equippedSkin;
      case "trail":    return equippedTrail;
      case "ring":     return equippedRing;
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto"
      style={{ padding: "clamp(12px,3vw,24px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ background: "rgba(0,0,8,0.88)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="relative flex flex-col w-full overflow-hidden"
        style={{
          maxWidth: "min(440px,100%)",
          maxHeight: "min(88vh,640px)",
          background: "rgba(4,4,18,0.97)",
          border: "1px solid rgba(170,0,255,0.22)",
          borderRadius: "clamp(16px,2.5vw,24px)",
          backdropFilter: "blur(32px)",
          boxShadow: "0 0 60px rgba(170,0,255,0.1), 0 24px 80px rgba(0,0,0,0.75)",
        }}
        initial={{ scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1,   y: 0,  opacity: 1 }}
        exit={{ scale: 0.9,   y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,255,255,0.007) 5px,rgba(255,255,255,0.007) 6px)" }} />
        </div>

        {/* Header */}
        <div className="relative flex-none flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 1 }}>
          <div>
            <span className="font-black text-lg tracking-[0.18em] uppercase"
              style={{
                background: "linear-gradient(90deg,#aa00ff,#ff00ff,#00ffff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 8px rgba(170,0,255,0.5))",
              }}>
              LOADOUT
            </span>
            <p className="text-[9px] font-black tracking-[0.2em] uppercase mt-0.5"
              style={{ color: "rgba(255,255,255,0.22)" }}>
              EQUIP VIA MAIN MENU · BETWEEN LEVELS
            </p>
          </div>
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
        <div className="relative flex-1 min-h-0 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(170,0,255,0.15) transparent", zIndex: 1 }}>
          <div className="grid grid-cols-2 gap-2.5">
            {STATUS_SLOTS.map(slot => {
              const val      = getValue(slot);
              const name     = resolveItemName(slot.cat, val);
              const hasItem  = val !== "none" && val !== "default" && !!val;
              return (
                <div
                  key={slot.key}
                  className="relative flex items-center gap-2.5 rounded-xl px-3 py-3 overflow-hidden"
                  style={{
                    background: hasItem ? `${slot.color}0c` : "rgba(255,255,255,0.025)",
                    border: `1px solid ${hasItem ? slot.color + "44" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {hasItem && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: `radial-gradient(ellipse at 0% 50%, ${slot.color}12 0%, transparent 70%)`,
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
                    <p className="font-semibold text-xs leading-tight truncate mt-0.5"
                      style={{ color: hasItem ? "#fff" : "rgba(255,255,255,0.28)" }}>{name}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lock notice */}
          <div className="mt-4 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.4 }}>🔒</span>
            <p className="text-[10px] font-bold tracking-widest uppercase text-center"
              style={{ color: "rgba(255,255,255,0.25)" }}>
              Gear changes locked during gameplay
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PauseMenu({ onMainMenu }: { onMainMenu?: () => void }) {
  const { phase, resumeGame, score } = useMagicOrb();
  const { openShop, shopOpen, inventoryOpen } = useShop();
  const { isMuted, toggleMute, playLevelSelect, playExitToMenu, stopArcadeBgm } = useAudio();
  const [statusOpen, setStatusOpen] = useState(false);

  if (phase !== "paused" || shopOpen || inventoryOpen) return null;

  const sfx = () => { try { playLevelSelect(); } catch {} };

  const topRow: BtnDef[] = [
    {
      id: "resume", icon: <IconResume />, label: "RESUME",
      color: "#00ffff", shadow: "rgba(0,255,255,0.45)",
      action: () => { sfx(); useOrbTransition.getState().fastSweep(resumeGame); },
    },
    {
      id: "shop", icon: <IconShop />, label: "SHOP",
      color: "#ff00ff", shadow: "rgba(255,0,255,0.45)",
      action: () => { sfx(); openShop(); },
    },
    {
      id: "status", icon: <IconStatus />, label: "STATUS",
      color: "#aa00ff", shadow: "rgba(170,0,255,0.45)",
      action: () => { sfx(); setStatusOpen(true); },
    },
  ];

  const soundColor  = isMuted ? "#667788" : "#00ffff";
  const soundShadow = isMuted ? "rgba(100,110,130,0.22)" : "rgba(0,255,255,0.45)";

  const bottomRow: BtnDef[] = [
    {
      id: "sound", icon: isMuted ? <IconSoundOff /> : <IconSound />,
      label: isMuted ? "MUTED" : "SOUND",
      color: soundColor, shadow: soundShadow,
      action: () => { sfx(); toggleMute(); },
    },
    {
      id: "quit", icon: <IconQuit />, label: "QUIT",
      color: "#667788", shadow: "rgba(100,110,130,0.22)",
      action: () => {
        try { playExitToMenu(); } catch {}
        try { stopArcadeBgm(); } catch {}
        useOrbTransition.getState().fastSweep(() => {
          onMainMenu?.();
          useMagicOrb.getState().setPhase("menu");
        });
      },
    },
  ];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black pointer-events-auto select-none orblitz-pause-screen"
        style={{ padding: "clamp(12px,3vh,28px) clamp(12px,4vw,32px)", backgroundColor: "rgba(5,8,28,0.34)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Main-menu atmosphere carried into the combat hold state. */}
        <div className="absolute inset-0 pointer-events-none" style={{
          opacity: 0.9,
          background: "radial-gradient(ellipse at 50% 42%, rgba(67,22,134,0.3) 0%, rgba(9,70,105,0.18) 42%, transparent 80%), linear-gradient(135deg, rgba(4,17,57,0.16), rgba(60,8,72,0.18) 52%, rgba(0,42,60,0.16))",
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(0,246,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,43,214,0.17) 1px, transparent 1px)",
          backgroundSize: "clamp(26px, 3.7vw, 54px) clamp(26px, 3.7vw, 54px)",
          maskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
          opacity: 0.16,
        }} />
        <div className="absolute inset-0 pointer-events-none orblitz-pause-orbit" />
        <div className="absolute left-[14%] top-[24%] h-2 w-2 rounded-sm pointer-events-none" style={{ background: "#ffe600", boxShadow: "0 0 24px 7px rgba(255,230,0,0.38)" }} />
        <div className="absolute right-[18%] bottom-[28%] h-1.5 w-1.5 rounded-sm pointer-events-none" style={{ background: "#ff2bd6", boxShadow: "0 0 20px 6px rgba(255,43,214,0.38)" }} />

        <motion.div
          className="relative z-10 w-full flex flex-col items-center gap-3 orblitz-pause-content"
          style={{ maxWidth: "clamp(300px,90vw,520px)", maxHeight: "calc(100dvh - 24px)", overflowY: "auto", padding: "clamp(8px,2vh,18px) 0" }}
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1,   opacity: 1, y: 0  }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {/* Title */}
          <div className="text-center">
            <p className="orblitz-pause-kicker">ORBLITZ / COMBAT BREAK</p>
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(2.4rem,8vw,4.2rem)", lineHeight: 0.95,
                fontFamily: "Arial Black, Impact, sans-serif",
                letterSpacing: "0.075em",
                WebkitTextStroke: "1px rgba(210,252,255,0.22)",
                backgroundImage: "linear-gradient(135deg,#e8fcff 0%,#00f6ff 27%,#aa00ff 58%,#ff2bd6 82%,#ffe600 100%)",
              }}
              animate={{ filter: [
                "drop-shadow(0 0 14px rgba(0,255,255,0.45)) drop-shadow(0 0 28px rgba(255,0,255,0.2))",
                "drop-shadow(0 0 22px rgba(255,0,255,0.55)) drop-shadow(0 0 44px rgba(0,255,255,0.25))",
                "drop-shadow(0 0 14px rgba(0,255,255,0.45)) drop-shadow(0 0 28px rgba(255,0,255,0.2))",
              ]}}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              PAUSED
            </motion.h1>

            <div className="mt-2 mx-auto" style={{
              height: "clamp(4px,0.7vw,7px)", width: "clamp(140px,36vw,250px)",
              borderRadius: 3,
              background: "linear-gradient(90deg,transparent 0%,#00f6ff 18%,#ff2bd6 36%,#ffe600 54%,#7cff00 72%,#9b5cff 88%,transparent 100%)",
              boxShadow: "0 4px 0 rgba(10,20,68,0.45), 0 0 16px rgba(0,246,255,0.5)",
              opacity: 0.7,
            }} />
            <p className="orblitz-pause-status">TAKE A BREATH · YOUR RUN IS SAFE</p>
          </div>

          {/* Score pill */}
          <motion.div
            className="flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(7,12,38,0.72))", border: "1px solid rgba(0,246,255,0.3)", boxShadow: "4px 5px 0 rgba(5,10,34,0.45), 0 0 18px rgba(0,246,255,0.12), inset 0 1px 0 rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          >
            <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.2em", fontWeight: 700 }}>SCORE</span>
            <span className="font-black text-transparent bg-clip-text"
              style={{ fontSize: "clamp(1rem,2.5vw,1.4rem)", lineHeight: 1, backgroundImage: "linear-gradient(90deg,#00ffff,#aa00ff,#ff00ff)" }}>
              {score}
            </span>
          </motion.div>

          <div className="w-full orblitz-pause-deck">
            {/* Primary row: RESUME · SHOP · STATUS */}
            <OrbButtonRow buttons={topRow} delayStart={0.05} />
            {/* Secondary row: SOUND · QUIT */}
            <OrbButtonRow buttons={bottomRow} delayStart={0.18} />
            <p className="orblitz-pause-deck-label">PAUSED · CHOOSE YOUR NEXT MOVE</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Status overlay — rendered above pause menu */}
      <AnimatePresence>
        {statusOpen && <StatusPanel onClose={() => setStatusOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
