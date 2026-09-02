import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { useGraphicsPreset, setGraphicsPreset, type GraphicsPreset } from "@/game-runtime/PerformanceToggles";
import { BOSS_DEFEAT_PALETTES, MAIN_BOSS_TYPES, type MainBossType } from "@/components/game/BossDefeatPalette";
import {
  ARCADE_BOSS_INTRO_DEFS,
  getMenuBossSwarmPosition,
  type IntroBossPhase,
} from "./ArcadeBossIntroScene";

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconPlay()      { return <svg {..._svg}><path d="M6.5 3.8 20.5 12 6.5 20.2V3.8Z" fill="currentColor" opacity="0.92"/><path d="M10 8.2 16.5 12 10 15.8" stroke="#07111f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/></svg>; }
function IconShop()      { return <svg {..._svg}><path d="m5.5 8 2.2-3h8.6l2.2 3-1.4 11h-10L5.5 8Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.13"/><path d="M5.5 8h13M9.2 8v3.2M14.8 8v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconTrophy()    { return <svg {..._svg}><path d="M8 4h8v5.5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5v.4A3.1 3.1 0 0 0 7.1 11H8M16 6h2.5A1.5 1.5 0 0 1 20 7.5v.4a3.1 3.1 0 0 1-3.1 3.1H16M12 13v4M8.5 20h7M9 17h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconGear()      { return <svg {..._svg}><path d="m12 3 1.3 2.1 2.5.4.7 2.4 2.1 1.4-.9 2.4.9 2.4-2.1 1.4-.7 2.4-2.5.4L12 21l-1.3-2.1-2.5-.4-.7-2.4-2.1-1.4.9-2.4-.9-2.4 2.1-1.4.7-2.4 2.5-.4L12 3Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.12"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.3"/><path d="M12 8.3v1M12 14.7v1M8.3 12h1M14.7 12h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>; }
function IconSettings()  { return <svg {..._svg}><line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="7" r="2.2" fill="currentColor" fillOpacity="0.9"/><line x1="3" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="14" r="2.2" fill="currentColor" fillOpacity="0.9"/></svg>; }
function IconSurvive()   { return <svg {..._svg}><circle cx="12" cy="12" r="2.8" fill="currentColor"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.55"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="0.8" opacity="0.25"/></svg>; }
function IconChill()     { return <svg {..._svg}><path d="M2 10 C5.5 7 7 13 10 10 S14.5 7 18 10 S21 13 22 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 15.5 C5.5 12.5 7 18.5 10 15.5 S14.5 12.5 18 15.5 S21 18.5 22 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/></svg>; }
function IconArcade()    { return <svg {..._svg}><rect x="4" y="14" width="16" height="7" rx="3" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><path d="M12 14 L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><circle cx="8" cy="17.5" r="1" fill="currentColor"/><circle cx="16" cy="17.5" r="1" fill="currentColor"/></svg>; }
function IconGauntlet()  { return <svg {..._svg}><path d="M12 3 L21 12 L12 21 L3 12 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><line x1="12" y1="7" x2="12" y2="17" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/><line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/><circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.9"/></svg>; }
function IconStar()      { return <svg {..._svg}><path d="m12 2.9 2.75 5.58 6.16.9-4.46 4.34 1.05 6.13L12 16.95l-5.5 2.9 1.05-6.13L3.1 9.38l6.15-.9L12 2.9Z" fill="currentColor"/><path d="m12 5.8 1.75 3.54 3.91.57-2.83 2.76.67 3.9L12 14.73l-3.5 1.84.67-3.9-2.83-2.76 3.91-.57L12 5.8Z" fill="#fff8c9" fillOpacity="0.7"/></svg>; }
function IconBack()      { return <svg {..._svg}><path d="M11 7 L6 12 L11 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12 H16 C18.2 12 20 13.8 20 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconLock()      { return <svg {..._svg}><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><path d="M8 10V7.8a4 4 0 0 1 8 0V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/></svg>; }
function IconChevron({ direction }: { direction: "previous" | "next" }) {
  return <svg {..._svg} aria-hidden="true"><path d={direction === "previous" ? "M14.5 5 7.5 12l7 7" : "m9.5 5 7 7-7 7"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d={direction === "previous" ? "M8 12h9" : "M7 12h9"} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.62" /></svg>;
}
function IconSound()     { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.85"/><path d="M15 8 C17 9.5 17.5 11.5 17.5 12 S17 14.5 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17.5 5.5 C20.5 7.5 21.5 9.8 21.5 12 S20.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconSoundOff()  { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.5"/><line x1="16.5" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="22" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function IconBrightness(){ return <svg {..._svg}><circle cx="12" cy="12" r="3.8" fill="currentColor" fillOpacity="0.85"/><line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="4.93" y1="4.93" x2="7.07" y2="7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16.93" y1="16.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="19.07" y1="4.93" x2="16.93" y2="7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7.07" y1="16.93" x2="4.93" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }

// ─── Types ────────────────────────────────────────────────────────────────────
type AnimPhase = "splash" | "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "menu" | "done";
export type MenuState = "root" | "modes" | "settings" | "worlds" | "levels";

interface StartupAnimationProps {
  skipIntro?: boolean;
  initialState?: MenuState;
  onMenuReady?: () => void;
  onIntroPhaseChange?: (phase: IntroBossPhase | null, menuState?: MenuState, selectedWorld?: number) => void;
}

// ─── World palette (9 worlds, spans the title gradient arc) ──────────────────
const WORLD_COLORS = [
  "#00f6ff","#9b5cff","#ff2bd6","#ff6b35","#ffe600",
  "#7cff00","#ff9f1c","#b45cff","#00e5ff",
];
const WORLD_SHADOWS = WORLD_COLORS.map(c => c + "55");
const WORLD_NAMES = [
  "Ignition Field", "Prism Ruins", "Pulse Garden", "Ashen Relay", "Solar Foundry",
  "Verdant Drift", "Cinder Crown", "Lumen Vault", "The Core",
] as const;

// ─── Level helpers (from original LevelSelect) ────────────────────────────────
const getStoredProgress = (): number => {
  try {
    const s = localStorage.getItem("orblitz_arcade_progress");
    if (s) return (JSON.parse(s) as { highestLevel: number }).highestLevel;
  } catch {}
  return 1.1;
};
const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  return (15 + (world - 1) * 10) + (sub - 1) * 5;
};

// ─── Dev-mode easter egg ──────────────────────────────────────────────────────
const DEV_SEQUENCE = ["O","R","B","L","I","T","Z"] as const;
const TITLE_LETTERS = ["O","R","B","L","I","T","Z"];
const SPLASH_DURATION = 2400;
const FLYING_START = SPLASH_DURATION;
const CONVERGE_START = FLYING_START + 2550;
const FLASH_START = CONVERGE_START + 650;
const TITLE_START = FLASH_START + 820;
const MENU_START = TITLE_START + 1650;
const MENU_BACKGROUND_REVEAL_DURATION = 1.15;
const MENU_TITLE_REVEAL_DELAY = MENU_BACKGROUND_REVEAL_DURATION;
const MENU_SECONDARY_REVEAL_DELAY = MENU_TITLE_REVEAL_DELAY + 0.5;
const MENU_NAVIGATION_DELAY = 0.04;
const TITLE_REFLECTION_BOSSES: readonly MainBossType[] = [
  "circle", "star", "triangle", "trapezoid", "cube", "arrow", "monster",
];
const BOSS_LIGHT_WHEEL = [
  ...new Set(
    Object.values(BOSS_DEFEAT_PALETTES).flatMap((palette) => [
      palette.glow,
      palette.secondary,
      palette.highlight,
    ]),
  ),
];

function BrightFlashTransition({ phase }: { phase: AnimPhase }) {
  const charging = phase === "converge";
  const visible = charging || phase === "flash" || phase === "title" || phase === "waiting" || phase === "menu";
  const revealing = phase === "menu";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="bright-flash"
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 30, background: "#ffffff" }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: revealing
              ? [1, 0]
              : charging
                ? [0, 0.04, 0.12, 0.3, 0.58]
                : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: revealing ? MENU_BACKGROUND_REVEAL_DURATION : charging ? 0.65 : 0.22,
            ease: revealing ? [0.22, 0.61, 0.36, 1] : "easeOut",
          }}
        />
      )}
    </AnimatePresence>
  );
}

function getTitleReflectionStyle(index: number): React.CSSProperties {
  const palette = BOSS_DEFEAT_PALETTES[TITLE_REFLECTION_BOSSES[index % TITLE_REFLECTION_BOSSES.length]];
  const wheelStops = BOSS_LIGHT_WHEEL
    .map((color, stopIndex) => `${color}18 ${(stopIndex / BOSS_LIGHT_WHEEL.length) * 360}deg`)
    .join(", ");
  return {
    display: "inline-block",
    backgroundImage: [
      "linear-gradient(135deg, rgba(236,253,255,0.68) 0%, rgba(160,218,255,0.26) 25%, rgba(16,26,76,0.3) 48%, rgba(255,255,255,0.6) 72%, rgba(218,249,255,0.46) 100%)",
      `conic-gradient(from ${index * 23}deg at 50% 50%, ${wheelStops}, ${BOSS_LIGHT_WHEEL[0]}18 360deg)`,
      "radial-gradient(ellipse 120% 180% at var(--refract-x-1,50%) var(--refract-y-1,50%), var(--refract-color-1, rgba(255,255,255,0)) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 180% at var(--refract-x-2,50%) var(--refract-y-2,50%), var(--refract-color-2, rgba(255,255,255,0)) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 180% at var(--refract-x-3,50%) var(--refract-y-3,50%), var(--refract-color-3, rgba(255,255,255,0)) 0%, transparent 48%)",
      `radial-gradient(circle at 24% 22%, rgba(255,255,255,0.78) 0 2%, ${palette.highlight}33 4%, transparent 18%), radial-gradient(circle at 76% 74%, ${palette.glow}33 0 3%, transparent 23%)`,
      "linear-gradient(112deg, transparent 0%, transparent 37%, rgba(255,255,255,0.88) 47%, rgba(255,255,255,0.12) 53%, transparent 65%)",
    ].join(","),
    backgroundBlendMode: "normal, screen, screen, screen, screen, screen, screen",
    backgroundSize: "100% 100%, 220% 220%, 180% 180%, 180% 180%, 180% 180%, 100% 100%, 260% 100%",
    backgroundPosition: "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
    willChange: "background-position, filter",
  };
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${clampUnit(alpha).toFixed(3)})`;
}

/**
 * Drives the title's internal refraction from the same normalized boss motion
 * used by the WebGL scene. DOM variables are mutated directly so the glass can
 * respond at animation-frame rate without rerendering the menu.
 */
function useTitleRefraction(
  letterRefs: React.MutableRefObject<Array<HTMLSpanElement | null>>,
  phase: AnimPhase,
): void {
  const motionStartAt = useRef<number | null>(null);
  const previousPhase = useRef<AnimPhase | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = performance.now();
    const preserveTitleClock =
      (phase === "waiting" || phase === "menu") &&
      (previousPhase.current === "title" || previousPhase.current === "waiting" || previousPhase.current === "menu");
    if (!preserveTitleClock) motionStartAt.current = now;
    previousPhase.current = phase;
    if (!["title", "waiting", "menu"].includes(phase)) return;

    let frame = 0;
    const startedAt = motionStartAt.current ?? now;
    const update = (now: number) => {
      const elapsed = Math.max(0, (now - startedAt) / 1000);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const lights = ARCADE_BOSS_INTRO_DEFS.map((definition) => {
        const motion = getMenuBossSwarmPosition(
          definition.type,
          elapsed + definition.delay * 0.8,
          1,
          1,
        );
        return {
          x: width * (0.5 + motion.x),
          y: height * (0.5 + motion.y),
          depth: motion.depth,
          scale: motion.scale,
          palette: BOSS_DEFEAT_PALETTES[definition.type],
        };
      });

      letterRefs.current.forEach((letter) => {
        if (!letter) return;
        const bounds = letter.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const radius = Math.max(bounds.width * 1.55, 86);
        const ranked = lights
          .map((light) => {
            const distance = Math.hypot(light.x - centerX, light.y - centerY);
            const lightRadius = radius * (0.88 + light.scale * 0.24);
            const distanceFalloff = Math.exp(-distance / lightRadius);
            const depthFalloff = 0.52 + (light.depth + 1) * 0.25;
            return {
              ...light,
              distance,
              intensity: clampUnit(distanceFalloff * depthFalloff * 1.38),
            };
          })
          .sort((first, second) => second.intensity - first.intensity)
          .slice(0, 3);

        ranked.forEach((light, lightIndex) => {
          const slot = lightIndex + 1;
          const x = ((light.x - bounds.left) / Math.max(bounds.width, 1)) * 100;
          const y = ((light.y - bounds.top) / Math.max(bounds.height, 1)) * 100;
          const alpha = light.intensity * (lightIndex === 0 ? 0.9 : lightIndex === 1 ? 0.58 : 0.36);
          letter.style.setProperty(`--refract-x-${slot}`, `${Math.max(-160, Math.min(260, x))}%`);
          letter.style.setProperty(`--refract-y-${slot}`, `${Math.max(-180, Math.min(280, y))}%`);
          letter.style.setProperty(`--refract-color-${slot}`, hexToRgba(light.palette.glow, alpha));
        });

        for (let lightIndex = ranked.length + 1; lightIndex <= 3; lightIndex++) {
          letter.style.setProperty(`--refract-color-${lightIndex}`, "rgba(255,255,255,0)");
        }
      });

      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [letterRefs, phase]);
}

// ─── Button row definitions ───────────────────────────────────────────────────
interface BtnDef {
  id: string; icon: React.ReactNode; label: string;
  color: string; shadow: string; action: () => void; hideLabel?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StartupAnimation({
  skipIntro = false,
  initialState = "root",
  onMenuReady,
  onIntroPhaseChange,
}: StartupAnimationProps) {
  const [animPhase, setAnimPhase] = useState<AnimPhase>(skipIntro ? "menu" : "splash");
  const [menuState, setMenuState] = useState<MenuState>(skipIntro ? initialState : "root");
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [devProgress, setDevProgress] = useState(0);
  const [devFlash, setDevFlash]       = useState(false);
  const [highestLevel, setHighestLevel] = useState(1.1);
  const [pressedBtn, setPressedBtn]   = useState<string | null>(null);
  const worldPointerStartX = useRef<number | null>(null);
  const worldSwipeRef = useRef(false);

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, playLevelSelect, isMuted, toggleMute, volume, setVolume, brightness, setBrightness, startMenuBgm, stopMenuBgm } = useAudio();
  const { openShop, openInventory, openTrophies, activateDevMode, coins: shopStars, devMode } = useShop();
  const { setGameMode, startLoading } = useMagicOrb();
  const graphicsPreset = useGraphicsPreset();
  const titleLetterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  useTitleRefraction(titleLetterRefs, animPhase);

  // Reload progress when entering menu
  useEffect(() => {
    setHighestLevel(getStoredProgress());
  }, [menuState]);

  // Intro sequence
  useEffect(() => {
    if (skipIntro) { onMenuReady?.(); try { startMenuBgm(); } catch {} return; }
    const t0 = setTimeout(() => { setAnimPhase("flying");   try { playOrbWhoosh();   } catch {} }, FLYING_START);
    const t1 = setTimeout(() => { setAnimPhase("converge"); try { playOrbConverge(); } catch {} }, CONVERGE_START);
    const t2 = setTimeout(() => { setAnimPhase("flash"); },                                        FLASH_START);
    const t3 = setTimeout(() => { setAnimPhase("title");    try { playTitleReveal(); } catch {} }, TITLE_START);
    const t4 = setTimeout(() => { setAnimPhase("menu");    try { startMenuBgm(); } catch {} onMenuReady?.(); }, MENU_START);
    return () => [t0,t1,t2,t3,t4].forEach(clearTimeout);
  }, [onMenuReady, playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuBgm]);

  const handleLetterClick = useCallback((letter: string, idx: number) => {
    const expected = DEV_SEQUENCE[devProgress];
    if (letter === expected && idx === devProgress) {
      const next = devProgress + 1;
      if (next === DEV_SEQUENCE.length) {
        activateDevMode(); setDevFlash(true); setDevProgress(0);
        setTimeout(() => setDevFlash(false), 700);
      } else { setDevProgress(next); }
    } else { setDevProgress(letter === DEV_SEQUENCE[0] ? 1 : 0); }
  }, [devProgress, activateDevMode]);

  const btn = useCallback((id: string) => { try { playLevelSelect(); } catch {} }, [playLevelSelect]);

  const handleStartMode = useCallback((mode: string) => {
    btn(mode);
    try { stopMenuBgm(); } catch {}
    useOrbTransition.getState().loadingSweep(() => {
      setGameMode(mode as any);
      startLoading("entering");
    });
  }, [btn, setGameMode, startLoading, stopMenuBgm]);

  const isLevelUnlocked = (level: number) => devMode || level <= highestLevel + 0.01;
  const isBossLevel     = (level: number) => Math.round((level % 1) * 10) === 9;
  const isWorldUnlocked = (w: number)     => devMode || (w + 0.1) <= highestLevel + 0.01;
  const moveWorld = useCallback((direction: number) => {
    setSelectedWorld((current) => ((current - 1 + direction + 9) % 9) + 1);
  }, []);
  const openWorldLevels = useCallback((world: number) => {
    if (!isWorldUnlocked(world)) return;
    btn(`w${world}`);
    setSelectedWorld(world);
    setMenuState("levels");
  }, [btn, devMode, highestLevel]);
  const handleWorldKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveWorld(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveWorld(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setSelectedWorld(1);
    } else if (event.key === "End") {
      event.preventDefault();
      setSelectedWorld(9);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openWorldLevels(selectedWorld);
    }
  }, [moveWorld, openWorldLevels, selectedWorld]);

  // ── Button definitions per state ──────────────────────────────────────────
  const getPanelButtons = useCallback((): BtnDef[] => {
    const back = (label: string, action: () => void, hideLabel = false): BtnDef =>
      ({ id: "back", icon: <IconBack />, label, color: "#667788", shadow: "rgba(100,110,130,0.25)", action, hideLabel });

    switch (menuState) {
       case "root": return [
         { id:"play",      icon:<IconPlay />,     label:"PLAY",     color:"#8fffe0", shadow:"rgba(143,255,224,0.34)", action: () => { btn("play");      setMenuState("modes");    } },
         { id:"shop",      icon:<IconShop />,     label:"SHOP",     color:"#ff8e72", shadow:"rgba(255,142,114,0.3)", action: () => { btn("shop");      openShop();               } },
         { id:"inventory", icon:<IconGear />,     label:"GEAR",     color:"#bba1ff", shadow:"rgba(187,161,255,0.3)", action: () => { btn("inventory"); openInventory();          } },
         { id:"trophies",  icon:<IconTrophy />,   label:"RECORDS",  color:"#e9dd85", shadow:"rgba(233,221,133,0.24)", action: () => { btn("trophies"); openTrophies(); } },
         { id:"settings",  icon:<IconSettings />, label:"SETTINGS", color:"#9bdcff", shadow:"rgba(155,220,255,0.26)", action: () => { btn("settings");  setMenuState("settings"); } },
      ];
      case "modes": return [
        { id:"arcade",    icon:<IconArcade />,   label:"ARCADE",   color:"#ff2bd6", shadow:"rgba(255,43,214,0.44)", action: () => { btn("arcade"); setMenuState("worlds"); }  },
        { id:"chill",     icon:<IconChill />,    label:"CHILL",    color:"#9b5cff", shadow:"rgba(155,92,255,0.44)", action: () => handleStartMode("chill")     },
        { id:"survival",  icon:<IconSurvive />,  label:"SURVIVAL", color:"#00f6ff", shadow:"rgba(0,246,255,0.4)",  action: () => handleStartMode("survival")  },
        { id:"gauntlet",  icon:<IconGauntlet />, label:"GAUNTLET", color:"#ffe600", shadow:"rgba(255,230,0,0.38)",  action: () => handleStartMode("gauntlet")  },
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "settings": return [
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "worlds": return [
        back("BACK", () => { btn("back"); setMenuState("modes"); }, true),
      ];
      case "levels": return [
        back("WORLDS", () => { btn("back"); setMenuState("worlds"); }),
      ];
    }
  }, [menuState, btn, openShop, openInventory, handleStartMode]);

  // ── Content panels ────────────────────────────────────────────────────────
  const renderContent = () => {
    if (menuState === "worlds") {
      const selectedColor = WORLD_COLORS[selectedWorld - 1];
      return (
        <div
          className="orblitz-world-carousel"
          tabIndex={0}
          role="region"
          aria-label="Arcade world carousel"
          onKeyDown={handleWorldKeyDown}
          onPointerDown={(event) => { worldPointerStartX.current = event.clientX; worldSwipeRef.current = false; }}
          onPointerUp={(event) => {
            const start = worldPointerStartX.current;
            worldPointerStartX.current = null;
            if (start === null || Math.abs(event.clientX - start) < 36) return;
            worldSwipeRef.current = true;
            moveWorld(event.clientX < start ? 1 : -1);
          }}
          onPointerCancel={() => { worldPointerStartX.current = null; worldSwipeRef.current = false; }}
        >
          <div className="orblitz-world-carousel-stage">
            <button
              type="button"
              className="orblitz-carousel-arrow orblitz-carousel-arrow-prev"
              onClick={() => moveWorld(-1)}
              aria-label="Previous world"
              data-testid="button-world-previous"
            >
              <IconChevron direction="previous" />
            </button>
            <div className="orblitz-world-carousel-window">
              <div className="orblitz-world-side-rail" aria-hidden="true">
                <span className="orblitz-world-rail-line" />
                <span className="orblitz-world-rail-dot" style={{ background: selectedColor }} />
              </div>
              {[-1, 0, 1].map((offset) => {
                const world = ((selectedWorld - 1 + offset + 9) % 9) + 1;
                const unlocked = isWorldUnlocked(world);
                const wc = WORLD_COLORS[world - 1];
                const done = world + 0.9 <= highestLevel + 0.01;
                const isCurrent = offset === 0;
                return (
                  <motion.button
                    key={`${world}-${selectedWorld}`}
                    type="button"
                    onClick={() => {
                      if (worldSwipeRef.current) {
                        worldSwipeRef.current = false;
                        return;
                      }
                      openWorldLevels(world);
                    }}
                    disabled={!unlocked}
                    data-testid={`button-world-${world}`}
                    aria-label={unlocked ? `Select World ${world}, ${WORLD_NAMES[world - 1]}` : `World ${world} locked`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`orblitz-world-card ${isCurrent ? "is-current" : "is-adjacent"} ${unlocked ? "is-unlocked" : "is-locked"} ${done ? "is-complete" : ""}`}
                    style={{
                      "--world-color": unlocked ? wc : "#536079",
                      "--world-shadow": unlocked ? WORLD_SHADOWS[world - 1] : "rgba(50,62,85,0.3)",
                    } as React.CSSProperties}
                    initial={{ opacity: 0, x: offset < 0 ? -28 : 28 }}
                    animate={{ opacity: isCurrent ? 1 : 0.58, x: 0, scale: isCurrent ? 1 : 0.82, rotateY: isCurrent ? 0 : offset < 0 ? 7 : -7 }}
                    transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
                    whileHover={unlocked ? { y: -4, opacity: 1 } : undefined}
                    whileTap={unlocked ? { scale: isCurrent ? 0.97 : 0.79 } : undefined}
                  >
                    <span className="orblitz-world-card-grid" />
                    <span className="orblitz-world-card-corner orblitz-world-card-corner-tl" />
                    <span className="orblitz-world-card-corner orblitz-world-card-corner-br" />
                    <span className="orblitz-world-card-index">WORLD {String(world).padStart(2, "0")}</span>
                    <span className="orblitz-world-card-signal">{done ? "COMPLETE" : unlocked ? "READY TO PLAY" : "LOCKED"}</span>
                    <span className="orblitz-world-card-art" aria-hidden="true">
                      {!unlocked && <span className="orblitz-world-card-lock"><IconLock /></span>}
                    </span>
                    <span className="orblitz-world-card-copy">
                      <strong>{WORLD_NAMES[world - 1]}</strong>
                    </span>
                    <span className="orblitz-world-card-footer">
                      <span>{done ? "CLEARED" : unlocked ? "READY" : "LOCKED"}</span>
                      <span className="orblitz-world-card-status-dot" />
                    </span>
                  </motion.button>
                );
              })}
              <div className="orblitz-world-side-rail is-right" aria-hidden="true">
                <span className="orblitz-world-rail-line" />
                <span className="orblitz-world-rail-dot" style={{ background: selectedColor }} />
              </div>
            </div>
            <button
              type="button"
              className="orblitz-carousel-arrow orblitz-carousel-arrow-next"
              onClick={() => moveWorld(1)}
              aria-label="Next world"
              data-testid="button-world-next"
            >
              <IconChevron direction="next" />
            </button>
          </div>

          <div className="orblitz-world-index" aria-label="World positions">
            {WORLD_COLORS.map((color, index) => {
              const world = index + 1;
              const active = world === selectedWorld;
              const unlocked = isWorldUnlocked(world);
              return (
                <button
                  key={world}
                  type="button"
                  className={`orblitz-world-index-button ${active ? "is-active" : ""} ${unlocked ? "" : "is-locked"}`}
                  onClick={() => setSelectedWorld(world)}
                  disabled={!unlocked}
                  aria-label={`Focus World ${world}`}
                  aria-current={active ? "true" : undefined}
                  style={{ "--world-color": unlocked ? color : "#536079" } as React.CSSProperties}
                >
                  <span>{String(world).padStart(2, "0")}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (menuState === "levels") {
      const wc = WORLD_COLORS[selectedWorld - 1];
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => i + 1).map(sub => {
            const level = selectedWorld + sub / 10;
            const unlocked = isLevelUnlocked(level);
            const boss = isBossLevel(level);
            const completed = level <= highestLevel;
            const bc = boss ? "#ff4444" : wc;
            return (
              <motion.button key={sub}
                onClick={() => { if (unlocked) { btn(`l${level}`); try { stopMenuBgm(); } catch {} useOrbTransition.getState().loadingSweep(() => { setGameMode("arcade"); startLoading("nextLevel", level); }); } }}
                disabled={!unlocked}
                data-testid={`button-level-${selectedWorld}-${sub}`}
                aria-label={unlocked ? `Select level ${selectedWorld}.${sub}` : `Level ${selectedWorld}.${sub} locked`}
                className={`orblitz-select-card ${unlocked ? "is-unlocked" : "is-locked"} ${boss ? "is-boss" : ""} ${completed ? "is-complete" : ""}`}
                style={{
                  "--select-color": unlocked ? bc : "#536079",
                  background: unlocked
                    ? `linear-gradient(145deg, rgba(220,252,255,0.13), ${bc}28 42%, rgba(7,12,38,0.94) 100%)`
                    : "linear-gradient(145deg, rgba(120,135,160,0.1), rgba(11,16,39,0.96))",
                  borderColor: unlocked ? `${bc}aa` : "rgba(104,118,148,0.3)",
                  boxShadow: unlocked
                    ? `5px 7px 0 rgba(3,7,26,0.72), 0 0 18px ${bc}42, inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.44)`
                    : "5px 7px 0 rgba(3,7,26,0.72), inset 1px 1px 0 rgba(255,255,255,0.08)",
                  color: unlocked ? bc : "#445",
                  cursor: unlocked ? "pointer" : "default",
                } as React.CSSProperties}
                whileHover={unlocked ? { scale: 1.035, y: -2 } : {}}
                whileTap={unlocked ? { scale: 0.96 } : {}}
              >
                <span className="orblitz-select-corner orblitz-select-corner-tl" />
                <span className="orblitz-select-corner orblitz-select-corner-br" />
                {unlocked ? (
                  <>
                     <span className="orblitz-select-index">LEVEL {String(sub).padStart(2, "0")}</span>
                    <span className="orblitz-select-number">{selectedWorld}.{sub}</span>
                     <span className="orblitz-select-label">{boss ? "BOSS FIGHT" : `${getOrbGoal(selectedWorld, sub)} ORBS`}</span>
                     <span className="orblitz-select-status">{completed ? "COMPLETE" : boss ? "BOSS AHEAD" : "READY"}</span>
                    {completed && <span className="orblitz-select-status-dot" style={{ background: bc }} />}
                  </>
                ) : (
                  <>
                    <span className="orblitz-select-locked-icon" aria-hidden="true"><IconLock /></span>
                    <span className="orblitz-select-label">LOCKED</span>
                     <span className="orblitz-select-status">COMPLETE EARLIER LEVELS</span>
                  </>
                )}
              </motion.button>
            );
          })}
        </>
      );
    }

    return null;
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const showSplash  = animPhase === "splash";
  const showTitle   = animPhase === "title" || animPhase === "waiting" || animPhase === "menu";
  const showMenu    = animPhase === "menu";
  const isContent   = showMenu && (menuState === "worlds" || menuState === "levels");
  const panelButtons = showMenu ? getPanelButtons() : [];
  const introPhase: IntroBossPhase | null =
    animPhase === "splash" || animPhase === "idle" || animPhase === "flying" || animPhase === "converge" || animPhase === "flash" ||
    animPhase === "title" || animPhase === "waiting" || animPhase === "menu"
      ? (animPhase === "splash" ? "idle" : animPhase)
      : null;

  useEffect(() => {
    onIntroPhaseChange?.(introPhase, menuState, selectedWorld);
  }, [introPhase, menuState, onIntroPhaseChange, selectedWorld]);

  useEffect(() => () => onIntroPhaseChange?.(null), [onIntroPhaseChange]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black select-none"
      style={{
        cursor: "default",
        backgroundColor: showSplash ? "rgba(1,6,18,0.98)" : showMenu ? "rgba(5,8,28,0.2)" : "transparent",
        transition: "background-color 0.75s ease",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* ── CELESTIAL ATMOSPHERE ───────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
        zIndex: 0,
        opacity: showMenu ? 0.72 : 0.1,
        transition: "opacity 0.45s ease",
        background: "radial-gradient(ellipse at 50% 42%, rgba(67,22,134,0.3) 0%, rgba(9,70,105,0.18) 42%, transparent 80%), linear-gradient(135deg, rgba(4,17,57,0.16), rgba(60,8,72,0.18) 52%, rgba(0,42,60,0.16))",
      }}>
        <div className="absolute inset-0" style={{
          opacity: 0.16,
          backgroundImage: "linear-gradient(rgba(0,246,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,43,214,0.28) 1px, transparent 1px)",
          backgroundSize: "clamp(26px, 3.7vw, 54px) clamp(26px, 3.7vw, 54px)",
          maskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
        }} />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(65vw, 720px)", height: "min(42vw, 460px)",
            left: "7%", top: "8%",
            background: "radial-gradient(ellipse, rgba(0,246,255,0.24), rgba(0,246,255,0.05) 48%, transparent 72%)",
            filter: "blur(12px)",
          }}
          animate={{ x: ["-4%", "8%", "-4%"], y: ["2%", "-5%", "2%"], scale: [1, 1.08, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(54vw, 620px)", height: "min(45vw, 500px)",
            right: "-8%", bottom: "3%",
            background: "radial-gradient(ellipse, rgba(255,43,214,0.24), rgba(255,43,214,0.05) 52%, transparent 74%)",
            filter: "blur(14px)",
          }}
          animate={{ x: ["3%", "-7%", "3%"], y: ["-4%", "5%", "-4%"], scale: [1.05, 0.94, 1.05] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(34vw, 390px)", height: "min(34vw, 390px)",
            left: "50%", top: "45%", transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(255,230,0,0.14), rgba(155,92,255,0.1) 48%, transparent 72%)",
            filter: "blur(4px)",
          }}
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute"
          style={{
            width: "min(74vw, 760px)", height: "min(36vw, 360px)",
            left: "50%", top: "43%", marginLeft: "min(-37vw, -380px)", marginTop: "min(-18vw, -180px)",
            border: "1px solid rgba(0,246,255,0.32)", borderRadius: "50%",
            transform: "rotate(-12deg)",
            boxShadow: "0 0 80px rgba(0,246,255,0.16), inset 0 0 72px rgba(255,43,214,0.12)",
          }}
          animate={{ rotate: [0, 5, 0], scale: [1, 1.025, 1] }}
          transition={{ rotate: { duration: 18, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}
        />
        <div className="absolute left-[14%] top-[24%] h-2 w-2 rounded-sm" style={{ background: "#ffe600", boxShadow: "0 0 24px 7px rgba(255,230,0,0.38)" }} />
        <div className="absolute right-[18%] bottom-[28%] h-1.5 w-1.5 rounded-sm" style={{ background: "#ff2bd6", boxShadow: "0 0 20px 6px rgba(255,43,214,0.38)" }} />
      </div>

      {/* ── STANDARD GAME SPLASH ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            className="relative z-10 flex flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <p style={{
              margin: "0 0 18px", color: "rgba(200,244,255,0.72)",
              fontSize: "clamp(0.48rem, 1.1vw, 0.7rem)", fontWeight: 900,
              letterSpacing: "0.34em", fontFamily: "Arial Black, Impact, sans-serif",
            }}>
              ORBLITZTEAM PRESENTS
            </p>
            <h1 style={{
              margin: 0, color: "#e8fcff", fontSize: "clamp(3.4rem, 11vw, 7rem)",
              lineHeight: 0.9, fontWeight: 900, letterSpacing: "0.075em",
              fontFamily: "Arial Black, Impact, sans-serif",
              textShadow: "0 0 16px rgba(0,246,255,0.72), 5px 5px 0 rgba(10,20,68,0.8)",
            }}>
              ORBLITZ
            </h1>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginTop: 28,
              color: "rgba(226,249,255,0.78)", fontSize: "clamp(0.46rem, 1vw, 0.62rem)",
              fontWeight: 900, letterSpacing: "0.16em", fontFamily: "Arial Black, Impact, sans-serif",
            }}>
              <div style={{
                width: 36, height: 42, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                border: "2px solid rgba(226,249,255,0.8)", color: "#fff",
                lineHeight: 1, letterSpacing: 0,
              }}>
                <strong style={{ fontSize: 22 }}>E</strong>
                <span style={{ fontSize: 7, marginTop: 3 }}>EVERYONE</span>
              </div>
              <div style={{ textAlign: "left", lineHeight: 1.8 }}>
                <div>DEVELOPED &amp; PUBLISHED BY ORBLITZTEAM</div>
                <div style={{ color: "#ffe600" }}>© 2026 ORBLITZTEAM</div>
                <div style={{ color: "rgba(200,244,255,0.56)" }}>ALL RIGHTS RESERVED</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The boss collision hands off to one synchronized full-screen flash. */}
      <BrightFlashTransition phase={animPhase} />

      {/* ── ORBLITZ TITLE — pinned at viewport center, never moves ─────── */}
      <AnimatePresence>
        {showTitle && (
             <motion.div className="absolute z-10 text-center orblitz-title-lockup"
            style={{ top: "50%", left: 0, right: 0 }}
            initial={{ opacity: 0, scale: 0.92, y: "-50%" }}
            animate={{ opacity: showMenu ? 1 : 0, scale: showMenu ? 1 : 0.92, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.8, y: "-50%" }}
            transition={{ duration: showMenu ? 0.45 : 0.2, delay: showMenu ? MENU_TITLE_REVEAL_DELAY : 0, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* One persistent title node: the reveal becomes the interactive menu title in place. */}
            <motion.h1
               className={`font-black tracking-widest flex items-center justify-center orblitz-title-wordmark${showMenu ? "" : " pointer-events-none"}`}
              style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1,
                fontFamily: "Arial Black, Impact, sans-serif", fontWeight: 900, fontStyle: "normal",
                letterSpacing: "0.075em", transform: "none",
                WebkitTextStroke: "2px rgba(210,252,255,0.22)",
                textShadow: "5px 5px 0 rgba(10,20,68,0.65), 0 0 18px rgba(190,245,255,0.32)",
                filter: devFlash ? "drop-shadow(0 0 30px #ffff00) drop-shadow(0 0 60px #ffaa00)" : undefined,
                transition: devFlash ? "filter 0.1s" : undefined,
              }}
            >
              {TITLE_LETTERS.map((letter, idx) => (
                <motion.span key={idx} className={showMenu ? "cursor-pointer" : undefined}
                  ref={(node) => { titleLetterRefs.current[idx] = node; }}
                  style={getTitleReflectionStyle(idx)}
                  animate={{
                    backgroundPosition: [
                      "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
                      "0% 0%, 100% 100%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 130% 0%",
                      "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
                    ],
                    filter: [
                      "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
                      "drop-shadow(0 0 12px rgba(255,255,255,0.66)) saturate(1.16)",
                      "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
                    ],
                    opacity: idx < devProgress ? 0.4 : 1,
                  }}
                  transition={{
                    backgroundPosition: { duration: 8.5 + idx * 0.45, repeat: Infinity, ease: "easeInOut", delay: idx * 0.12 },
                    filter: { duration: 8.5 + idx * 0.45, repeat: Infinity, ease: "easeInOut", delay: idx * 0.12 },
                    opacity: { duration: 0.2 },
                  }}
                  whileHover={showMenu ? { scale: 1.14, y: -3 } : undefined}
                  whileTap={showMenu ? { scale: 0.9 } : undefined}
                  onClick={showMenu ? (e) => { e.stopPropagation(); handleLetterClick(letter, idx); } : undefined}
                >{letter}</motion.span>
              ))}
            </motion.h1>

            {/* Underline */}
            <motion.div className="mt-3 mx-auto" style={{
              height: "clamp(5px, 0.8vw, 8px)", width: "clamp(160px, 36vw, 280px)",
              borderRadius: 3,
              background: "linear-gradient(90deg,transparent 0%,#00f6ff 18%,#ff2bd6 18%,#ff2bd6 36%,#ffe600 36%,#ffe600 54%,#7cff00 54%,#7cff00 72%,#9b5cff 72%,#9b5cff 88%,transparent 88%)",
              boxShadow: "0 4px 0 rgba(10,20,68,0.45), 0 0 16px rgba(0,246,255,0.5)",
            }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.65 }}
              transition={{ duration: 0.9, delay: animPhase === "title" ? 0.68 : 0.25, ease: "easeOut" }}
            />

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STAR BALANCE — dedicated arcade HUD counter ─────────────────── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-30 pointer-events-none"
            aria-label={`${shopStars} stars`}
            style={{
              top: "clamp(16px, 4vh, 38px)",
              right: "clamp(16px, 4vw, 44px)",
              minWidth: "clamp(142px, 17vw, 196px)",
              padding: "8px 13px 8px 9px",
              border: "1px solid rgba(255,230,120,0.72)",
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(102,58,16,0.42) 44%, rgba(255,196,48,0.14))",
              boxShadow: "4px 5px 0 rgba(5,10,34,0.58), 0 0 22px rgba(255,193,46,0.22), inset 0 1px 0 rgba(255,255,255,0.3)",
              backdropFilter: "blur(8px)",
            }}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ delay: MENU_SECONDARY_REVEAL_DELAY }}
          >
            <div style={{
              position: "absolute", top: 0, left: 12, right: 12, height: 2,
              background: "linear-gradient(90deg, transparent, #fff3a1 24%, #ffe600 50%, transparent)",
              boxShadow: "0 0 9px rgba(255,230,0,0.8)",
            }} />
            <div className="flex items-center gap-2">
              <motion.div
                aria-hidden="true"
                animate={{ rotate: [0, 5, -3, 0], scale: [1, 1.06, 1] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  flex: "0 0 auto", width: "clamp(30px, 3.6vw, 42px)", height: "clamp(30px, 3.6vw, 42px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#ffe600", border: "1px solid rgba(255,244,171,0.82)", borderRadius: 8,
                  background: "radial-gradient(circle, rgba(255,247,175,0.42), rgba(255,186,28,0.14) 58%, rgba(255,186,28,0.03))",
                  boxShadow: "0 0 12px rgba(255,230,0,0.62), inset 0 0 10px rgba(255,247,175,0.18)",
                }}
              >
                <IconStar />
              </motion.div>
              <div style={{ minWidth: 0, lineHeight: 1 }}>
                <div style={{
                  color: "rgba(255,244,195,0.72)", fontSize: "clamp(0.4rem, 0.7vw, 0.52rem)",
                  fontWeight: 900, letterSpacing: "0.18em", fontFamily: "Arial Black, Impact, sans-serif",
                  marginBottom: 5,
                }}>
                  STAR BANK
                </div>
                <div style={{
                  display: "flex", alignItems: "baseline", gap: 5, color: "#fff8c9",
                  fontSize: "clamp(1rem, 2vw, 1.38rem)", fontWeight: 900, letterSpacing: "0.04em",
                  fontFamily: "Arial Black, Impact, sans-serif", textShadow: "0 0 10px rgba(255,230,0,0.45)",
                }}>
                  <span>{shopStars.toLocaleString()}</span>
                  <span style={{ color: "#ffe600", fontSize: "clamp(0.42rem, 0.75vw, 0.56rem)", letterSpacing: "0.12em" }}>STARS</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMMAND DECK (root / modes) — title owns the center ─────────── */}
      <AnimatePresence mode="sync">
        {showMenu && !isContent && (
          <motion.div
            key={menuState}
            className="absolute inset-0 z-20"
            style={{
              pointerEvents: menuState === "settings" ? "auto" : "none",
              padding: menuState === "settings" ? "0 clamp(10px, 3.5vw, 44px)" : 0,
              ...(menuState === "settings" ? {
                top: "calc(50% + clamp(48px, 8vh, 72px))",
                bottom: "auto",
                maxHeight: "calc(50dvh - clamp(16px, 8vh, 72px))",
                overflowY: "auto" as const,
                overscrollBehavior: "contain" as const,
                paddingBottom: "clamp(8px, 2vh, 16px)",
                scrollbarWidth: "thin" as const,
              } : {}),
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: MENU_NAVIGATION_DELAY, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {menuState === "settings"
              ? <SettingsButtonRow
                  isMuted={isMuted} toggleMute={toggleMute}
                  volume={volume} setVolume={setVolume}
                  brightness={brightness} setBrightness={setBrightness}
                  graphicsPreset={graphicsPreset} setGraphicsPreset={setGraphicsPreset}
                  onBack={() => setMenuState("root")} btn={btn}
                />
              : <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL-SCREEN WORLDS / LEVELS POPUP ───────────────────────────── */}
      <AnimatePresence mode="wait">
        {showMenu && isContent && (
          <motion.div
            key={menuState}
            className={`fixed inset-0 z-[150] flex flex-col orblitz-selection-screen ${menuState === "worlds" ? "orblitz-world-select" : ""}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex-none orblitz-selection-header">
              <p data-testid={`text-${menuState}-title`} className="font-black tracking-widest uppercase" style={{
                color: menuState === "worlds" ? "#00ffff" : WORLD_COLORS[selectedWorld - 1],
                fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
                letterSpacing: "0.22em",
                textShadow: `0 0 18px ${menuState === "worlds" ? "rgba(0,255,255,0.5)" : `${WORLD_COLORS[selectedWorld - 1]}88`}`,
              }}>
                {menuState === "worlds" ? "Select World" : `World ${selectedWorld}`}
              </p>
              <span className="orblitz-selection-subtitle">{menuState === "worlds" ? "Choose a world to play" : "Choose a level to play"}</span>
            </div>

             {/* Responsive world carousel / level grid */}
            <div className="flex-1 min-h-0 flex flex-col orblitz-selection-content">
               {menuState === "worlds" ? renderContent() : (
                 <div className="grid grid-cols-3 gap-2 h-full orblitz-selection-grid" style={{ gridAutoRows: "1fr" }}>
                   {renderContent()}
                 </div>
               )}
            </div>

             {/* Back button — icon-only on world select, text elsewhere */}
            <div className="flex-none border-t flex justify-center orblitz-selection-footer" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div style={{ width: "clamp(120px, 40vw, 200px)" }}>
                <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} compact />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Reusable button row ──────────────────────────────────────────────────────
interface ButtonRowProps {
  buttons: BtnDef[];
  pressedBtn: string | null;
  setPressedBtn: (id: string | null) => void;
  compact?: boolean;
}
function ButtonRow({ buttons, pressedBtn, setPressedBtn, compact = false }: ButtonRowProps) {
  const btnH = compact ? "clamp(48px,8vw,64px)" : "clamp(72px,10vw,96px)";
  const iconSz = compact ? "clamp(1rem,2.5vw,1.4rem)" : "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = compact ? "clamp(0.44rem,1.1vw,0.6rem)" : "clamp(0.48rem,1.25vw,0.68rem)";
  const isRoot = buttons.some((button) => button.id === "play");
  const layout = compact ? "compact" : isRoot ? "root" : "modes";

  return (
    <motion.div
      className={compact ? "orblitz-compact-stage flex flex-row items-stretch justify-center" : `orblitz-button-stage orblitz-layout-${layout}`}
      data-layout={layout}
      style={compact ? { gap: "clamp(5px,1.4vw,12px)" } : undefined}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
        hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
      }}
    >
      {buttons.map((b) => {
        const isPress = pressedBtn === b.id;
        const isPrimary = b.id === "play" || b.id === "arcade";
        return (
          <motion.button
            key={b.id}
            type="button"
            aria-label={b.label}
            className={`orblitz-command-button ${isPrimary ? "orblitz-command-primary" : ""} orblitz-command-${b.id} relative flex flex-col items-center justify-center overflow-hidden ${compact ? "flex-1" : ""}`}
            style={{
              position: compact ? "relative" : "absolute",
              minWidth: 0,
              maxWidth: compact ? (buttons.length === 1 ? "clamp(120px,32vw,200px)" : "clamp(52px,17vw,100px)") : undefined,
              height: btnH,
              borderRadius: "clamp(8px, 1.1vw, 14px)",
              border: `1px solid ${isPress ? b.color : b.color + "aa"}`,
              background: isPress
                ? `linear-gradient(145deg, ${b.color}70, ${b.color}28 64%, rgba(7,12,38,0.92))`
                : `linear-gradient(145deg, rgba(220,252,255,0.14), ${b.color}2b 42%, rgba(7,12,38,0.9) 100%)`,
              color: b.color,
              boxShadow: isPress
                ? `2px 3px 0 rgba(3,7,26,0.78), 0 0 30px ${b.shadow}, inset 0 0 20px ${b.color}35`
                : `5px 7px 0 rgba(3,7,26,0.72), 0 0 18px ${b.shadow}, inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 rgba(0,0,0,0.42)`,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(8px)",
              transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s, transform 0.14s",
            }}
            variants={{
              hidden:  { opacity: 0, y: 16, scale: 0.86 },
              visible: { opacity: 1, y: 0,  scale: 1,
                transition: { type: "spring", stiffness: 360, damping: 26 } },
            }}
            whileTap={{ scale: 0.9 }}
            onHoverStart={() => setPressedBtn(b.id)}
            onHoverEnd={() => setPressedBtn(null)}
            onPointerDown={() => setPressedBtn(b.id)}
            onPointerUp={() => setPressedBtn(null)}
            onPointerLeave={() => setPressedBtn(null)}
            onClick={b.action}
            data-testid={`button-menu-${b.id}`}
            data-active={isPress}
            data-orblitz-modal-opener={b.id === "shop" || b.id === "inventory" ? b.id : undefined}
          >
            {/* Material edge */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: 3,
              background: `linear-gradient(90deg,${b.color}00 0%,${b.color}cc 20%,rgba(255,255,255,0.95) 50%,${b.color}22 80%,${b.color}00 100%)`,
              opacity: isPress ? 1 : 0.72, transition: "opacity 0.14s",
            }} />
            {/* Glass pass */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(132deg, rgba(255,255,255,0.11), transparent 30%, transparent 58%, rgba(0,0,0,0.22))",
              borderRadius: "inherit",
            }} />
            {/* Icon */}
            <span style={{
              fontSize: iconSz, lineHeight: 1,
              marginBottom: compact ? "2px" : "clamp(2px,0.6vw,5px)",
               filter: `drop-shadow(0 0 7px ${b.color}88) drop-shadow(2px 2px 0 rgba(3,7,26,0.55))`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{b.icon}</span>
            {/* Label */}
            {!b.hideLabel && <span style={{
              fontSize: labelSz, fontWeight: 900,
              letterSpacing: "0.12em", lineHeight: 1, opacity: 0.96,
              fontFamily: "var(--font-display)",
            }}>{b.label}</span>}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── Settings button row: sound toggle + brightness slider + back ─────────────
function SettingsButtonRow({ isMuted, toggleMute, volume, setVolume, brightness, setBrightness, graphicsPreset, setGraphicsPreset, onBack, btn }: {
  isMuted: boolean; toggleMute: () => void;
  volume: number; setVolume: (v: number) => void;
  brightness: number; setBrightness: (v: number) => void;
  graphicsPreset: GraphicsPreset; setGraphicsPreset: (preset: GraphicsPreset) => void;
  onBack: () => void; btn: (id: string) => void;
}) {
  const btnH  = "clamp(68px,12vw,96px)";
  const iconSz = "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = "clamp(0.48rem,1.25vw,0.68rem)";
  const sc = isMuted ? "#8292ae" : "#00f6ff";
  const ss = isMuted ? "rgba(130,146,174,0.22)" : "rgba(0,246,255,0.4)";
  const bPct = Math.round(((brightness - 0.2) / 1.8) * 100);
  const vPct = Math.round(volume * 100);

  const itemVariants = {
    hidden:  { opacity: 0, y: 16, scale: 0.86 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: "spring" as const, stiffness: 360, damping: 26 } },
  };

  const btnStyle = (color: string, shadow: string): React.CSSProperties => ({
    height: btnH, borderRadius: "clamp(8px, 1.1vw, 14px)",
    border: `1px solid ${color}aa`,
    background: `linear-gradient(145deg, rgba(220,252,255,0.14), ${color}2b 42%, rgba(7,12,38,0.9) 100%)`,
    color, boxShadow: `5px 7px 0 rgba(3,7,26,0.72), 0 0 18px ${shadow}, inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 rgba(0,0,0,0.42)`,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(8px)",
    transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s, transform 0.14s",
    position: "relative" as const, overflow: "hidden" as const,
  });

  const TopLine = ({ color }: { color: string }) => (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
      height: 5, opacity: 0.7,
      background: `linear-gradient(90deg,${color}00 0%,${color}cc 22%,rgba(255,255,255,0.7) 48%,${color}22 78%,${color}00 100%)`,
    }} />
  );
  const Scanlines = () => (
    <div className="absolute inset-0 pointer-events-none" style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.08), transparent 42%, rgba(255,255,255,0.025))",
      borderRadius: "inherit",
    }} />
  );
  const presetOptions: { id: GraphicsPreset; label: string; detail: string; color: string }[] = [
    { id: "low", label: "LOW", detail: "0.8× · Efficient FX", color: "#00f6ff" },
    { id: "standard", label: "STANDARD", detail: "1.0× · Balanced FX", color: "#9b5cff" },
    { id: "high", label: "HIGH", detail: "1.4× · Maximum FX", color: "#ff2bd6" },
  ];

  return (
    <>
      <style>{`.orb-bslider{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;border-radius:2px}.orb-bslider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:3px;background:#ffe600;box-shadow:0 0 8px rgba(255,230,0,0.95)}.orb-bslider::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:3px;background:#ffe600;box-shadow:0 0 8px rgba(255,230,0,0.95)}.orb-vslider{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;border-radius:2px}.orb-vslider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:3px;background:#00f6ff;box-shadow:0 0 8px rgba(0,246,255,0.95)}.orb-vslider::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:3px;background:#00f6ff;box-shadow:0 0 8px rgba(0,246,255,0.95)}`}</style>
       <div className="flex flex-col w-full orblitz-options-deck" style={{ gap: "clamp(8px,1.5vw,14px)" }}>
        <motion.div
           className="relative flex flex-col items-center justify-center overflow-hidden w-full orblitz-options-control"
          style={{ ...btnStyle("#9b5cff", "rgba(155,92,255,0.44)"), height: "clamp(82px,14vw,108px)", cursor: "default", padding: "clamp(8px,1.5vw,14px)" }}
          initial={{ opacity: 0, y: 16, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
        >
          <TopLine color="#9b5cff" /><Scanlines />
          <div className="flex items-center justify-between w-full" style={{ marginBottom: 7 }}>
            <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.16em", opacity: 0.9 }}>GRAPHICS</span>
            <span style={{ fontSize: "clamp(0.42rem,1vw,0.56rem)", color: "#cbbcff", letterSpacing: "0.1em", opacity: 0.65 }}>
              {presetOptions.find(option => option.id === graphicsPreset)?.detail.toUpperCase()}
            </span>
          </div>
          <div className="flex w-full" style={{ gap: "clamp(5px,1.2vw,10px)" }}>
            {presetOptions.map(option => {
              const selected = graphicsPreset === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`button-graphics-${option.id}`}
                  aria-pressed={selected}
                  onClick={() => { btn(`graphics-${option.id}`); setGraphicsPreset(option.id); }}
                  style={{
                    flex: 1, height: "clamp(30px,5vw,42px)", borderRadius: 8,
                    border: `1px solid ${selected ? option.color : option.color + "55"}`,
                    background: selected ? `${option.color}30` : "rgba(0,0,0,0.22)",
                    color: selected ? "#fff" : `${option.color}bb`,
                    boxShadow: selected ? `0 0 10px ${option.color}55, inset 0 0 10px ${option.color}18` : "none",
                    fontSize: "clamp(0.44rem,1.1vw,0.62rem)", fontWeight: 900, letterSpacing: "0.1em",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-row items-stretch justify-center w-full"
          style={{ gap: "clamp(6px,1.8vw,16px)" }}
          initial="hidden" animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
            hidden:  { transition: { staggerChildren: 0.03,  staggerDirection: -1 } },
          }}
        >
        {/* BRIGHTNESS slider */}
        <motion.div
           className="relative flex flex-col items-center justify-center overflow-hidden flex-[2] orblitz-options-control"
          style={{ ...btnStyle("#ffe600", "rgba(255,230,0,0.4)"), minWidth: 0, cursor: "default",
            padding: "0 clamp(6px,1.5vw,14px)" }}
          variants={itemVariants}
        >
          <TopLine color="#ffe600" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: 2, filter: "drop-shadow(0 0 5px #ffe600aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconBrightness />
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88, marginBottom: 5 }}>
            BRIGHTNESS
          </span>
          <input
            type="range" min={0.2} max={2.0} step={0.05}
            value={brightness}
            aria-label="Brightness"
            data-testid="input-brightness"
            onChange={e => setBrightness(Number(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="orb-bslider"
            style={{
              width: "100%", height: 4,
              background: `linear-gradient(90deg,#ffe600 ${bPct}%,rgba(255,255,255,0.15) ${bPct}%)`,
            }}
          />
          <span style={{ fontSize: "clamp(0.38rem,1vw,0.5rem)", opacity: 0.4, marginTop: 3, letterSpacing: "0.1em" }}>
            {bPct}%
          </span>
        </motion.div>

        {/* VOLUME slider */}
        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden flex-[2] orblitz-options-control"
          style={{ ...btnStyle("#00f6ff", "rgba(0,246,255,0.4)"), minWidth: 0, cursor: "default",
            padding: "0 clamp(6px,1.5vw,14px)" }}
          variants={itemVariants}
        >
          <TopLine color="#00f6ff" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: 2, filter: "drop-shadow(0 0 5px #00f6ffaa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isMuted ? <IconSoundOff /> : <IconSound />}
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88, marginBottom: 5 }}>
            VOLUME
          </span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={volume}
            aria-label="Volume"
            data-testid="input-volume"
            onChange={e => setVolume(Number(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="orb-vslider"
            style={{
              width: "100%", height: 4,
              background: `linear-gradient(90deg,#00f6ff ${vPct}%,rgba(255,255,255,0.15) ${vPct}%)`,
            }}
          />
          <span style={{ fontSize: "clamp(0.38rem,1vw,0.5rem)", opacity: 0.4, marginTop: 3, letterSpacing: "0.1em" }}>
            {vPct}%
          </span>
        </motion.div>

        {/* MUTE / UNMUTE */}
        <motion.button
          type="button"
          className="relative flex flex-col items-center justify-center overflow-hidden flex-1 orblitz-options-control"
          style={{ ...btnStyle(sc, ss), minWidth: 0, maxWidth: "clamp(52px,17vw,100px)" }}
          variants={itemVariants} whileTap={{ scale: 0.9 }}
          onClick={() => { btn("sound"); toggleMute(); }}
          data-testid="button-sound-toggle"
        >
          <TopLine color={sc} /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 5px ${sc}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isMuted ? <IconSoundOff /> : <IconSound />}
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
            {isMuted ? "UNMUTE" : "MUTE"}
          </span>
        </motion.button>

        {/* BACK */}
        <motion.button
          type="button"
          className="relative flex flex-col items-center justify-center overflow-hidden flex-1 orblitz-options-control"
          style={{ ...btnStyle("#667788", "rgba(100,110,130,0.2)"), minWidth: 0, maxWidth: "clamp(52px,17vw,100px)" }}
          variants={itemVariants} whileTap={{ scale: 0.9 }}
          onClick={() => { btn("back"); onBack(); }}
          data-testid="button-settings-back"
        >
          <TopLine color="#667788" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: "drop-shadow(0 0 5px #66778888)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
            BACK
          </span>
        </motion.button>
        </motion.div>
      </div>
    </>
  );
}
