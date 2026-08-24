import { Router, type IRouter } from "express";

const router: IRouter = Router();

function unavailable(service: "payment" | "leaderboard") {
  return {
    success: false,
    code: service === "payment" ? "PAYMENT_UNAVAILABLE" : "LEADERBOARD_UNAVAILABLE",
    error: service === "payment"
      ? "Payments are not configured for this deployment."
      : "The leaderboard is not configured for this deployment.",
  };
}

router.post("/create-checkout-session", (_req, res) => {
  res.status(503).json(unavailable("payment"));
});

router.get("/verify-payment", (_req, res) => {
  res.status(503).json(unavailable("payment"));
});

router.get("/leaderboard", (_req, res) => {
  res.status(503).json(unavailable("leaderboard"));
});

router.post("/leaderboard", (_req, res) => {
  res.status(503).json(unavailable("leaderboard"));
});

router.get("/leaderboard/minimum", (_req, res) => {
  res.status(503).json(unavailable("leaderboard"));
});

export default router;