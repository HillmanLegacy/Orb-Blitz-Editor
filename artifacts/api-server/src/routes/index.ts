import { Router, type IRouter } from "express";
import healthRouter from "./health";
import orblitzUnavailableRouter from "./orblitz-unavailable";

const router: IRouter = Router();

router.use(healthRouter);
router.use(orblitzUnavailableRouter);

export default router;
