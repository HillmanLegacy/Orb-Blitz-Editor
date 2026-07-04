import { motion } from "framer-motion";
import { useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconResume()    { return <svg {..._svg}><path d="M7 4 L20 12 L7 20 Z" fill="currentColor" opacity="0.92"/></svg>; }
function IconShop()      { return <svg {..._svg}><path d="M6.5 7.5h11l-1.5 10h-8L6.5 7.5Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><path d="M9.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>; }
function IconGear()      { return <svg {..._svg}><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.06" strokeDasharray="2 1.5"/></svg>; }
function IconSound()     { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.85"/><path d="M15 8 C17 9.5 17.5 11.5 17.5 12 S17 14.5 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17.5 5.5 C20.5 7.5 21.5 9.8 21.5 12 S20.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconSoundOff()  { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.5"/><line x1="16.5" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="22" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function IconQuit()      { return <svg {..._svg}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }

// ─── Shared button primitives ─────────────────────────────────────────────────
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
      className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
      style={{
        minWidth: 0, maxWidth: maxW, height: BTN_H,
        borderRadius: "clamp(10px,1.6vw,14px)",
        border: `1.5px solid ${pressed ? b.color + "cc" : b.color + "55"}`,
        background: pressed ? `${b.color}20` : `linear-gradient(160deg,${b.color}10 0%,${b.color}06 100%)`,
        color: b.color,
        boxShadow: pressed
          ? `0 0 24px ${b.shadow}, 0 0 48px ${b.shadow}, inset 0 0 14px ${b.color}14`
          : `0 0 12px ${b.shadow}, inset 0 1px 0 ${b.color}14`,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
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
    >
      <TopLine color={b.color} />
      <Scanlines />
      <span style={{ fontSize: ICON_SZ, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 5px ${b.color}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {b.icon}
      </span>
      <span style={{ fontSize: LABEL_SZ, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
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

// ─── Main component ───────────────────────────────────────────────────────────
export function PauseMenu() {
  const { phase, resumeGame, startLoading, score } = useMagicOrb();
  const { openShop, openInventory, shopOpen, inventoryOpen } = useShop();
  const { isMuted, toggleMute, playMenuSelect } = useAudio();

  if (phase !== "paused" || shopOpen || inventoryOpen) return null;

  const sfx = () => { try { playMenuSelect(); } catch {} };

  const topRow: BtnDef[] = [
    { id: "resume", icon: <IconResume />, label: "RESUME", color: "#00ffff", shadow: "rgba(0,255,255,0.45)",  action: () => { sfx(); resumeGame(); } },
    { id: "shop",   icon: <IconShop />,   label: "SHOP",   color: "#ff00ff", shadow: "rgba(255,0,255,0.45)",  action: () => { sfx(); openShop(); } },
    { id: "gear",   icon: <IconGear />,   label: "GEAR",   color: "#aa00ff", shadow: "rgba(170,0,255,0.45)",  action: () => { sfx(); openInventory(); } },
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
    { id: "quit", icon: <IconQuit />, label: "QUIT", color: "#667788", shadow: "rgba(100,110,130,0.22)", action: () => { sfx(); startLoading("exiting_to_menu"); } },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black pointer-events-auto select-none"
      style={{ padding: "clamp(12px,3vh,28px) clamp(12px,4vw,32px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,255,255,0.06) 0%, rgba(170,0,255,0.05) 50%, transparent 75%)",
      }} />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.008) 3px,rgba(0,255,255,0.008) 4px)",
      }} />

      <motion.div
        className="relative z-10 w-full flex flex-col items-center gap-3"
        style={{ maxWidth: "clamp(300px,90vw,440px)" }}
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1,   opacity: 1, y: 0  }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Title */}
        <div className="text-center">
          <motion.h1
            className="font-black tracking-widest text-transparent bg-clip-text"
            style={{
              fontSize: "clamp(2rem,8vw,3.2rem)", lineHeight: 1,
              backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 45%,#ff00ff 75%,#ffff00 100%)",
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

          {/* Underline */}
          <div className="mt-2 mx-auto" style={{
            height: 1, width: "clamp(80px,30%,160px)",
            background: "linear-gradient(90deg,transparent,#00ffff 35%,#ff00ff 65%,transparent)",
            opacity: 0.5,
          }} />
        </div>

        {/* Score pill */}
        <motion.div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,255,255,0.12)" }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        >
          <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.2em", fontWeight: 700 }}>SCORE</span>
          <span className="font-black text-transparent bg-clip-text"
            style={{ fontSize: "clamp(1rem,2.5vw,1.4rem)", lineHeight: 1, backgroundImage: "linear-gradient(90deg,#00ffff,#aa00ff,#ff00ff)" }}>
            {score}
          </span>
        </motion.div>

        {/* Primary row: RESUME · SHOP · GEAR */}
        <div className="w-full">
          <OrbButtonRow buttons={topRow} delayStart={0.05} />
        </div>

        {/* Secondary row: SOUND · QUIT */}
        <div className="w-full">
          <OrbButtonRow buttons={bottomRow} delayStart={0.18} />
        </div>
      </motion.div>
    </motion.div>
  );
}
