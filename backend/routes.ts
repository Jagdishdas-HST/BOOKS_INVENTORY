import type { Express } from "express";
import { createServer, type Server } from "http";
import { seedDemoUsers } from "./src/lib/seed";

import { authRouter } from "./src/routes/auth";
import { usersRouter } from "./src/routes/users";
import { booksRouter } from "./src/routes/books";
import { stockRouter } from "./src/routes/stock";
import { salesRouter } from "./src/routes/sales";
import { remittancesRouter } from "./src/routes/remittances";
import { customersRouter } from "./src/routes/customers";
import { reportsRouter } from "./src/routes/reports";
import { auditRouter } from "./src/routes/audit";
import { notificationsRouter } from "./src/routes/notifications";
import { searchRouter } from "./src/routes/search";
import { statementsRouter } from "./src/routes/statements";
import { conflictsRouter } from "./src/routes/conflicts";
import { migrationAuditRouter } from "./src/routes/migration-audit";
import uploadRouter from "./src/routes/upload.route";
import { errorHandler } from "./src/middleware/error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed demo users on startup
  try {
    await seedDemoUsers();
  } catch (e) {
    console.error("[joylo-backend] failed to seed demo users:", e);
  }

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

  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}