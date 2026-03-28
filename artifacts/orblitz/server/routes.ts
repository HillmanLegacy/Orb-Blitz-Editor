import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { insertLeaderboardSchema } from "@shared/schema";

const COIN_PACKAGES = [
  { id: "coins_500", name: "500 Coins", coins: 500, price: 99 },
  { id: "coins_1200", name: "1,200 Coins", coins: 1200, price: 199 },
  { id: "coins_2500", name: "2,500 Coins", coins: 2500, price: 399 },
  { id: "coins_6500", name: "6,500 Coins", coins: 6500, price: 999 },
  { id: "coins_14000", name: "14,000 Coins", coins: 14000, price: 1999 },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get('/api/stripe/publishable-key', async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/coin-packages', (req, res) => {
    res.json({ packages: COIN_PACKAGES });
  });

  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { packageId } = req.body;
      const pkg = COIN_PACKAGES.find(p => p.id === packageId);
      
      if (!pkg) {
        return res.status(400).json({ error: 'Invalid package' });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: pkg.name,
              description: `${pkg.coins} coins for Orblitz`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}?purchase=cancelled`,
        metadata: {
          packageId: pkg.id,
          coins: pkg.coins.toString(),
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const processedSessions = new Set<string>();

  app.get('/api/verify-payment', async (req, res) => {
    try {
      const { session_id } = req.query;
      
      if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing session ID' });
      }

      if (processedSessions.has(session_id)) {
        return res.json({ success: false, error: 'Session already processed' });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      if (session.payment_status !== 'paid') {
        return res.json({ success: false, error: 'Payment not completed' });
      }

      const coins = parseInt(session.metadata?.coins || '0', 10);
      
      if (coins <= 0) {
        return res.json({ success: false, error: 'Invalid coin amount' });
      }

      processedSessions.add(session_id);
      
      res.json({ success: true, coins });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const scores = await storage.getTopScores(200);
      res.json({ scores });
    } catch (error: any) {
      console.error('Leaderboard fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/leaderboard/minimum', async (req, res) => {
    try {
      const minimumScore = await storage.getLowestTopScore(200);
      res.json({ minimumScore });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leaderboard', async (req, res) => {
    try {
      const parsed = insertLeaderboardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors });
      }

      const entry = await storage.submitScore(parsed.data);
      if (!entry) {
        return res.json({ success: false, message: 'Score not high enough for leaderboard' });
      }

      res.json({ success: true, entry });
    } catch (error: any) {
      console.error('Leaderboard submit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
