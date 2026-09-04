import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
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
type AnimPhase = "splash" | "idle" | "flying" | "converge" | "flash" | "backdrop" | "background" | "title" | "waiting" | "menu" | "done";
export type MenuState = "root" | "modes" | "settings" | "worlds" | "levels";

interface StartupAnimationProps {
  skipIntro?: boolean;
  initialState?: MenuState;
  worldRosterReady?: boolean;
  onMenuReady?: () => void;
  onIntroPhaseChange?: (
    phase: IntroBossPhase | null,
    menuState?: MenuState,
    selectedWorld?: number,
    worldPreviewVisible?: boolean,
  ) => void;
}

// ─── World palette (9 worlds, spans the title gradient arc) ──────────────────
const WORLD_COLORS = [
  "#00f6ff","#9b5cff","#ff2bd6","#ff6b35","#ffe600",
  "#7cff00","#ff9f1c","#b45cff","#00e5ff",
];
const WORLD_SHADOWS = WORLD_COLORS.map(c => c + "55");
const WORLD_NAMES = [
  "Firefall Reach", "Starborn Expanse", "Crystal Bastion", "Toxic Mire", "Plasma Forge",
  "Diamond Crown", "Rainbow Rift", "Mecha Graveyard", "Monster Wilds",
] as const;
const STELLAR_MAP_POINTS = [
  { x: 9, y: 68 },
  { x: 20, y: 42 },
  { x: 32, y: 67 },
  { x: 44, y: 35 },
  { x: 56, y: 54 },
  { x: 67, y: 27 },
  { x: 77, y: 49 },
  { x: 86, y: 22 },
  { x: 91, y: 70 },
] as const;
const STELLAR_MAP_ROUTE = "M 9 68 C 13 57, 15 47, 20 42 S 28 55, 32 67 S 39 45, 44 35 S 52 42, 56 54 S 62 34, 67 27 S 73 41, 77 49 S 83 30, 86 22 S 90 54, 91 70";

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
const MENU_TITLE_REVEAL_DELAY = 0;
const MENU_SECONDARY_REVEAL_DELAY = MENU_TITLE_REVEAL_DELAY + 0.38;
const MENU_NAVIGATION_DELAY = 0.18;
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
  initialState = "root",
  worldRosterReady = true,
  onMenuReady,
  onIntroPhaseChange,
}: StartupAnimationProps) {
  const startsInCarousel = initialState === "worlds" || initialState === "levels";
  const [animPhase] = useState<AnimPhase>("menu");
  const [menuState, setMenuState] = useState<MenuState>(startsInCarousel ? "modes" : initialState);
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [devProgress, setDevProgress] = useState(0);
  const [devFlash, setDevFlash]       = useState(false);
  const [highestLevel, setHighestLevel] = useState(1.1);
  const [pressedBtn, setPressedBtn]   = useState<string | null>(null);
  const [arcadeTransition, setArcadeTransition] = useState<"idle" | "fadeOut" | "waiting" | "fadeIn">("idle");
  const [arcadeTransitionTarget, setArcadeTransitionTarget] = useState<"worlds" | "modes" | null>(null);
  const [worldScreenMounted, setWorldScreenMounted] = useState(startsInCarousel);
  const [carouselView, setCarouselView] = useState<"worlds" | "levels">(
    initialState === "levels" ? "levels" : "worlds",
  );
  const [carouselOpen, setCarouselOpen] = useState(startsInCarousel);
  const worldPointerStartX = useRef<number | null>(null);
  const worldSwipeRef = useRef(false);

  const { playLevelSelect, isMuted, toggleMute, volume, setVolume, brightness, setBrightness, startMenuBgm, stopMenuBgm } = useAudio();
  const { openShop, openInventory, openTrophies, activateDevMode, coins: shopStars, devMode } = useShop();
  const { setGameMode, startLoading } = useMagicOrb();
  const graphicsPreset = useGraphicsPreset();
  const titleLetterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  useTitleRefraction(titleLetterRefs, animPhase);
  const visualMenuState = menuState === "modes" ? "root" : menuState;

  // Reload progress when entering menu
  useEffect(() => {
    setHighestLevel(getStoredProgress());
  }, [menuState]);

  // Menu is immediately interactive. Keep the callback contract so App can
  // continue driving the shared GameScene without a second renderer or gate.
  useEffect(() => {
    onMenuReady?.();
    try { startMenuBgm(); } catch {}
  }, [onMenuReady, startMenuBgm]);

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

  const handleOpenArcade = useCallback(() => {
    btn("arcade");
    // Each ARCADE entry starts at the first world. Keep this reset at the
    // handoff boundary so the DOM cards and shared WebGL roster share one
    // deterministic anchor after returning from a previous carousel visit.
    setSelectedWorld(1);
    setCarouselView("worlds");
    setWorldScreenMounted(true);
    setArcadeTransitionTarget("worlds");
    setArcadeTransition("fadeOut");
  }, [btn]);

  const handleCloseArcade = useCallback(() => {
    btn("back");
    setArcadeTransitionTarget("modes");
    setArcadeTransition("fadeOut");
  }, [btn]);

  useEffect(() => {
    if (arcadeTransition === "waiting" && worldRosterReady) {
      setArcadeTransition("fadeIn");
    }
  }, [arcadeTransition, worldRosterReady]);

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
    // World selection is an in-place view change, not a second transition.
    // Reassert visibility so a late fade callback cannot leave the map hidden.
    setCarouselOpen(true);
    setCarouselView("levels");
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

  useEffect(() => {
    if (carouselView !== "worlds" || typeof document === "undefined") return;
    const activeCard = document.querySelector<HTMLElement>(
      `[data-testid="button-world-${selectedWorld}"]`,
    );
    activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [carouselView, selectedWorld]);

  // ── Button definitions per state ──────────────────────────────────────────
  const getPanelButtons = useCallback((state: MenuState = menuState): BtnDef[] => {
    const back = (label: string, action: () => void, hideLabel = false): BtnDef =>
      ({ id: "back", icon: <IconBack />, label, color: "#667788", shadow: "rgba(100,110,130,0.25)", action, hideLabel });

    switch (state) {
       case "root": return [
         { id:"play",      icon:<IconPlay />,     label:"PLAY",     color:"#c7f23d", shadow:"rgba(199,242,61,0.34)", action: () => { btn("play");      setMenuState("modes");    } },
         { id:"shop",      icon:<IconShop />,     label:"SHOP",     color:"#ff6f43", shadow:"rgba(255,111,67,0.3)", action: () => { btn("shop");      openShop();               } },
         { id:"inventory", icon:<IconGear />,     label:"GEAR",     color:"#6eaaa0", shadow:"rgba(110,170,160,0.3)", action: () => { btn("inventory"); openInventory();          } },
         { id:"trophies",  icon:<IconTrophy />,   label:"TROPHIES",  color:"#e9e3cf", shadow:"rgba(233,227,207,0.24)", action: () => { btn("trophies"); openTrophies(); } },
         { id:"settings",  icon:<IconSettings />, label:"OPTIONS",  color:"#a9ad96", shadow:"rgba(169,173,150,0.26)", action: () => { btn("settings");  setMenuState("settings"); } },
      ];
       case "modes": return [
         { id:"play",      icon:<IconPlay />,     label:"ARCADE",   color:"#c7f23d", shadow:"rgba(199,242,61,0.34)", action: handleOpenArcade },
         { id:"shop",      icon:<IconShop />,     label:"CHILL",    color:"#ff6f43", shadow:"rgba(255,111,67,0.3)", action: () => handleStartMode("chill") },
         { id:"inventory", icon:<IconGear />,     label:"SURVIVAL", color:"#6eaaa0", shadow:"rgba(110,170,160,0.3)", action: () => handleStartMode("survival") },
         { id:"trophies",  icon:<IconTrophy />,   label:"GAUNTLET", color:"#e9e3cf", shadow:"rgba(233,227,207,0.24)", action: () => handleStartMode("gauntlet") },
         { id:"settings",  icon:<IconSettings />, label:"BACK",    color:"#a9ad96", shadow:"rgba(169,173,150,0.26)", action: () => { btn("back"); setMenuState("root"); } },
       ];
      case "settings": return [
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "worlds": return [
        back("BACK", handleCloseArcade, true),
      ];
      case "levels": return [
         back("WORLDS", () => {
           btn("back");
           setCarouselOpen(true);
           setCarouselView("worlds");
         }),
      ];
    }
  }, [menuState, btn, openShop, openInventory, handleOpenArcade, handleCloseArcade, handleStartMode]);

  // ── Content panels ────────────────────────────────────────────────────────
  const renderContent = (viewState: "worlds" | "levels") => {
    if (viewState === "worlds") {
      return (
        <div
          className="orblitz-world-carousel"
          tabIndex={0}
          role="region"
          aria-label="Arcade world navigation"
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
          <div className="orblitz-world-carousel-topline">
            <span>WORLD NAVIGATION</span>
            <span className="orblitz-world-carousel-hint">LEFT / RIGHT TO CYCLE <i /> ENTER TO SELECT</span>
          </div>
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
              {WORLD_COLORS.map((color, index) => {
                const world = index + 1;
                const unlocked = isWorldUnlocked(world);
                const wc = WORLD_COLORS[world - 1];
                const done = world + 0.9 <= highestLevel + 0.01;
                const isCurrent = world === selectedWorld;
                return (
                  <motion.button
                    key={world}
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
                      "--world-color": unlocked ? color : "#536079",
                      "--world-shadow": unlocked ? WORLD_SHADOWS[world - 1] : "rgba(50,62,85,0.3)",
                    } as React.CSSProperties}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: isCurrent ? 1 : 0.58, y: 0, scale: isCurrent ? 1 : 0.86 }}
                    transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
                    whileHover={unlocked ? { y: -4, opacity: 1 } : undefined}
                    whileTap={unlocked ? { scale: isCurrent ? 0.97 : 0.79 } : undefined}
                  >
                    <span className="orblitz-world-card-grid" />
                    <span className="orblitz-world-card-corner orblitz-world-card-corner-tl" />
                    <span className="orblitz-world-card-corner orblitz-world-card-corner-br" />
                    <span className="orblitz-world-card-index">W-{world}</span>
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

    if (viewState === "levels") {
      const wc = WORLD_COLORS[selectedWorld - 1];
      const mapPoints = STELLAR_MAP_POINTS;
      const mapRoute = STELLAR_MAP_ROUTE;
      const levels = Array.from({ length: 9 }, (_, i) => i + 1);
      const currentLevel = levels
        .map((sub) => selectedWorld + sub / 10)
        .find((level) => isLevelUnlocked(level) && level > highestLevel) ?? null;
      return (
        <div
          className="orblitz-level-map-shell is-stellar"
          role="region"
          aria-label={`World ${selectedWorld} ${WORLD_NAMES[selectedWorld - 1]} level map`}
        >
          <div className="orblitz-level-map-topline">
            <span>STELLAR NAVIGATION</span>
            <span>PLOT A COURSE <i /></span>
          </div>
          <div className="orblitz-level-map orblitz-level-map-stellar">
            <svg className="orblitz-level-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="orblitz-level-route-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={wc} stopOpacity="0.22" />
                  <stop offset="52%" stopColor="#9cecff" stopOpacity="0.88" />
                  <stop offset="100%" stopColor="#ffd2fb" stopOpacity="0.98" />
                </linearGradient>
                <filter id="orblitz-level-route-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect className="orblitz-level-map-space" x="0" y="0" width="100" height="100" rx="6" />
              <g className="orblitz-level-map-nebula">
                <ellipse cx="18" cy="31" rx="18" ry="10" />
                <ellipse cx="74" cy="68" rx="24" ry="13" />
                <ellipse cx="53" cy="18" rx="14" ry="7" />
              </g>
              <g className="orblitz-level-map-orbits">
                <ellipse cx="22" cy="60" rx="17" ry="7" transform="rotate(-18 22 60)" />
                <ellipse cx="70" cy="39" rx="20" ry="9" transform="rotate(22 70 39)" />
                <ellipse cx="51" cy="53" rx="34" ry="16" transform="rotate(-9 51 53)" />
              </g>
              <path
                className="orblitz-level-map-route-shadow"
                d={mapRoute}
              />
              <path
                className="orblitz-level-map-route-line"
                d={mapRoute}
                stroke="url(#orblitz-level-route-gradient)"
                filter="url(#orblitz-level-route-glow)"
              />
              <g className="orblitz-level-map-stars orblitz-level-map-stars-far">
                <circle cx="6" cy="13" r="0.22" />
                <circle cx="11" cy="54" r="0.2" />
                <circle cx="18" cy="88" r="0.25" />
                <circle cx="31" cy="10" r="0.18" />
                <circle cx="47" cy="8" r="0.2" />
                <circle cx="58" cy="91" r="0.24" />
                <circle cx="70" cy="7" r="0.18" />
                <circle cx="88" cy="12" r="0.22" />
                <circle cx="97" cy="57" r="0.2" />
              </g>
              <g className="orblitz-level-map-stars orblitz-level-map-stars-near">
                <circle cx="14" cy="20" r="0.55" />
                <circle cx="26" cy="17" r="0.35" />
                <circle cx="38" cy="23" r="0.5" />
                <circle cx="53" cy="14" r="0.38" />
                <circle cx="62" cy="73" r="0.48" />
                <circle cx="72" cy="15" r="0.3" />
                <circle cx="82" cy="79" r="0.52" />
                <circle cx="94" cy="35" r="0.32" />
              </g>
            </svg>
            {levels.map(sub => {
            const level = selectedWorld + sub / 10;
            const unlocked = isLevelUnlocked(level);
            const boss = isBossLevel(level);
            const completed = level <= highestLevel;
            const current = level === currentLevel;
            const bc = boss ? "#ff73d0" : wc;
            const point = mapPoints[sub - 1];
            return (
              <motion.button key={sub}
                onClick={() => { if (unlocked) { btn(`l${level}`); try { stopMenuBgm(); } catch {} useOrbTransition.getState().loadingSweep(() => { setGameMode("arcade"); startLoading("nextLevel", level); }); } }}
                disabled={!unlocked}
                data-testid={`button-level-${selectedWorld}-${sub}`}
                aria-label={unlocked ? `Select level ${selectedWorld}.${sub}` : `Level ${selectedWorld}.${sub} locked`}
                aria-current={current ? "step" : undefined}
                className={`orblitz-select-card orblitz-level-node is-stellar-node ${boss ? "is-boss" : ""} ${unlocked ? "is-unlocked" : "is-locked"} ${completed ? "is-complete" : ""} ${current ? "is-current" : ""}`}
                style={{
                  "--select-color": unlocked ? bc : "#536079",
                  "--map-x": `${point.x}%`,
                  "--map-y": `${point.y}%`,
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
                    <span className="orblitz-select-index">SYSTEM {String(sub).padStart(2, "0")}</span>
                    <span className="orblitz-select-number">{selectedWorld}.{sub}</span>
                    <span className="orblitz-select-label">{boss ? "BOSS" : `${getOrbGoal(selectedWorld, sub)} ORBS`}</span>
                    <span className="orblitz-select-status">{completed ? "COMPLETE" : boss ? "AHEAD" : "READY"}</span>
                    {(completed || current) && <span className="orblitz-select-status-dot" style={{ background: bc }} />}
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
          </div>
        </div>
      );
    }

    return null;
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const showMenu    = true;
  const showTitle   = showMenu;
  const panelButtons = showMenu ? getPanelButtons() : [];
  const selectionMenuState = carouselView;
  const selectionButtons = showMenu ? getPanelButtons(selectionMenuState) : [];
  const showSelectionScreen = showMenu && worldScreenMounted;
  const selectionScreenVisible = carouselOpen;
  const reportedMenuState: MenuState =
    carouselOpen
      ? carouselView
      : (arcadeTransition !== "idle" && arcadeTransitionTarget === "worlds")
        ? "worlds"
      : menuState;
  const introPhase: IntroBossPhase | null =
    animPhase === "splash" || animPhase === "idle" || animPhase === "flying" || animPhase === "converge" || animPhase === "flash" ||
    animPhase === "backdrop" || animPhase === "background" ||
    animPhase === "title" || animPhase === "waiting" || animPhase === "menu"
      ? (animPhase === "splash" ? "idle" : animPhase)
      : null;

  useEffect(() => {
    onIntroPhaseChange?.(
      introPhase,
      reportedMenuState,
      selectedWorld,
      reportedMenuState === "worlds" && carouselOpen,
    );
  }, [carouselOpen, introPhase, onIntroPhaseChange, reportedMenuState, selectedWorld]);

  useEffect(() => () => onIntroPhaseChange?.(null), [onIntroPhaseChange]);

  return (
    <motion.div
      className="orblitz-startup-shell orblitz-rainbow-arcade-shell fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none"
      data-menu-state={visualMenuState}
      style={{
        cursor: "default",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* ── ORBLITZ TITLE — centered like a classic arcade title screen ─── */}
      <AnimatePresence>
        {showTitle && (
             <motion.div
            className="absolute z-10 text-center orblitz-title-lockup orblitz-aaa-title-lockup"
            data-menu-title={showMenu ? "active" : "intro"}
            style={{ top: showMenu ? "clamp(58px, 9vh, 104px)" : "50%", left: 0, right: 0 }}
            initial={{ opacity: 0, scale: 0.92, y: "-50%" }}
             animate={{ opacity: showTitle ? 1 : 0, scale: showTitle ? 1 : 0.92, y: showMenu ? 0 : "-50%" }}
            exit={{ opacity: 0, scale: 0.8, y: "-50%" }}
            transition={{ duration: showMenu ? 0.45 : 0.2, delay: showMenu ? MENU_TITLE_REVEAL_DELAY : 0, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* One persistent title node: the reveal becomes the interactive menu title in place. */}
            <div className="orblitz-title-wordmark-row">
              {showMenu && (
                <motion.div
                  className="relative z-30 pointer-events-none orblitz-star-bank orblitz-title-star-bank"
                  aria-label={`${shopStars} stars`}
                  style={{
                    padding: "8px 13px 8px 9px",
                    border: "1px solid rgba(255,230,120,0.72)",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(102,58,16,0.42) 44%, rgba(255,196,48,0.14))",
                    boxShadow: "4px 5px 0 rgba(5,10,34,0.58), 0 0 22px rgba(255,193,46,0.22), inset 0 1px 0 rgba(255,255,255,0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: MENU_SECONDARY_REVEAL_DELAY }}
                >
                  <div style={{
                    position: "absolute", top: 0, left: 12, right: 12, height: 2,
                    background: "linear-gradient(90deg, transparent, #fff3a1 24%, #ffe600 50%, transparent)",
                    boxShadow: "0 0 9px rgba(255,230,0,0.8)",
                  }} />
                  <div className="flex flex-col items-center justify-center" style={{ minWidth: 0, lineHeight: 1 }}>
                    <div className="orblitz-star-bank-label" aria-hidden="true">
                      {"STARS".split("").map((letter, index) => (
                        <span key={`${letter}-${index}`}>{letter}</span>
                      ))}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, color: "#fff8c9",
                      fontSize: "clamp(1rem, 2vw, 1.38rem)", fontWeight: 900, letterSpacing: "0.04em",
                      fontFamily: "Arial Black, Impact, sans-serif", textShadow: "0 0 10px rgba(255,230,0,0.45)",
                    }}>
                      <span>{shopStars.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.h1
               className={`font-black tracking-widest flex items-center justify-center orblitz-title-wordmark orblitz-aaa-title-wordmark${showMenu ? "" : " pointer-events-none"}`}
              aria-label="Orblitz"
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
                  initial={{ opacity: 0, y: 16, scale: 0.82, filter: "blur(9px) drop-shadow(0 0 0 rgba(180,235,255,0))" }}
                  animate={{
                    backgroundPosition: animPhase === "title"
                      ? [
                        "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
                        "0% 0%, 100% 100%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 130% 0%",
                        "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
                      ]
                      : "0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, -130% 0%",
                    filter: animPhase === "title"
                      ? [
                        "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
                        "drop-shadow(0 0 12px rgba(255,255,255,0.66)) saturate(1.16)",
                        "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
                      ]
                      : "drop-shadow(0 0 7px rgba(180,235,255,0.45)) saturate(1.03)",
                    opacity: idx < devProgress ? 0.4 : 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{
                    backgroundPosition: animPhase === "title"
                      ? { duration: 2.4 + idx * 0.16, repeat: Infinity, ease: "easeInOut", delay: idx * 0.08 }
                      : { duration: 0.35, ease: "easeOut" },
                    filter: animPhase === "title"
                      ? { duration: 2.4 + idx * 0.16, repeat: Infinity, ease: "easeInOut", delay: idx * 0.08 }
                      : { duration: 0.35, ease: "easeOut" },
                    opacity: { duration: 0.55, delay: animPhase === "title" ? idx * 0.12 : 0, ease: "easeOut" },
                    y: { duration: 0.65, delay: animPhase === "title" ? idx * 0.12 : 0, ease: [0.22, 0.61, 0.36, 1] },
                    scale: { duration: 0.65, delay: animPhase === "title" ? idx * 0.12 : 0, ease: [0.22, 0.61, 0.36, 1] },
                  }}
                  whileHover={showMenu ? { scale: 1.14, y: -3 } : undefined}
                  whileTap={showMenu ? { scale: 0.9 } : undefined}
                  onClick={showMenu ? (e) => { e.stopPropagation(); handleLetterClick(letter, idx); } : undefined}
                >{letter}</motion.span>
              ))}
              </motion.h1>
            </div>

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

      {/* ── MENU ACTIONS (root / modes) — title owns the center ─────────── */}
      <AnimatePresence mode="wait">
        {showMenu && (
          <motion.div
            key={menuState === "settings" ? "settings" : "menu"}
            className="absolute inset-0 z-20 orblitz-command-layer orblitz-menu-actions orblitz-aaa-menu-actions"
            data-menu-state={visualMenuState}
            style={{
              pointerEvents: menuState === "settings" ? "auto" : "none",
              padding: menuState === "settings" ? "0 clamp(10px, 3.5vw, 44px)" : 0,
              ...(menuState === "settings" ? {
                top: "calc(43% + clamp(65px, 7.6vw, 78px))",
                bottom: "clamp(20px, 3vh, 28px)",
                maxHeight: "calc(57dvh - clamp(65px, 7.6vw, 78px) - clamp(20px, 3vh, 28px))",
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
              : <ButtonRow
                  buttons={panelButtons}
                  pressedBtn={pressedBtn}
                  setPressedBtn={setPressedBtn}
                  isRootMenu={menuState === "root"}
                />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL-SCREEN WORLDS / LEVELS POPUP ─────────────────────────────
          This must be portaled above the shared canvas. The startup shell is
          an isolated z-index context, so a child z-index cannot outrank a
          canvas sibling even when the child's numeric z-index is higher. */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence mode="wait">
          {showSelectionScreen && (
            <motion.div
              key="arcade-world-screen"
              className={`fixed inset-0 z-[150] flex flex-col orblitz-selection-screen ${selectionMenuState === "worlds" ? "orblitz-world-select" : ""}`}
              role="main"
              aria-label={selectionMenuState === "worlds" ? "World select" : "Level select"}
              aria-hidden={!selectionScreenVisible}
              style={{
                visibility: selectionScreenVisible ? "visible" : "hidden",
                pointerEvents: selectionScreenVisible ? "auto" : "none",
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {/* Header */}
              <div className="flex-none orblitz-selection-header">
                <p data-testid={`text-${selectionMenuState}-title`} className="font-black tracking-widest uppercase" style={{
                  color: selectionMenuState === "worlds" ? "#00ffff" : WORLD_COLORS[selectedWorld - 1],
                  fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
                  letterSpacing: "0.22em",
                  textShadow: `0 0 18px ${selectionMenuState === "worlds" ? "rgba(0,255,255,0.5)" : `${WORLD_COLORS[selectedWorld - 1]}88`}`,
                }}>
                  {selectionMenuState === "worlds" ? "Select World" : `World ${selectedWorld}`}
                </p>
                <span className="orblitz-selection-subtitle">{selectionMenuState === "worlds" ? "Choose a world to play" : "Choose a level to play"}</span>
              </div>

               {/* Responsive world carousel / level grid */}
              <div className="flex-1 min-h-0 flex flex-col orblitz-selection-content">
                  {renderContent(selectionMenuState)}
              </div>

               {/* Back button — icon-only on world select, text elsewhere */}
              <div className="flex-none border-t flex justify-center orblitz-selection-footer" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div style={{ width: "clamp(120px, 40vw, 200px)" }}>
                  <ButtonRow buttons={selectionButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} compact />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {arcadeTransition !== "idle" && typeof document !== "undefined" && createPortal(
        <motion.div
          key="arcade-screen-fade"
          className="fixed inset-0 z-[240] orblitz-arcade-screen-fade"
          style={{
            background: "#000000",
            pointerEvents: "auto",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: arcadeTransition === "fadeIn" ? 0 : 1 }}
          transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
          onAnimationComplete={() => {
            if (arcadeTransition === "fadeOut") {
              setCarouselOpen(arcadeTransitionTarget === "worlds");
              if (arcadeTransitionTarget === "worlds" && !worldRosterReady) {
                setArcadeTransition("waiting");
              } else {
                setArcadeTransition("fadeIn");
              }
            } else if (arcadeTransition === "fadeIn") {
              setArcadeTransition("idle");
              setArcadeTransitionTarget(null);
            }
          }}
        />,
        document.body,
      )}
    </motion.div>
  );
}

// ─── Reusable button row ──────────────────────────────────────────────────────
interface ButtonRowProps {
  buttons: BtnDef[];
  pressedBtn: string | null;
  setPressedBtn: (id: string | null) => void;
  compact?: boolean;
  isRootMenu?: boolean;
}
function ButtonRow({ buttons, pressedBtn, setPressedBtn, compact = false, isRootMenu = false }: ButtonRowProps) {
  const btnH = compact ? "clamp(48px,8vw,64px)" : "clamp(72px,10vw,96px)";
  const iconSz = compact ? "clamp(1rem,2.5vw,1.4rem)" : "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = compact ? "clamp(0.44rem,1.1vw,0.6rem)" : "clamp(0.48rem,1.25vw,0.68rem)";
  const isRoot = buttons.some((button) => button.id === "play");
  const layout = compact ? "compact" : isRoot ? "root" : "modes";

  return (
    <motion.div
      className={compact ? "orblitz-compact-stage flex flex-row items-stretch justify-center" : `orblitz-button-stage orblitz-aaa-button-stage orblitz-layout-${layout}`}
      data-layout={layout}
      style={compact ? { gap: "clamp(5px,1.4vw,12px)" } : undefined}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.11, delayChildren: 0.12 } },
        hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
      }}
    >
      {buttons.map((b) => {
        const isPress = pressedBtn === b.id;
        const isPrimary = b.id === "play";
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
              transition: "background 0.22s, box-shadow 0.22s, border-color 0.22s, transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
            variants={{
              hidden:  { opacity: 0, y: 16, scale: 0.86 },
              visible: { opacity: 1, y: 0,  scale: 1,
                transition: { type: "spring", stiffness: 360, damping: 26 } },
            }}
            whileHover={{ scale: 1.04, y: -3 }}
            whileTap={{ scale: 0.9 }}
            onHoverStart={() => setPressedBtn(b.id)}
            onHoverEnd={() => setPressedBtn(null)}
            onPointerDown={() => setPressedBtn(b.id)}
            onPointerUp={() => setPressedBtn(null)}
            onPointerLeave={() => setPressedBtn(null)}
            onClick={b.action}
            data-testid={`button-menu-${b.id}`}
            data-active={isPress}
            data-orblitz-modal-opener={isRootMenu && (b.id === "shop" || b.id === "inventory") ? b.id : undefined}
          >
            {/* Material edge */}
            {b.id !== "play" && <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: 3,
              background: `linear-gradient(90deg,${b.color}00 0%,${b.color}cc 20%,rgba(255,255,255,0.95) 50%,${b.color}22 80%,${b.color}00 100%)`,
              opacity: isPress ? 1 : 0.72, transition: "opacity 0.14s",
            }} />}
            {/* Glass pass */}
            {b.id !== "play" && <div className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(132deg, rgba(255,255,255,0.11), transparent 30%, transparent 58%, rgba(0,0,0,0.22))",
              borderRadius: "inherit",
            }} />}
            {b.id === "play" ? (
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={`${b.id}-${b.label}`}
                  className="orblitz-play-bubble-label"
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {b.label.split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
                </motion.span>
              </AnimatePresence>
            ) : ["shop", "inventory", "trophies", "settings"].includes(b.id) ? (
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={`${b.id}-${b.label}`}
                  className={`orblitz-root-letter-label orblitz-${b.id}-letter-label`}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {b.label.split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
                </motion.span>
              </AnimatePresence>
            ) : (
              <>
                <span className="orblitz-command-icon" style={{
                  fontSize: iconSz, lineHeight: 1,
                  filter: `drop-shadow(0 0 7px ${b.color}88) drop-shadow(2px 2px 0 rgba(3,7,26,0.55))`,
                }}>{b.icon}</span>
                {!b.hideLabel && (
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      key={`${b.id}-${b.label}`}
                      className="orblitz-command-copy"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
                    >
                      <span className="orblitz-command-label" style={{
                        fontSize: labelSz, fontWeight: 900,
                        letterSpacing: "0.12em", lineHeight: 1, opacity: 0.96,
                        fontFamily: "var(--font-display)",
                      }}>{b.label}</span>
                    </motion.span>
                  </AnimatePresence>
                )}
              </>
            )}
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
