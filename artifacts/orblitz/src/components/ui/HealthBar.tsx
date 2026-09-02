/**
 * HealthBar — AAA HD HUD energy bar
 * - Dark metallic / glassmorphism frame
 * - Dynamic gradient fill (cyan → amber → crimson)
 * - Continuous shimmer streak
 * - Ghost bar on damage + frame shake + red HUD / screen flash
 * - Green-gold heal sweep on restoration
 * - Rhythmic red pulse when at 1 HP
 * - No numbers
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { getWeaponConfig } from "@/game-runtime/WeaponProgression";

// ── CSS keyframes injected once ────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes hb-shimmer {
  0%   { transform: translateX(-150%) skewX(-20deg); }
  100% { transform: translateX(300%)  skewX(-20deg); }
}
@keyframes hb-heal {
  0%   { transform: translateX(-100%) skewX(-18deg); opacity: 0.9; }
  80%  { opacity: 0.7; }
  100% { transform: translateX(280%)  skewX(-18deg); opacity: 0; }
}
@keyframes hb-low-pulse {
  0%,100% {
    border-color: rgba(255,30,30,0.35);
    box-shadow: 0 0 0 rgba(255,0,0,0), inset 0 0 20px rgba(0,0,0,0.5);
  }
  50% {
    border-color: rgba(255,30,30,0.85);
    box-shadow: 0 0 22px rgba(255,0,0,0.45), 0 0 44px rgba(255,0,0,0.18), inset 0 0 20px rgba(0,0,0,0.5);
  }
}
@keyframes hb-orb-idle {
  0%,100% { opacity: 0.8; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.12); }
}
@keyframes hb-screen-flash {
  0%   { opacity: 0.32; }
  100% { opacity: 0; }
}
@keyframes hb-overheat-flame {
  0%,100% { transform: translateY(2px) scale(0.92) rotate(-4deg); opacity: 0.72; }
  50%      { transform: translateY(-2px) scale(1.08) rotate(4deg); opacity: 1; }
}
`;

let _cssInjected = false;
function ensureCSS() {
  if (_cssInjected || typeof document === "undefined") return;
  _cssInjected = true;
  const el = document.createElement("style");
  el.dataset.id = "orblitz-healthbar";
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

// ── Orb emblem ─────────────────────────────────────────────────────────────────
function OrbEmblem({ color }: { color: string }) {
  return (
    <svg
      width="26" height="26" viewBox="0 0 24 24" fill="none"
      style={{ animation: "hb-orb-idle 2.2s ease-in-out infinite", flexShrink: 0,
               filter: `drop-shadow(0 0 6px ${color}bb)` }}
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.35" />
      {/* Mid ring */}
      <circle cx="12" cy="12" r="7.5"  stroke={color} strokeWidth="1"   strokeOpacity="0.6"  />
      {/* Fill orb */}
      <circle cx="12" cy="12" r="5.2"  fill={`${color}25`} />
      {/* Core */}
      <circle cx="12" cy="12" r="3.2"  fill={color} fillOpacity="0.9" />
      {/* Specular */}
      <circle cx="10.2" cy="10.2" r="1.6" fill="white" fillOpacity="0.25" />
      {/* Tick marks */}
      {[0, 90, 180, 270].map((deg) => (
        <line key={deg}
          x1={12 + Math.cos((deg * Math.PI) / 180) * 8.5}
          y1={12 + Math.sin((deg * Math.PI) / 180) * 8.5}
          x2={12 + Math.cos((deg * Math.PI) / 180) * 10.5}
          y2={12 + Math.sin((deg * Math.PI) / 180) * 10.5}
          stroke={color} strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function OverheatFlames({ heat, overheated }: { heat: number; overheated: boolean }) {
  if (heat <= 0.5) return null;

  const flameColor = overheated ? "#ff321c" : "#ff9f2d";
  const flameLeft = Math.max(4, Math.min(96, heat * 100));

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${flameLeft}%`,
        top: -15,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
        zIndex: 5,
        filter: `drop-shadow(0 0 5px ${flameColor})`,
      }}
      animate={{ opacity: overheated ? [0.72, 1, 0.78] : [0.55, 0.88, 0.58] }}
      transition={{ duration: overheated ? 0.42 : 0.7, repeat: Infinity, ease: "easeInOut" }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            display: "block",
            color: flameColor,
            fontSize: index === 1 ? 13 : 10,
            lineHeight: 1,
            animation: `hb-overheat-flame ${0.45 + index * 0.11}s ease-in-out infinite`,
            animationDelay: `${index * -0.12}s`,
          }}
        >
           <span className="orblitz-heat-notch" />
        </span>
      ))}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function HealthBar() {
  useEffect(ensureCSS, []);

  const health    = useMagicOrb((s) => s.health);
  const maxHealth = useMagicOrb((s) => s.maxHealth);
  const isDamaged = useMagicOrb((s) => s.isDamaged);
  const healTimer = useMagicOrb((s) => s.healAnimTimer);
  const rapidOverheat = useMagicOrb((s) => s.rapidOverheat);
  const rapidOverheatActive = useMagicOrb((s) => s.rapidOverheatActive);
  const rapidOverheatPenaltyTimer = useMagicOrb((s) => s.rapidOverheatPenaltyTimer);
  const equippedWeapon = useShop((s) => s.equippedWeapon);
  const weaponProgression = useShop((s) => s.weaponProgression);

  const fillPct = maxHealth > 0 ? Math.max(0, Math.min(100, (health / maxHealth) * 100)) : 0;
  const ratio   = fillPct / 100;
  const isLowHP = health <= 1 && maxHealth >= 2;
  const isHeal  = healTimer > 0;
  const showOverheat = equippedWeapon === "orbital_rapid_blaster";
  const rapidLevel = weaponProgression.orbital_rapid_blaster.level;
  const rapidConfig = getWeaponConfig("orbital_rapid_blaster", rapidLevel);
  const overheatPct = Math.max(0, Math.min(100, rapidOverheat * 100));

  // Accent + gradient driven by HP ratio
  const accentColor = ratio > 0.55 ? "#00ffdd" : ratio > 0.28 ? "#ffcc00" : "#ff3333";
  const barGradient =
    ratio > 0.55
      ? "linear-gradient(90deg,#00ddcc 0%,#00eeff 40%,#00bbff 80%,#0088ee 100%)"
      : ratio > 0.28
      ? "linear-gradient(90deg,#00bb99 0%,#44ddaa 28%,#ffcc00 65%,#ff8800 100%)"
      : "linear-gradient(90deg,#ff8800 0%,#ff4400 45%,#cc0020 100%)";

  // Ghost bar
  const [ghostPct, setGhostPct]         = useState(fillPct);
  const [ghostVisible, setGhostVisible] = useState(false);
  const ghostTO  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHP   = useRef(health);

  useEffect(() => {
    if (health < prevHP.current) {
      setGhostPct((prevHP.current / maxHealth) * 100);
      setGhostVisible(true);
      if (ghostTO.current) clearTimeout(ghostTO.current);
      ghostTO.current = setTimeout(() => setGhostVisible(false), 850);
    }
    prevHP.current = health;
  }, [health, maxHealth]);

  // Segment ticks
  const ticks = maxHealth > 1
    ? Array.from({ length: maxHealth - 1 }, (_, i) => ((i + 1) / maxHealth) * 100)
    : [];

  return (
    <>
      {/* ── Screen-wide red flash on damage ── */}
      <AnimatePresence>
        {isDamaged && (
          <motion.div
            key="dmg-screen"
            style={{
              position: "fixed", inset: 0, pointerEvents: "none", zIndex: 35,
              background:
                "radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,0.30) 100%)",
              animation: "hb-screen-flash 0.35s ease-out forwards",
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      {/* ── HUD bar frame ── */}
      <motion.div
        animate={
          isDamaged
            ? { x: [-4, 6, -6, 5, -3, 0], y: [-2, 3, -3, 2, 0] }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="orblitz-healthbar-shell"
        role="group"
        aria-label={`Player energy ${Math.round(health)} of ${Math.round(maxHealth)}`}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "7px 12px 7px 8px",
          minWidth: 200,
          background: "rgba(4,4,20,0.93)",
          backdropFilter: "blur(14px) saturate(1.5)",
          border: `1.5px solid ${accentColor}30`,
          borderRadius: 10,
          boxShadow: `0 0 18px ${accentColor}18, inset 0 0 22px rgba(0,0,0,0.55)`,
          overflow: "hidden",
          // Low-HP flashing overrides border/shadow via animation
          animation: isLowHP ? "hb-low-pulse 0.85s ease-in-out infinite" : "none",
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: "8%", right: "8%", height: 1.5,
          background: `linear-gradient(90deg,transparent,${accentColor}99,transparent)`,
          opacity: 0.7,
        }} />

        {/* Bottom accent line */}
        <div style={{
          position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1,
          background: `linear-gradient(90deg,transparent,${accentColor}44,transparent)`,
          opacity: 0.4,
        }} />

        {/* Scanlines */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit",
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.013) 4px,rgba(255,255,255,0.013) 5px)",
        }} />

        {/* Corner brackets — top-left */}
        <div style={{
          position: "absolute", top: 3, left: 3,
          width: 8, height: 8,
          borderTop: `1.5px solid ${accentColor}99`,
          borderLeft: `1.5px solid ${accentColor}99`,
          borderRadius: "2px 0 0 0",
        }} />
        {/* Corner brackets — bottom-right */}
        <div style={{
          position: "absolute", bottom: 3, right: 3,
          width: 8, height: 8,
          borderBottom: `1.5px solid ${accentColor}99`,
          borderRight: `1.5px solid ${accentColor}99`,
          borderRadius: "0 0 2px 0",
        }} />

        {/* Orb emblem */}
        <OrbEmblem color={accentColor} />

        {/* ── Bar track ── */}
        <div
          role="progressbar"
          aria-label="Player energy"
          aria-valuemin={0}
          aria-valuemax={maxHealth}
          aria-valuenow={health}
          className="orblitz-healthbar-track"
          style={{
          flex: 1, position: "relative", height: 16,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 5,
          border: "1px solid rgba(255,255,255,0.055)",
          overflow: "hidden",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.75)",
        }}>
          {/* Ghost bar */}
          <AnimatePresence>
            {ghostVisible && (
              <motion.div
                key="ghost"
                style={{
                  position: "absolute", inset: 0,
                  width: `${ghostPct}%`,
                  background:
                    "linear-gradient(90deg,rgba(255,90,90,0.55) 0%,rgba(255,200,200,0.35) 100%)",
                  borderRadius: 5,
                }}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* Main fill */}
          <motion.div
            style={{
              position: "absolute", top: 0, left: 0, height: "100%",
              background: barGradient,
              borderRadius: 5,
              boxShadow: `0 0 12px ${accentColor}55, 0 0 4px ${accentColor}88`,
              overflow: "hidden",
            }}
            animate={{ width: `${fillPct}%` }}
            transition={{
              duration: isDamaged ? 0.07 : isHeal ? 0.45 : 0.28,
              ease: isDamaged ? [0.15, 0, 0.35, 1] : "easeInOut",
            }}
          >
            {/* Top highlight */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "45%",
              background: "linear-gradient(180deg,rgba(255,255,255,0.2) 0%,transparent 100%)",
              borderRadius: 5,
            }} />
            {/* Shimmer streak */}
            <div style={{
              position: "absolute", top: 0, left: 0,
              width: "38%", height: "100%",
              background:
                "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.32) 50%,transparent 100%)",
              animation: "hb-shimmer 2.8s ease-in-out infinite",
            }} />
            {/* Heal sweep */}
            {isHeal && (
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: "55%", height: "100%",
                background:
                  "linear-gradient(90deg,transparent,rgba(80,255,150,0.75),rgba(255,230,80,0.55),transparent)",
                animation: "hb-heal 0.55s ease-out forwards",
              }} />
            )}
          </motion.div>

          {/* Segment ticks — one per missing HP slot boundary */}
          {ticks.map((pct) => (
            <div key={pct} style={{
              position: "absolute", top: "12%", bottom: "12%",
              left: `${pct}%`,
              width: 1,
              background: "rgba(0,0,0,0.5)",
              zIndex: 3,
            }} />
          ))}
        </div>

        {/* Damage HUD flash overlay */}
        <AnimatePresence>
          {isDamaged && (
            <motion.div
              key="hud-flash"
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "rgba(220,30,30,0.28)",
                borderRadius: "inherit",
              }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
      {showOverheat && (
        <div
          role="status"
          aria-label={`Rapid Blaster heat ${Math.round(overheatPct)} percent${rapidOverheatActive ? ", overheated" : ""}`}
          style={{
            width: "100%",
            minWidth: 200,
            marginTop: 4,
            padding: "3px 8px 4px",
            borderRadius: 6,
            background: rapidOverheatActive ? "rgba(90,12,4,0.85)" : "rgba(4,4,20,0.86)",
            border: `1px solid ${rapidOverheatActive ? "rgba(255,76,30,0.75)" : "rgba(255,138,42,0.25)"}`,
            boxShadow: rapidOverheatActive ? "0 0 14px rgba(255,60,20,0.32)" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ color: rapidOverheatActive ? "#ff7855" : "#ffb13b", fontSize: "0.55rem", fontWeight: 900, letterSpacing: "0.16em" }}>
              {rapidOverheatActive ? "OVERHEATED" : "BLASTER HEAT"}
            </span>
            <span style={{ color: "rgba(255,205,150,0.65)", fontSize: "0.52rem", fontVariantNumeric: "tabular-nums" }}>
              {rapidOverheatActive ? `${rapidOverheatPenaltyTimer.toFixed(1)}s cooldown` : `${Math.round(overheatPct)}%`}
            </span>
          </div>
          <div style={{ position: "relative", overflow: "visible" }}>
            <div style={{ height: 5, overflow: "hidden", borderRadius: 4, background: "rgba(0,0,0,0.65)" }}>
              <motion.div
                animate={{ width: `${overheatPct}%` }}
                transition={{ duration: 0.12 }}
                style={{
                  height: "100%",
                  borderRadius: 4,
                  background: rapidOverheatActive
                    ? "linear-gradient(90deg,#ff9b35,#ff2418)"
                    : `linear-gradient(90deg,#ffcc45,#ff6a22)`,
                  boxShadow: `0 0 8px ${rapidOverheatActive ? "#ff3a1c" : "#ff9c32"}`,
                }}
              />
            </div>
            <OverheatFlames heat={rapidOverheat} overheated={rapidOverheatActive} />
          </div>
          <span style={{ display: "block", marginTop: 3, color: "rgba(255,210,160,0.45)", fontSize: "0.48rem", letterSpacing: "0.08em" }}>
            {rapidConfig.overheatSeconds}s continuous fire limit
          </span>
        </div>
      )}
    </>
  );
}
