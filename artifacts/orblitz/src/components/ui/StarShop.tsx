import { motion } from "framer-motion";
import { useState } from "react";
import { useShop } from "@/lib/stores/useShop";

interface StarPackage {
  id: string;
  name: string;
  stars: number;
  price: number;
  popular?: boolean;
  bonus?: string;
}

const STAR_PACKAGES: StarPackage[] = [
  { id: "coins_500", name: "Starter Pack", stars: 500, price: 99 },
  { id: "coins_1200", name: "Value Pack", stars: 1200, price: 199, bonus: "+20%" },
  { id: "coins_2500", name: "Popular Pack", stars: 2500, price: 399, popular: true, bonus: "+25%" },
  { id: "coins_6500", name: "Pro Pack", stars: 6500, price: 999, bonus: "+30%" },
  { id: "coins_14000", name: "Ultimate Pack", stars: 14000, price: 1999, bonus: "+40%" },
];

interface StarShopProps {
  onClose: () => void;
}

export function StarShop({ onClose }: StarShopProps) {
  const { coins: stars } = useShop();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handlePurchase = async (pkg: StarPackage) => {
    setLoading(pkg.id);
    setError("");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
      }
    } catch (err) {
      setError("Payment system unavailable. Please try again later.");
    } finally {
      setLoading(null);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto">
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      <motion.div
        className="relative z-10 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-violet-900/95 rounded-3xl p-6 border border-purple-500/30 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
              Get Stars
            </h1>
            <motion.button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all flex items-center justify-center text-xl"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ×
            </motion.button>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 bg-gradient-to-r from-yellow-600/30 to-orange-500/30 px-6 py-3 rounded-2xl border border-yellow-400/40">
            <span className="text-yellow-300 text-2xl">★</span>
            <span className="text-yellow-200 font-bold text-2xl">{stars}</span>
            <span className="text-yellow-400/80 text-sm ml-1">stars</span>
          </div>

          {error && (
            <motion.div
              className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-red-300 text-sm">{error}</p>
            </motion.div>
          )}

          <div className="space-y-3">
            {STAR_PACKAGES.map((pkg) => (
              <motion.button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={loading !== null}
                className={`w-full p-4 rounded-2xl border-2 transition-all ${
                  pkg.popular
                    ? "bg-gradient-to-r from-purple-600/60 to-pink-600/60 border-pink-400"
                    : "bg-black/40 border-purple-500/40 hover:border-purple-400"
                } ${loading === pkg.id ? "opacity-70" : ""}`}
                whileHover={loading ? {} : { scale: 1.02 }}
                whileTap={loading ? {} : { scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-orange-500/30">
                      ★
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-lg">{pkg.stars.toLocaleString()}</span>
                        {pkg.bonus && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/30 text-green-300 font-medium">
                            {pkg.bonus}
                          </span>
                        )}
                      </div>
                      <span className="text-purple-300 text-sm">{pkg.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {loading === pkg.id ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="text-white font-bold text-xl">{formatPrice(pkg.price)}</span>
                    )}
                  </div>
                </div>
                {pkg.popular && (
                  <div className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-xs font-bold text-white shadow-lg">
                    BEST VALUE
                  </div>
                )}
              </motion.button>
            ))}
          </div>

          <p className="text-gray-500 text-xs text-center mt-4">
            Secure payment powered by Stripe
          </p>
        </div>
      </motion.div>
    </div>
  );
}
