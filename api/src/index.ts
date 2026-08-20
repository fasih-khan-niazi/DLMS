import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { startCronJobs } from "./cron";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import catalogRoutes from "./routes/catalog";
import loanRoutes from "./routes/loans";
import reservationRoutes from "./routes/reservations";
import digitalBookRoutes from "./routes/digitalBooks";
import cronRoutes from "./routes/cron";
import { ensureUploadDirs } from "./config/storage";

ensureUploadDirs();

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "dlms-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/digital-books", digitalBookRoutes);
app.use("/internal/cron", cronRoutes);

app.listen(port, "0.0.0.0", () => {
  console.log(`DLMS API listening on http://localhost:${port}`);
  console.log(`LAN access: http://192.168.100.7:${port}`);
  startCronJobs();
});
