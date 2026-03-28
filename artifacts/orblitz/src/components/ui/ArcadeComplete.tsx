import { motion } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useState, useEffect, useCallback, useMemo } from "react";

const generateParticles = () => {
  return [...Array(100)].map(() => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    width: 4 + Math.random() * 6,
    height: 4 + Math.random() * 6,
    hue: Math.random() * 360,
    yOffset: -20 - Math.random() * 40,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 2,
  }));
};

export function ArcadeComplete() {
  const { score, gameTime, arcadeTotalOrbs, returnToMenu } = useMagicOrb();
  const [showTapHint, setShowTapHint] = useState(false);
  const particles = useMemo(() => generateParticles(), []);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowTapHint(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleTap = useCallback(() => {
    returnToMenu();
  }, [returnToMenu]);
  
  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      onClick={handleTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.width,
              height: p.height,
              background: `hsl(${p.hue}, 100%, 70%)`,
            }}
            animate={{
              y: [0, p.yOffset, 0],
              opacity: [0, 1, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 1, delay: 0.2 }}
        >
          <motion.h1
            className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-2"
            animate={{
              textShadow: [
                "0 0 30px #ffff00, 0 0 60px #ff8800",
                "0 0 50px #ff8800, 0 0 100px #ff4400",
                "0 0 30px #ffff00, 0 0 60px #ff8800",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            CONGRATULATIONS!
          </motion.h1>
        </motion.div>
        
        <motion.p
          className="text-2xl md:text-3xl text-white font-bold mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          You've conquered the Arcade!
        </motion.p>
        
        <motion.div
          className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-purple-500/30 max-w-md mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-xl text-purple-300 font-semibold mb-4">Your Stats</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Total Time</span>
              <motion.span 
                className="text-2xl font-bold text-cyan-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {formatTime(gameTime)}
              </motion.span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Final Score</span>
              <motion.span 
                className="text-2xl font-bold text-yellow-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                {score.toLocaleString()}
              </motion.span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Orbs Defeated</span>
              <motion.span 
                className="text-2xl font-bold text-pink-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                {arcadeTotalOrbs.toLocaleString()}
              </motion.span>
            </div>
          </div>
        </motion.div>
        
        {showTapHint && (
          <motion.p
            className="text-lg text-cyan-300 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Tap anywhere to return to menu
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
