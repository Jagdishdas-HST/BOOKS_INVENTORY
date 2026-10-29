// Renders every route through the SSR bundle and fails if any throws. Catches the two crash
// classes the template guards against: providers missing from Providers.tsx, and browser
// globals touched during render (framer-motion, canvas, charts) outside <ClientOnly>.
// Usage: node scripts/verify-ssr.mjs [route ...]   (defaults to routes parsed from App.tsx)
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = path.resolve(root, "dist/server/entry-server.js");

if (!fs.existsSync(bundle)) {
  console.error("SSR bundle not found at dist/server/entry-server.js — run `npm run build` first.");
  process.exit(1);
}

// Parse <Route path="..."> from App.tsx so new routes are verified without editing this file.
function discoverRoutes() {
  const appPath = path.resolve(root, "frontend/src/App.tsx");
  if (!fs.existsSync(appPath)) return ["/"];
  const src = fs.readFileSync(appPath, "utf-8");
  const found = [...src.matchAll(/<Route\s+[^>]*path=["']([^"']+)["']/g)].map((m) => m[1]);
  const usable = found.filter((r) => r !== "*" && !r.includes(":"));
  const skipped = found.filter((r) => r !== "*" && r.includes(":"));
  if (skipped.length) {
    console.log(`  note: skipped ${skipped.length} dynamic route(s) (params unknown): ${skipped.join(", ")}`);
  }
  return usable.length ? [...new Set(usable)] : ["/"];
}

const routes = process.argv.slice(2).length ? process.argv.slice(2) : discoverRoutes();

function explain(e) {
  const msg = e && e.message ? e.message : String(e);
  if (/is not defined|is not a function/.test(msg) && /window|document|localStorage|sessionStorage|navigator|matchMedia/.test(msg)) {
    return `${msg}\n        -> browser global used during render; wrap the component in <ClientOnly> or move the access into useEffect.`;
  }
  if (/must be used within/.test(msg)) {
    return `${msg}\n        -> provider missing from the SSR tree; add it to frontend/src/components/Providers.tsx.`;
  }
  return msg;
}

// A module-level browser global throws at import time, before any route renders.
let render;
try {
  ({ render } = await import(pathToFileURL(bundle).href));
} catch (e) {
  console.error("  FAIL  <module import>");
  console.error(`        ${explain(e)}`);
  console.error("\nSSR verification failed: the SSR bundle threw while loading.");
  console.error("A browser global read at module top level runs before any component mounts.");
  process.exit(1);
}

let failed = 0;
for (const route of routes) {
  try {
    render(route, "https://verify.local");
    console.log(`  PASS  ${route}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${route}`);
    console.error(`        ${explain(e)}`);
  }
}

if (failed) {
  console.error(`\nSSR verification failed for ${failed}/${routes.length} route(s).`);
  console.error("Fix: app-wide providers belong in frontend/src/components/Providers.tsx.");
  console.error("     Components touching window/document/localStorage or animating on mount");
  console.error("     must be wrapped in <ClientOnly> from @/components/ClientOnly.");
  process.exit(1);
}
console.log(`\nSSR verification passed for ${routes.length} route(s).`);
