import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { startCronJobs } from "./cron";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import reportsRoutes from "./routes/reports";
import catalogRoutes from "./routes/catalog";
import loanRoutes from "./routes/loans";
import reservationRoutes from "./routes/reservations";
import digitalBookRoutes from "./routes/digitalBooks";
import notificationRoutes from "./routes/notifications";
import cronRoutes from "./routes/cron";
import { ensureUploadDirs } from "./config/storage";

ensureUploadDirs();

const app = express();
const port = Number(process.env.PORT ?? 5000);

function parseAllowedOrigins(): string[] | true {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw || raw === "*") {
    return true; // reflect any origin (LAN demo / Expo defaults)
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: parseAllowedOrigins(),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Try again later." },
});

app.get("/health", (_req, res) => {
  res.json({
    service: "dlms-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/digital-books", digitalBookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/internal/cron", cronRoutes);

app.listen(port, "0.0.0.0", () => {
  console.log(`DLMS API listening on http://localhost:${port}`);
  console.log(`LAN access: http://192.168.100.7:${port}`);
  startCronJobs();
});
