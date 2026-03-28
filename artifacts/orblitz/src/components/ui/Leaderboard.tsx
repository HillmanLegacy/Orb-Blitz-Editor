import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LeaderboardEntry {
  id: number;
  playerName: string;
  score: number;
  gameMode: string;
  createdAt: string;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    if (isOpen) {
      fetchScores();
    }
  }, [isOpen]);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      setScores(data.scores || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedScores = scores.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
  const totalPages = Math.ceil(scores.length / itemsPerPage);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          className="relative z-10 w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-violet-900/95 border border-purple-400/30 shadow-2xl"
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 50 }}
        >
          <div className="p-6 border-b border-purple-400/20">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                Leaderboard
              </h2>
              <motion.button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                x
              </motion.button>
            </div>
            <p className="text-purple-300/60 text-sm mt-1">Top 200 Players</p>
          </div>

          <div className="overflow-y-auto max-h-[50vh] p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
            ) : scores.length === 0 ? (
              <div className="text-center py-8 text-purple-300/60">
                No scores yet. Be the first!
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedScores.map((entry, index) => {
                  const rank = page * itemsPerPage + index + 1;
                  const isTop3 = rank <= 3;
                  const medalColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
                  
                  return (
                    <motion.div
                      key={entry.id}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        isTop3 
                          ? "bg-gradient-to-r from-purple-600/40 to-pink-600/40 border border-purple-400/40" 
                          : "bg-black/30 border border-white/10"
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div className={`w-8 text-center font-bold ${isTop3 ? medalColors[rank - 1] : "text-gray-400"}`}>
                        {rank}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium truncate">{entry.playerName}</p>
                        <p className="text-purple-300/60 text-xs capitalize">{entry.gameMode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-cyan-400 font-bold text-lg">{entry.score.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-purple-400/20 flex justify-center gap-2">
              <motion.button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-purple-600/50 rounded-lg text-white disabled:opacity-40"
                whileHover={{ scale: page === 0 ? 1 : 1.05 }}
                whileTap={{ scale: page === 0 ? 1 : 0.95 }}
              >
                Prev
              </motion.button>
              <span className="px-4 py-2 text-purple-300">
                {page + 1} / {totalPages}
              </span>
              <motion.button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 bg-purple-600/50 rounded-lg text-white disabled:opacity-40"
                whileHover={{ scale: page >= totalPages - 1 ? 1 : 1.05 }}
                whileTap={{ scale: page >= totalPages - 1 ? 1 : 0.95 }}
              >
                Next
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export async function submitScoreToLeaderboard(playerName: string, score: number, gameMode: string): Promise<boolean> {
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, score, gameMode }),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return false;
  }
}
