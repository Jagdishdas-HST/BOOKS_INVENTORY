
// Backend entry. DO NOT call runMigrations() here — the platform's
// supervisor runs schema.sql exactly once BEFORE this process starts.
import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error";
import { seedDemoUsers } from "./lib/seed";

import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { booksRouter } from "./routes/books";
import { stockRouter } from "./routes/stock";
import { salesRouter } from "./routes/sales";
import { remittancesRouter } from "./routes/remittances";
import { customersRouter } from "./routes/customers";
import { reportsRouter } from "./routes/reports";
import { auditRouter } from "./routes/audit";
import { notificationsRouter } from "./routes/notifications";
import { searchRouter } from "./routes/search";
import { statementsRouter } from "./routes/statements";
import { conflictsRouter } from "./routes/conflicts";
import { migrationAuditRouter } from "./routes/migration-audit";
// upload.route.ts exports the router as a DEFAULT export, not a named one.
import uploadRouter from "./routes/upload.route";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/books", booksRouter);
app.use("/api/stock", stockRouter);
app.use("/api/sales", salesRouter);
app.use("/api/remittances", remittancesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/search", searchRouter);
app.use("/api/statements", statementsRouter);
app.use("/api/conflicts", conflictsRouter);
app.use("/api/migration-audit", migrationAuditRouter);
app.use("/api/upload", uploadRouter);

app.use((req, res) => {
  console.warn(`[joylo-backend] unmatched route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `No handler for ${req.method} ${req.originalUrl}. Did you forget to mount the router at /api/<resource>?`,
    },
  });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

// Seed demo accounts BEFORE the server accepts requests, so the very first
// login can't race an unfinished seed. If the seed fails for any reason we
// still start the server — the login route self-heals demo accounts on demand.
async function start() {
  try {
    await seedDemoUsers();
  } catch (e) {
    console.error("[joylo-backend] failed to seed demo users:", e);
  }
  app.listen(PORT, () => {
    console.log(`[joylo-backend] API on ${PORT}`);
  });
}

start();
