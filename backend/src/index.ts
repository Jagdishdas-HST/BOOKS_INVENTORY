
import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error";
import uploadRouter from "./routes/upload.route";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { booksRouter } from "./routes/books";
import { stockRouter } from "./routes/stock";
import { salesRouter } from "./routes/sales";
import { remittancesRouter } from "./routes/remittances";
import { auditRouter } from "./routes/audit";
import { reportsRouter } from "./routes/reports";
import { statementsRouter } from "./routes/statements";
import { conflictsRouter } from "./routes/conflicts";
import { seedIfEmpty } from "./lib/seed";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/upload", uploadRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/books", booksRouter);
app.use("/api/stock", stockRouter);
app.use("/api/sales", salesRouter);
app.use("/api/remittances", remittancesRouter);
app.use("/api/audit", auditRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/statements", statementsRouter);
app.use("/api/conflicts", conflictsRouter);

app.use((req, res) => {
  console.warn(`[joylo-backend] unmatched route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `No handler for ${req.method} ${req.originalUrl}.`,
    },
  });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`[joylo-backend] API on ${PORT}`);
  if (process.env.DATABASE_URL) {
    seedIfEmpty().catch((e) => console.error("[seed] failed (non-fatal):", e?.message || e));
  }
});
