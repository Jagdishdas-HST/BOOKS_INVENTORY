import "dotenv/config";
import express from "express";
import cors from "cors";
import { runMigrations } from "./db/migrate";
import { errorHandler } from "./middleware/error";
import uploadRouter from "./routes/upload.route";

const app = express();

app.use(cors({ origin: "*" }));
// 50mb so a JSON body carrying a base64 image/data-URI doesn't 413 on the first
// try (the old 1mb default was the #1 cause of "413 Payload Too Large" on image
// posts). Large files / videos should still use multipart POST /api/upload
// (50MB, streamed to S3) which bypasses this JSON parser entirely. Matches the
// ingress proxy-body-size (64m) so the parser is never the bottleneck.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Pre-baked routes (DO NOT REMOVE) ────────────────────────────────────────
// File/media uploads to S3. Mobile uploads a file here and stores the returned
// public `url` (+ `key`) in the DB so media persists across pod restarts.
// See backend/src/routes/upload.route.ts and backend/src/services/file.service.ts.
app.use("/api/upload", uploadRouter);

// ─── Add your routes above this line ─────────────────────────────────────────
// Convention: mount each resource in its own file under src/routes/*.ts and
// register here with the /api/ prefix — the mobile app calls
// `${API_URL}/api/<resource>` so the prefix MUST match.
//
//   import { itemsRouter } from "./routes/items";
//   app.use("/api/items", itemsRouter);

// Catch-all for unmatched routes. Express's default returns a bare 404 HTML
// page which makes it hard for the AI fix-loop (and the user) to diagnose
// "405 / 404 on every request" symptoms. We log method+path on every miss
// and return a structured JSON 404 so the mobile app sees a consistent error.
app.use((req, res) => {
  console.warn(`[joylo-backend] unmatched route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `No handler for ${req.method} ${req.originalUrl}. Did you forget to mount the router at /api/<resource>?`,
    },
  });
});

// Centralized error handler — MUST be the last app.use() so it catches
// errors thrown from every route above.
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

/**
 * Boot the HTTP server, then attempt to run migrations.
 *
 * The order matters:
 *   1) `app.listen` first so /health is answering ASAP — the platform's
 *      readiness probes hit /health within seconds of pod boot and a slow
 *      DB connection should not block the entire backend from being marked
 *      ready.
 *   2) Migrations run after listen. If DATABASE_URL is not yet injected
 *      (env-watcher writes backend/.env after pod start), we log it and
 *      retry on the first DB-needing request — supervisord auto-restarts
 *      this process when .env changes, so the next boot will succeed.
 *   3) Migration failures DO NOT crash the server. The user will see the
 *      per-statement SQL errors logged by runMigrations() in the workflow
 *      fix-loop. Server stays up so /health passes.
 */
app.listen(PORT, () => {
  console.log(`[joylo-backend] API on ${PORT}`);
  if (!process.env.DATABASE_URL) {
    console.warn("[joylo-backend] DATABASE_URL not set — skipping initial migrations. Will retry on next restart after env-watcher injects it.");
    return;
  }
  runMigrations().catch((err) => {
    console.error("[joylo-backend] initial migration failed (non-fatal):", err?.message || err);
  });
});
