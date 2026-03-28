import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { HighScoreInput, HighScoreList } from "./HighScoreInput";
import { useAudio } from "@/lib/stores/useAudio";

const getStoredHighScores = (): number[] => {
  try {
    const stored = localStorage.getItem("orblitz_highscores");
    if (stored) {
      return JSON.parse(stored).map((e: any) => e.score);
    }
  } catch {}
  return [];
};

interface GameOverProps {
  onLevelSelect?: () => void;
  onMainMenu?: () => void;
}

export function GameOver({ onLevelSelect, onMainMenu }: GameOverProps) {
  const { score, highScore, startLoading, setPhase, gameTime, gameMode, arcadeLevel, phase, gauntletOrbsDestroyed } = useMagicOrb();
  const [showNameInput, setShowNameInput] = useState(true);
  const { playGameOver, playMenuSelect } = useAudio();
  
  useEffect(() => {
    if (phase === "gameOver") {
      playGameOver();
    }
  }, [phase, playGameOver]);

  const handleButtonClick = (action: () => void) => {
    playMenuSelect();
    action();
  };
  
  const existingScores = getStoredHighScores();
  const minExistingScore = existingScores.length > 0 ? Math.min(...existingScores) : 0;
  const isTopScore = score > 0 && (existingScores.length < 10 || score > minExistingScore);
  const isNewHighScore = score === highScore && score > 0;

  const shareText = encodeURIComponent(
    `🔮 I scored ${score} points in Orblitz! Can you beat my score? #Orblitz`
  );

  const shareOnTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${shareText}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareOnFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?quote=${shareText}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        `🔮 I scored ${score} points in Orblitz! Can you beat my score?`
      );
      alert("Score copied to clipboard!");
    } catch {
      console.log("Failed to copy");
    }
  };

  const handlePlayAgain = () => {
    playMenuSelect();
    if (gameMode === "arcade") {
      startLoading("nextLevel", arcadeLevel);
    } else {
      startLoading("entering");
    }
  };

  const handleMainMenu = () => {
    playMenuSelect();
    if (onMainMenu) onMainMenu();
    const { startLoading } = useMagicOrb.getState();
    startLoading("exiting");
  };

  const handleLevelSelect = () => {
    playMenuSelect();
    if (onLevelSelect) {
      setPhase("menu");
      onLevelSelect();
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />

      <div className="relative z-10 min-h-full flex items-center justify-center p-4 py-8">
        <motion.div
          className="text-center max-w-md w-full"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="bg-gradient-to-br from-purple-900/90 via-indigo-900/90 to-violet-900/90 rounded-3xl p-6 border border-purple-500/30 shadow-2xl">
          <motion.h1
            className="text-4xl md:text-5xl font-bold text-red-400 mb-2"
            animate={{
              textShadow: gameMode === "gauntlet" 
                ? ["0 0 20px #ff8844", "0 0 40px #ff4400", "0 0 20px #ff8844"]
                : ["0 0 20px #ff6666", "0 0 40px #ff0000", "0 0 20px #ff6666"],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {gameMode === "gauntlet" ? "GAUNTLET OVER" : "GAME OVER"}
          </motion.h1>

          {isNewHighScore && !showNameInput && (
            <motion.div
              className="mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <span className="text-yellow-400 text-lg font-bold">
                NEW HIGH SCORE!
              </span>
            </motion.div>
          )}
          
          {isTopScore && showNameInput && score > 0 && (
            <HighScoreInput
              score={score}
              onSubmit={() => setShowNameInput(false)}
              onSkip={() => setShowNameInput(false)}
            />
          )}

          <div className="my-8">
            <p className="text-purple-300 text-sm uppercase tracking-wider mb-1">Final Score</p>
            <motion.p
              className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              {score}
            </motion.p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            {gameMode === "gauntlet" ? (
              <>
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-gray-400">Play Time</p>
                  <p className="text-cyan-400 text-xl font-bold">{Math.floor(gameTime)}s</p>
                </div>
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-gray-400">Orbs Defeated</p>
                  <p className="text-orange-400 text-xl font-bold">{gauntletOrbsDestroyed}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-gray-400">High Score</p>
                  <p className="text-yellow-400 text-xl font-bold">{highScore}</p>
                </div>
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-gray-400">Survived</p>
                  <p className="text-cyan-400 text-xl font-bold">{Math.floor(gameTime)}s</p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <motion.button
              onClick={handlePlayAgain}
              className="w-full py-3 text-lg font-bold text-white rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              PLAY AGAIN
            </motion.button>

            {gameMode === "arcade" && onLevelSelect && (
              <motion.button
                onClick={handleLevelSelect}
                className="w-full py-3 text-lg font-bold text-cyan-300 rounded-full border-2 border-cyan-500/50 hover:bg-cyan-500/20 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                LEVEL SELECT
              </motion.button>
            )}

            <motion.button
              onClick={handleMainMenu}
              className="w-full py-3 text-lg font-bold text-purple-300 rounded-full border-2 border-purple-500/50 hover:bg-purple-500/20 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              MAIN MENU
            </motion.button>
          </div>

          <HighScoreList />

          <div className="border-t border-purple-500/30 pt-6 mt-4">
            <p className="text-purple-400 text-sm mb-4">Share your score!</p>
            <div className="flex justify-center gap-3">
              <motion.button
                onClick={shareOnTwitter}
                className="px-4 py-2 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Twitter
              </motion.button>
              <motion.button
                onClick={shareOnFacebook}
                className="px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 hover:bg-blue-600/30 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Facebook
              </motion.button>
              <motion.button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-500/20 border border-gray-400/50 rounded-lg text-gray-300 hover:bg-gray-500/30 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Copy
              </motion.button>
            </div>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
