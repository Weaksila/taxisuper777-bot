import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "TAXISUPER777 bot", uptime: process.uptime() });
});

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "TAXISUPER777 bot is running",
    health: "/api/health",
  });
});

export default router;
