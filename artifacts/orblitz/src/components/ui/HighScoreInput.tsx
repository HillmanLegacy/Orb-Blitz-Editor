import { motion } from "framer-motion";
import { useState } from "react";

const PROFANITY_LIST = [
  "fuck", "shit", "ass", "bitch", "damn", "hell", "crap", "dick", "cock", 
  "pussy", "fag", "slut", "whore", "nigger", "nigga", "retard", "cunt",
  "bastard", "piss", "bollocks", "wanker", "twat", "arse", "bloody",
  "sex", "porn", "xxx", "nude", "naked", "kill", "murder", "rape", "nazi",
  "hitler", "terrorist", "bomb", "drug", "cocaine", "heroin", "meth",
];

const containsProfanity = (text: string): boolean => {
  const lower = text.toLowerCase().replace(/[^a-z]/g, '');
  for (const word of PROFANITY_LIST) {
    if (lower.includes(word)) return true;
  }
  const leetReplacements: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a',
  };
  let decoded = text.toLowerCase();
  for (const [leet, letter] of Object.entries(leetReplacements)) {
    decoded = decoded.split(leet).join(letter);
  }
  decoded = decoded.replace(/[^a-z]/g, '');
  for (const word of PROFANITY_LIST) {
    if (decoded.includes(word)) return true;
  }
  return false;
};

interface HighScoreEntry {
  name: string;
  score: number;
  date: string;
}

const getHighScores = (): HighScoreEntry[] => {
  try {
    const stored = localStorage.getItem("orblitz_highscores");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

const saveHighScore = (entry: HighScoreEntry) => {
  try {
    const scores = getHighScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    const top10 = scores.slice(0, 10);
    localStorage.setItem("orblitz_highscores", JSON.stringify(top10));
  } catch {}
};

interface HighScoreInputProps {
  score: number;
  onSubmit: (name: string) => void;
  onSkip: () => void;
}

export function HighScoreInput({ score, onSubmit, onSkip }: HighScoreInputProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    
    if (trimmed.length > 12) {
      setError("Name must be 12 characters or less");
      return;
    }

    if (containsProfanity(trimmed)) {
      setError("Please choose an appropriate name");
      return;
    }

    saveHighScore({
      name: trimmed,
      score,
      date: new Date().toISOString(),
    });

    onSubmit(trimmed);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <motion.div
      className="bg-gradient-to-br from-yellow-900/80 to-orange-900/80 rounded-2xl p-6 border border-yellow-500/40 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <h2 className="text-2xl font-bold text-yellow-300 mb-2">
        New High Score!
      </h2>
      <p className="text-yellow-200/80 text-sm mb-4">
        Enter your name for the leaderboard
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        onKeyPress={handleKeyPress}
        placeholder="Your name..."
        maxLength={12}
        className="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-yellow-500/50 text-white text-lg font-medium placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-all"
      />

      {error && (
        <motion.p
          className="text-red-400 text-sm mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      <div className="flex gap-3 mt-4">
        <motion.button
          onClick={handleSubmit}
          className="flex-1 py-3 text-lg font-bold text-white rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Save Score
        </motion.button>

        <motion.button
          onClick={onSkip}
          className="px-6 py-3 text-lg font-medium text-gray-400 rounded-xl border border-gray-600 hover:bg-gray-800 transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Skip
        </motion.button>
      </div>
    </motion.div>
  );
}

export function HighScoreList() {
  const scores = getHighScores();

  if (scores.length === 0) return null;

  return (
    <div className="bg-black/40 rounded-xl p-4 mt-4 max-h-48 overflow-y-auto">
      <h3 className="text-purple-300 text-sm font-semibold mb-2 uppercase tracking-wider">
        Leaderboard
      </h3>
      <div className="space-y-1">
        {scores.map((entry, i) => (
          <div
            key={i}
            className="flex justify-between items-center text-sm py-1 px-2 rounded bg-purple-500/10"
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-purple-400"}`}>
                #{i + 1}
              </span>
              <span className="text-white">{entry.name}</span>
            </div>
            <span className="text-cyan-400 font-medium">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
