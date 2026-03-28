import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo, useRef } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";

const LOADING_DURATION = 2500;
const FADE_OUT_DURATION = 600;

const generateStarPositions = () => {
  return [...Array(20)].map(() => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 2,
  }));
};

export function LoadingScreen() {
  const { phase, loadingType, finishLoading, gameMode, pendingLevel, arcadeLevel } = useMagicOrb();
  const { startGameMusic, startMenuMusic, stopMusic } = useAudio();
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const musicTransitionRef = useRef(false);
  
  const starPositions = useMemo(() => generateStarPositions(), []);
  
  useEffect(() => {
    if (phase === "loading") {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setIsVisible(true);
      setIsFadingOut(false);
      setProgress(0);
      
      if (!musicTransitionRef.current) {
        musicTransitionRef.current = true;
        if (loadingType === "entering" || loadingType === "nextLevel") {
          stopMusic();
          setTimeout(() => {
            startGameMusic();
          }, 1200);
        } else if (loadingType === "exiting" || loadingType === "exiting_to_menu") {
          stopMusic();
          setTimeout(() => {
            startMenuMusic();
          }, 1200);
        }
      }
    } else {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setIsFadingOut(false);
      setIsVisible(false);
      musicTransitionRef.current = false;
    }
  }, [phase, loadingType, startGameMusic, startMenuMusic, stopMusic]);
  
  useEffect(() => {
    if (phase !== "loading") {
      return;
    }
    
    if (isFadingOut) {
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / LOADING_DURATION) * 100, 100);
      setProgress(newProgress);
      
      if (elapsed >= LOADING_DURATION) {
        clearInterval(interval);
        finishLoading();
        setIsVisible(false);
      }
    }, 50);
    
    return () => {
      clearInterval(interval);
    };
  }, [phase, finishLoading, isFadingOut]);
  
  useEffect(() => {
    if (phase !== "loading") return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);
    return () => clearInterval(interval);
  }, [phase]);
  
  if (!isVisible && phase !== "loading") return null;
  
  const getLoadingMessage = () => {
    if (loadingType === "entering") {
      if (gameMode === "arcade") return "Entering Arcade Mode";
      if (gameMode === "chill") return "Entering Chill Mode";
      if (gameMode === "gauntlet") return "Entering Gauntlet Mode";
      return "Entering Survival Mode";
    }
    if (loadingType === "nextLevel") {
      const level = pendingLevel ?? arcadeLevel;
      const worldLevel = Math.floor(level);
      const subLevel = Math.round((level % 1) * 10);
      return `Loading Level ${worldLevel}.${subLevel}`;
    }
    if (loadingType === "exiting") {
      return "Returning to Menu";
    }
    return "Loading";
  };
  
  const getSubMessage = () => {
    if (loadingType === "entering") {
      if (gameMode === "arcade") return "Prepare for the challenge!";
      if (gameMode === "chill") return "Relax and have fun!";
      if (gameMode === "gauntlet") return "Don't miss a single shot!";
      return "How long can you survive?";
    }
    if (loadingType === "nextLevel") {
      const level = pendingLevel ?? arcadeLevel;
      const isBoss = Math.floor(level * 10) % 10 === 9;
      if (isBoss) return "Boss battle ahead!";
      return "Destroy all dark orbs!";
    }
    return "";
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {starPositions.map((star, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/20"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>
      
      <motion.div
        className="relative w-24 h-24 mb-8"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 blur-lg opacity-60" />
        <motion.div
          className="absolute inset-2 rounded-full bg-gradient-to-r from-white via-cyan-200 to-white"
          animate={{
            boxShadow: [
              "0 0 20px rgba(255,255,255,0.5)",
              "0 0 40px rgba(0,255,255,0.8)",
              "0 0 20px rgba(255,255,255,0.5)",
            ],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700" />
      </motion.div>
      
      <motion.h1
        className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-4 text-center px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {getLoadingMessage()}{dots}
      </motion.h1>
      
      <motion.p
        className="text-purple-200 text-lg mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {getSubMessage()}
      </motion.p>
      
      <div className="w-64 md:w-80 h-3 bg-black/50 rounded-full overflow-hidden border border-purple-500/30">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      
    </motion.div>
  );
}
