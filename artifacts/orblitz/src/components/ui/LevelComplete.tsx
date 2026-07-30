import { motion } from "framer-motion";
import { useMemo } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── Palette ───────────────────────────────────────────────────────────────────
const CYAN   = "#00ffff";
const PURPLE = "#a78bfa";
const PINK   = "#f472b6";
const GOLD   = "#fbbf24";

const levelColors: Record<number, { primary: string; secondary: string; name: string }> = {
  1: { primary: "#00ffff", secondary: "#0088ff", name: "Sky Realm"       },
  2: { primary: "#ff00ff", secondary: "#8800ff", name: "Void Dimension"  },
  3: { primary: "#ffff00", secondary: "#ff8800", name: "Solar Expanse"   },
  4: { primary: "#00ff88", secondary: "#00aa44", name: "Forest Kingdom"  },
  5: { primary: "#ff4488", secondary: "#cc0044", name: "Crystal Caves"   },
  6: { primary: "#8888ff", secondary: "#4444cc", name: "Storm Peaks"     },
  7: { primary: "#ff8844", secondary: "#cc4400", name: "Lava Fields"     },
  8: { primary: "#44ffff", secondary: "#00cccc", name: "Ocean Depths"    },
  9: { primary: "#ffff88", secondary: "#cccc00", name: "Star Core"       },
};

const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  return (15 + (world - 1) * 10) + (sub - 1) * 5;
};

export function LevelComplete() {
  const { completedLevel, score } = useMagicOrb();

  const levelToShow = completedLevel || 1.1;
  const world    = Math.floor(levelToShow);
  const subLevel = Math.round((levelToShow % 1) * 10);
  const colors   = levelColors[world] || levelColors[1];
  const isBoss   = subLevel === 9;
  const orbGoal  = getOrbGoal(world, subLevel);

  const primary   = isBoss ? GOLD   : colors.primary;
  const secondary = isBoss ? PINK   : colors.secondary;
  const tertiary  = isBoss ? PURPLE : CYAN;

  // ── Deterministic ambient orbs (no Math.random in render) ─────────────────
  const floatingOrbs = useMemo(() => {
    const palette = [CYAN, PURPLE, PINK, "#00ff88", "#ff8800"];
    return Array.from({ length: 20 }, (_, i) => ({
      left:     `${(i * 41 + 7)  % 100}%`,
      top:      `${(i * 57 + 13) % 100}%`,
      size:     44 + (i * 19) % 76,
      color:    palette[i % palette.length],
      xOffset:  ((i * 17) % 60) - 30,
      yOffset:  ((i * 23) % 60) - 30,
      duration: 3 + (i * 7) % 4,
      delay:    (i * 0.09) % 1,
    }));
  }, []);

  // ── Deterministic sparkles ─────────────────────────────────────────────────
  const sparkles = useMemo(() => {
    const sparkPalette = ["#ffffff", CYAN, PINK, GOLD, PURPLE, "#00ff88"];
    return Array.from({ length: 32 }, (_, i) => ({
      left:     `${(i * 53 + 5)  % 100}%`,
      top:      `${(i * 37 + 11) % 100}%`,
      size:     2 + (i * 3) % 4,
      color:    sparkPalette[i % sparkPalette.length],
      delay:    0.4 + (i * 0.072) % 1.2,
      duration: 1 + (i * 0.09) % 1.5,
      repeatDelay: (i * 0.28) % 2,
    }));
  }, []);

  // ── Decorative rings — world-tinted or gold for boss ───────────────────────
  const rings = useMemo(() => {
    if (isBoss) {
      return [
        { size: 200, color: GOLD,    thickness: 2,   delay: 0.10, spinDir:  1 },
        { size: 330, color: PINK,    thickness: 1.5, delay: 0.20, spinDir: -1 },
        { size: 460, color: PURPLE,  thickness: 1,   delay: 0.30, spinDir:  1 },
      ];
    }
    return [
      { size: 200, color: primary,   thickness: 2,   delay: 0.10, spinDir:  1 },
      { size: 330, color: PURPLE,    thickness: 1.5, delay: 0.20, spinDir: -1 },
      { size: 460, color: secondary, thickness: 1,   delay: 0.30, spinDir:  1 },
    ];
  }, [isBoss, primary, secondary]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden select-none">

      {/* ── Layer 1: Main-menu gradient base ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />

      {/* ── Layer 2: Cyan grid ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ duration: 0.7 }}
      />

      {/* ── Layer 3: Ambient floating orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingOrbs.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width:  orb.size,
              height: orb.size,
              left:   orb.left,
              top:    orb.top,
              background: `radial-gradient(circle, ${orb.color}28, ${orb.color}0e, transparent)`,
            }}
            animate={{
              scale:   [0.8, 1.2, 0.8],
              opacity: [0.15, 0.45, 0.15],
              x:       [0, orb.xOffset, 0],
              y:       [0, orb.yOffset, 0],
            }}
            transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
          />
        ))}
      </div>

      {/* ── Layer 4: Decorative rotating rings ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {rings.map((ring, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{ width: ring.size, height: ring.size, borderColor: ring.color, borderWidth: ring.thickness }}
            initial={{ scale: 0.3, opacity: 0, rotate: 0 }}
            animate={{
              scale:   [0.3, 1.05, 1],
              opacity: [0, 0.50, 0.18],
              rotate:  ring.spinDir > 0 ? 360 : -360,
            }}
            transition={{
              scale:   { delay: ring.delay, duration: 0.65, ease: "easeOut" },
              opacity: { delay: ring.delay, duration: 0.65 },
              rotate:  { duration: 18 + i * 7, repeat: Infinity, ease: "linear" },
            }}
          />
        ))}
      </div>

      {/* ── Layer 5: Sparkle particles ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparkles.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: s.left, top: s.top,
              width: s.size, height: s.size,
              backgroundColor: s.color,
              boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ delay: s.delay, duration: s.duration, repeat: Infinity, repeatDelay: s.repeatDelay }}
          />
        ))}
      </div>

      {/* ── Layer 6: Vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at center, transparent 25%, rgba(0,0,0,0.52) 100%)" }}
      />

      {/* ── Layer 7: Scanlines ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.006) 3px,rgba(0,255,255,0.006) 4px)",
      }} />

      {/* ── Content card ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center"
        style={{
          width: "clamp(280px,85vw,400px)",
          padding: "clamp(20px,4vh,36px) clamp(20px,5vw,36px)",
          borderRadius: "clamp(16px,2.5vw,24px)",
          background: "rgba(6,3,22,0.86)",
          border: `1.5px solid ${primary}30`,
          boxShadow: `0 0 48px ${primary}1e, 0 0 90px ${primary}0c, inset 0 1px 0 ${primary}1a`,
          backdropFilter: "blur(24px)",
        }}
        initial={{ scale: 0.72, opacity: 0, y: 24 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
          height: 2, borderRadius: "inherit",
          background: `linear-gradient(90deg,transparent 5%,${primary}88 40%,${secondary}88 60%,transparent 95%)`,
          opacity: 0.85,
        }} />

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          height: 1, borderRadius: "inherit",
          background: `linear-gradient(90deg,transparent 15%,${tertiary}50 50%,transparent 85%)`,
          opacity: 0.5,
        }} />

        {/* Card scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
          borderRadius: "inherit",
        }} />

        {/* Title */}
        {isBoss ? (
          <motion.h1
            className="font-black tracking-widest text-transparent bg-clip-text"
            style={{
              fontSize: "clamp(1.8rem,7vw,3rem)", lineHeight: 1,
              backgroundImage: `linear-gradient(135deg,${GOLD} 0%,${PINK} 55%,${PURPLE} 100%)`,
            }}
            animate={{ filter: [
              `drop-shadow(0 0 12px ${GOLD}88) drop-shadow(0 0 24px ${PINK}44)`,
              `drop-shadow(0 0 24px ${GOLD}cc) drop-shadow(0 0 48px ${PINK}66)`,
              `drop-shadow(0 0 12px ${GOLD}88) drop-shadow(0 0 24px ${PINK}44)`,
            ]}}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            BOSS DEFEATED!
          </motion.h1>
        ) : (
          <>
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(1.5rem,5.5vw,2.4rem)", lineHeight: 1,
                backgroundImage: `linear-gradient(135deg,${primary} 0%,${PURPLE} 50%,${secondary} 100%)`,
              }}
              animate={{ filter: [
                `drop-shadow(0 0 10px ${primary}88)`,
                `drop-shadow(0 0 22px ${primary}cc) drop-shadow(0 0 32px ${secondary}66)`,
                `drop-shadow(0 0 10px ${primary}88)`,
              ]}}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              LEVEL {world}.{subLevel} COMPLETE!
            </motion.h1>
            <motion.p
              className="font-bold mt-1"
              style={{ fontSize: "clamp(0.62rem,1.5vw,0.8rem)", color: "rgba(255,255,255,0.38)", letterSpacing: "0.18em" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            >
              {orbGoal}/{orbGoal} ORBS DESTROYED
            </motion.p>
          </>
        )}

        {/* Divider */}
        <div className="my-3 w-full" style={{
          height: 1,
          background: `linear-gradient(90deg,transparent,${primary}55 35%,${secondary}55 65%,transparent)`,
        }} />

        {/* Score */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 22 }}
        >
          <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.22em", fontWeight: 700 }}>
            SCORE
          </span>
          <span
            className="font-black text-transparent bg-clip-text"
            style={{
              fontSize: "clamp(1.8rem,7vw,3rem)", lineHeight: 1.1,
              backgroundImage: `linear-gradient(135deg,${CYAN} 0%,${PURPLE} 50%,${PINK} 100%)`,
            }}
          >
            {score}
          </span>
        </motion.div>

        {/* Next level indicator */}
        <motion.div
          className="mt-4 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.45, 0.85] }}
          transition={{ delay: 0.9, duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="rounded-full" style={{ width: 6, height: 6, background: primary, boxShadow: `0 0 8px ${primary}` }} />
          <span style={{ fontSize: "clamp(0.55rem,1.3vw,0.72rem)", color: `${primary}cc`, letterSpacing: "0.2em", fontWeight: 700 }}>
            NEXT LEVEL STARTING
          </span>
          <div className="rounded-full" style={{ width: 6, height: 6, background: primary, boxShadow: `0 0 8px ${primary}` }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
