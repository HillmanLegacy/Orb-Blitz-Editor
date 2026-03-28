import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

interface MainMenuProps {
  onShowHowToPlay: () => void;
  onShowModeSelect: () => void;
  onShowSettings: () => void;
}

interface FloatingOrb {
  width: number;
  height: number;
  left: string;
  top: string;
  color: string;
  xOffset: number;
  yOffset: number;
  duration: number;
}

interface EntranceOrb {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  trail: boolean;
  spin: number;
  glow: boolean;
}

interface SparkleParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

interface DecorativeRing {
  size: number;
  color: string;
  delay: number;
  thickness: number;
  spin: number;
}

export function MainMenu({ onShowHowToPlay, onShowModeSelect, onShowSettings }: MainMenuProps) {
  const { highScore } = useMagicOrb();
  const { coins: stars, openShop, openInventory } = useShop();
  const { 
    playMenuSelect, 
    playOrbWhoosh, 
    playOrbConverge, 
    playRingExpand, 
    playSparkle, 
    playTitleReveal 
  } = useAudio();
  const [showContent, setShowContent] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);

  useEffect(() => {
    // Initial whoosh as orbs start flying in
    const whooshTimer1 = setTimeout(() => playOrbWhoosh(), 100);
    const whooshTimer2 = setTimeout(() => playOrbWhoosh(), 400);
    const whooshTimer3 = setTimeout(() => playOrbWhoosh(), 700);
    
    // Orb convergence sound when they reach center
    const convergeTimer = setTimeout(() => playOrbConverge(), 600);
    
    // Ring expansion sounds
    const ringTimer1 = setTimeout(() => playRingExpand(), 800);
    const ringTimer2 = setTimeout(() => playRingExpand(), 1000);
    const ringTimer3 = setTimeout(() => playRingExpand(), 1200);
    
    // Title reveal sound
    const titleTimer = setTimeout(() => playTitleReveal(), 850);
    
    // Sparkle sounds when content appears
    const sparkleTimer1 = setTimeout(() => playSparkle(), 1500);
    const sparkleTimer2 = setTimeout(() => playSparkle(), 2000);
    const sparkleTimer3 = setTimeout(() => playSparkle(), 2500);
    
    const contentTimer = setTimeout(() => setShowContent(true), 800);
    const entranceTimer = setTimeout(() => setEntranceComplete(true), 2500);
    
    return () => {
      clearTimeout(whooshTimer1);
      clearTimeout(whooshTimer2);
      clearTimeout(whooshTimer3);
      clearTimeout(convergeTimer);
      clearTimeout(ringTimer1);
      clearTimeout(ringTimer2);
      clearTimeout(ringTimer3);
      clearTimeout(titleTimer);
      clearTimeout(sparkleTimer1);
      clearTimeout(sparkleTimer2);
      clearTimeout(sparkleTimer3);
      clearTimeout(contentTimer);
      clearTimeout(entranceTimer);
    };
  }, [playOrbWhoosh, playOrbConverge, playRingExpand, playSparkle, playTitleReveal]);

  const handleButtonClick = (action: () => void) => {
    playMenuSelect();
    action();
  };

  const entranceOrbs = useMemo<EntranceOrb[]>(() => {
    const orbs: EntranceOrb[] = [];
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff8800', '#8800ff', '#ff0088', '#88ff00'];
    const orbCount = 80;
    
    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2;
      const distance = 120 + Math.random() * 60;
      const startX = Math.cos(angle) * distance;
      const startY = Math.sin(angle) * distance;
      const endX = (Math.random() - 0.5) * 80;
      const endY = (Math.random() - 0.5) * 60;
      
      orbs.push({
        id: i,
        startX,
        startY,
        endX,
        endY,
        size: 8 + Math.random() * 24,
        color: colors[i % colors.length],
        delay: i * 0.015 + Math.random() * 0.3,
        duration: 1.2 + Math.random() * 0.6,
        trail: Math.random() > 0.6,
        spin: (Math.random() - 0.5) * 720,
        glow: Math.random() > 0.5,
      });
    }
    return orbs;
  }, []);

  const sparkles = useMemo<SparkleParticle[]>(() => {
    const particles: SparkleParticle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        color: ['#ffffff', '#00ffff', '#ff00ff', '#ffff00'][Math.floor(Math.random() * 4)],
        delay: 1.5 + Math.random() * 1.5,
        duration: 1 + Math.random() * 2,
      });
    }
    return particles;
  }, []);

  const decorativeRings = useMemo<DecorativeRing[]>(() => {
    return [
      { size: 200, color: '#00ffff', delay: 0.8, thickness: 2, spin: 360 },
      { size: 280, color: '#ff00ff', delay: 1.0, thickness: 1.5, spin: -360 },
      { size: 360, color: '#ffff00', delay: 1.2, thickness: 1, spin: 180 },
      { size: 440, color: '#00ff88', delay: 1.4, thickness: 0.5, spin: -180 },
    ];
  }, []);

  const floatingOrbs = useMemo<FloatingOrb[]>(() => {
    return Array.from({ length: 35 }, (_, i) => {
      const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff8800'];
      return {
        width: Math.random() * 120 + 40,
        height: Math.random() * 120 + 40,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        color: colors[i % 5],
        xOffset: Math.random() * 60 - 30,
        yOffset: Math.random() * 60 - 30,
        duration: 3 + Math.random() * 3,
      };
    });
  }, []);

  const centerOrbPulse = useMemo(() => ({
    colors: ['#00ffff', '#ff00ff', '#ffff00', '#00ff88'],
  }), []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />
      
      {/* Animated grid pattern */}
      <motion.div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ delay: 1, duration: 1 }}
      />

      {/* Entrance orb animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {entranceOrbs.map((orb) => (
          <motion.div
            key={orb.id}
            className="absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              background: orb.glow 
                ? `radial-gradient(circle, ${orb.color}, ${orb.color}88, transparent)`
                : `radial-gradient(circle, ${orb.color}cc, ${orb.color}44, transparent)`,
              boxShadow: orb.glow ? `0 0 ${orb.size}px ${orb.color}88` : 'none',
            }}
            initial={{
              x: `${orb.startX}vw`,
              y: `${orb.startY}vh`,
              scale: 0,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: [`${orb.startX}vw`, `${orb.endX}vw`],
              y: [`${orb.startY}vh`, `${orb.endY}vh`],
              scale: [0, 1.2, entranceComplete ? 0.3 : 0.8],
              opacity: [0, 1, entranceComplete ? 0.2 : 0.6],
              rotate: orb.spin,
            }}
            transition={{
              delay: orb.delay,
              duration: orb.duration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}
        
        {/* Trail effects for some orbs */}
        {entranceOrbs.filter(o => o.trail).map((orb) => (
          <motion.div
            key={`trail-${orb.id}`}
            className="absolute rounded-full"
            style={{
              width: orb.size * 0.6,
              height: orb.size * 0.6,
              background: `radial-gradient(circle, ${orb.color}66, transparent)`,
            }}
            initial={{
              x: `${orb.startX}vw`,
              y: `${orb.startY}vh`,
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: [`${orb.startX}vw`, `${orb.endX * 0.7}vw`],
              y: [`${orb.startY}vh`, `${orb.endY * 0.7}vh`],
              scale: [0, 0.8, 0],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              delay: orb.delay + 0.1,
              duration: orb.duration * 0.8,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Decorative expanding rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {decorativeRings.map((ring, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: ring.size,
              height: ring.size,
              borderColor: ring.color,
              borderWidth: ring.thickness,
            }}
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{ 
              scale: [0, 1, 1.1, 1], 
              opacity: [0, 0.6, 0.4, 0.15],
              rotate: ring.spin,
            }}
            transition={{
              delay: ring.delay,
              duration: 2,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Sparkle particles */}
      <AnimatePresence>
        {showContent && sparkles.map((sparkle, i) => (
          <motion.div
            key={`sparkle-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: sparkle.size,
              height: sparkle.size,
              backgroundColor: sparkle.color,
              boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.color}`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              delay: sparkle.delay,
              duration: sparkle.duration,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Floating background orbs (after entrance) */}
      <AnimatePresence>
        {entranceComplete && (
          <div className="absolute inset-0 overflow-hidden">
            {floatingOrbs.map((orb, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: orb.width,
                  height: orb.height,
                  left: orb.left,
                  top: orb.top,
                  background: `radial-gradient(circle, ${orb.color}30, ${orb.color}10, transparent)`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.2, 0.5, 0.2],
                  x: [0, orb.xOffset, 0],
                  y: [0, orb.yOffset, 0],
                }}
                transition={{
                  duration: orb.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.05,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Central glowing orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 150,
          height: 150,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.5, 1],
          opacity: [0, 0.8, 0.4],
        }}
        transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
      >
        <motion.div
          className="w-full h-full rounded-full"
          style={{
            background: `radial-gradient(circle, #ffffff44, #00ffff33, #ff00ff22, transparent)`,
          }}
          animate={{
            boxShadow: [
              `0 0 60px ${centerOrbPulse.colors[0]}66, 0 0 120px ${centerOrbPulse.colors[0]}33`,
              `0 0 80px ${centerOrbPulse.colors[1]}66, 0 0 160px ${centerOrbPulse.colors[1]}33`,
              `0 0 60px ${centerOrbPulse.colors[2]}66, 0 0 120px ${centerOrbPulse.colors[2]}33`,
              `0 0 80px ${centerOrbPulse.colors[3]}66, 0 0 160px ${centerOrbPulse.colors[3]}33`,
              `0 0 60px ${centerOrbPulse.colors[0]}66, 0 0 120px ${centerOrbPulse.colors[0]}33`,
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      {/* Inner rotating rings around center */}
      <motion.div
        className="absolute w-48 h-48 rounded-full border border-cyan-400/30"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: 1, opacity: 0.5, rotate: 360 }}
        transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
        style={{ rotate: 0 }}
      >
        <motion.div
          className="w-full h-full rounded-full border border-cyan-400/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
      
      <motion.div
        className="absolute w-56 h-56 rounded-full border border-pink-400/20"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.4 }}
        transition={{ delay: 1, duration: 1, ease: "easeOut" }}
      >
        <motion.div
          className="w-full h-full rounded-full border border-pink-400/15"
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      {/* Corner decorative orbs */}
      {[
        { x: '10%', y: '15%', size: 60, color: '#00ffff', delay: 1.8 },
        { x: '85%', y: '20%', size: 45, color: '#ff00ff', delay: 2.0 },
        { x: '8%', y: '80%', size: 50, color: '#ffff00', delay: 2.2 },
        { x: '88%', y: '75%', size: 55, color: '#00ff88', delay: 2.4 },
      ].map((corner, i) => (
        <motion.div
          key={`corner-${i}`}
          className="absolute rounded-full"
          style={{
            left: corner.x,
            top: corner.y,
            width: corner.size,
            height: corner.size,
            background: `radial-gradient(circle, ${corner.color}66, ${corner.color}22, transparent)`,
            boxShadow: `0 0 30px ${corner.color}44`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.2, 1],
            opacity: [0, 0.8, 0.6],
          }}
          transition={{ delay: corner.delay, duration: 0.8 }}
        >
          <motion.div
            className="w-full h-full rounded-full"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
          />
        </motion.div>
      ))}

      {/* Main content */}
      <AnimatePresence>
        {showContent && (
          <motion.div
            className="relative z-10 text-center px-4 md:px-8 flex flex-col md:flex-row items-center gap-4 md:gap-12 w-full max-w-4xl"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex-shrink-0">
              <motion.div
                className="mb-4 md:mb-0"
                animate={{
                  filter: ["drop-shadow(0 0 20px #00ffff)", "drop-shadow(0 0 40px #ff00ff)", "drop-shadow(0 0 20px #00ffff)"],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <motion.h1 
                  className="text-4xl md:text-6xl lg:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                  initial={{ letterSpacing: '0.5em', opacity: 0 }}
                  animate={{ letterSpacing: '0.05em', opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                >
                  ORBLITZ
                </motion.h1>
              </motion.div>
              
              {highScore > 0 && (
                <motion.div
                  className="mt-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <p className="text-yellow-400 text-sm md:text-lg">
                    High Score: <span className="font-bold text-xl md:text-2xl">{highScore}</span>
                  </p>
                </motion.div>
              )}

              <motion.div
                className="mt-2 flex items-center justify-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-400/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <motion.span 
                  className="text-yellow-400 text-lg"
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  &#9733;
                </motion.span>
                <span className="text-yellow-300 font-bold text-base md:text-lg">{stars}</span>
              </motion.div>
            </div>

            <div className="flex flex-row md:flex-col flex-wrap justify-center items-center gap-2 md:gap-3">
              {[
                { action: onShowModeSelect, label: 'PLAY', icon: null, delay: 0.4, primary: true },
                { action: onShowHowToPlay, label: 'HOW TO PLAY', shortLabel: 'HELP', icon: '?', delay: 0.5 },
                { action: openShop, label: 'SHOP', icon: '★', delay: 0.6 },
                { action: openInventory, label: 'INVENTORY', shortLabel: 'ITEMS', icon: '☰', delay: 0.7 },
                { action: onShowSettings, label: 'SETTINGS', icon: '⚙', delay: 0.8 },
              ].map((btn, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleButtonClick(btn.action)}
                  className={`relative ${btn.primary ? 'px-8 md:px-12 py-2.5 md:py-4 text-base md:text-xl' : 'px-5 md:px-8 py-2 md:py-3 text-sm md:text-lg'} font-bold text-white rounded-full overflow-hidden group`}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(0,255,255,0.5)' }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: btn.delay, type: 'spring', stiffness: 200 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-pink-500 via-cyan-500 to-purple-500"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    style={{ opacity: 0.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-white"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 0.1 }}
                  />
                  <span className="relative z-10 tracking-wide flex items-center gap-1 md:gap-2">
                    {btn.icon && <span className="text-base md:text-xl">{btn.icon}</span>}
                    {btn.primary ? (
                      <span className="tracking-widest">{btn.label}</span>
                    ) : (
                      <>
                        <span className="hidden md:inline">{btn.label}</span>
                        <span className="md:hidden">{btn.shortLabel || btn.label}</span>
                      </>
                    )}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}
