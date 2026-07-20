import { motion } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const levelColors: Record<number, { primary: string; secondary: string; name: string }> = {
  1: { primary: "#00ffff", secondary: "#0088ff", name: "Sky Realm" },
  2: { primary: "#ff00ff", secondary: "#8800ff", name: "Void Dimension" },
  3: { primary: "#ffff00", secondary: "#ff8800", name: "Solar Expanse" },
  4: { primary: "#00ff88", secondary: "#00aa44", name: "Forest Kingdom" },
  5: { primary: "#ff4488", secondary: "#cc0044", name: "Crystal Caves" },
  6: { primary: "#8888ff", secondary: "#4444cc", name: "Storm Peaks" },
  7: { primary: "#ff8844", secondary: "#cc4400", name: "Lava Fields" },
  8: { primary: "#44ffff", secondary: "#00cccc", name: "Ocean Depths" },
  9: { primary: "#ffff88", secondary: "#cccc00", name: "Star Core" },
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

  const primary   = isBoss ? "#ffff00" : colors.primary;
  const secondary = isBoss ? "#ff8800" : colors.secondary;
  const glow      = isBoss ? "rgba(255,200,0,0.35)" : `${colors.primary}55`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black select-none">
      {/* Radial background glow for world color */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${primary}18 0%, ${secondary}0a 55%, transparent 80%)`,
        }}
      />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.008) 3px,rgba(0,255,255,0.008) 4px)",
      }} />

      {/* Content card */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center"
        style={{
          width: "clamp(280px,85vw,400px)",
          padding: "clamp(20px,4vh,36px) clamp(20px,5vw,36px)",
          borderRadius: "clamp(16px,2.5vw,24px)",
          background: "rgba(4,4,18,0.82)",
          border: `1px solid ${primary}30`,
          boxShadow: `0 0 40px ${glow}, 0 0 80px ${primary}10`,
          backdropFilter: "blur(24px)",
        }}
        initial={{ scale: 0.72, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
          height: 2, borderRadius: "inherit",
          background: `linear-gradient(90deg,transparent 5%,${primary}88 50%,transparent 95%)`,
          opacity: 0.7,
        }} />

        {/* Scanlines on card */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
          borderRadius: "inherit",
        }} />

        {/* Title */}
        {isBoss ? (
          <>
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(1.8rem,7vw,3rem)", lineHeight: 1,
                backgroundImage: "linear-gradient(135deg,#ffff00 0%,#ff8800 55%,#ff4400 100%)",
              }}
              animate={{ filter: [
                "drop-shadow(0 0 12px rgba(255,200,0,0.6)) drop-shadow(0 0 24px rgba(255,100,0,0.35))",
                "drop-shadow(0 0 22px rgba(255,220,0,0.8)) drop-shadow(0 0 44px rgba(255,150,0,0.5))",
                "drop-shadow(0 0 12px rgba(255,200,0,0.6)) drop-shadow(0 0 24px rgba(255,100,0,0.35))",
              ]}}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              BOSS DEFEATED!
            </motion.h1>
          </>
        ) : (
          <>
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(1.5rem,5.5vw,2.4rem)", lineHeight: 1,
                backgroundImage: `linear-gradient(135deg,${primary} 0%,${secondary} 100%)`,
              }}
              animate={{ filter: [
                `drop-shadow(0 0 10px ${primary}88)`,
                `drop-shadow(0 0 20px ${primary}cc)`,
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
          background: `linear-gradient(90deg,transparent,${primary}44 40%,${primary}44 60%,transparent)`,
        }} />

        {/* Score */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 22 }}
        >
          <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.22em", fontWeight: 700 }}>SCORE</span>
          <span className="font-black text-transparent bg-clip-text"
            style={{ fontSize: "clamp(1.8rem,7vw,3rem)", lineHeight: 1.1, backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 50%,#ff00ff 100%)" }}>
            {score}
          </span>
        </motion.div>

        {/* Next level indicator */}
        <motion.div
          className="mt-4 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0.45, 0.8] }}
          transition={{ delay: 0.9, duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Pulsing dot */}
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
