import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { injectHead, helmetHeadTags, requestOrigin, type RenderFn } from "./ssr";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Silences the "WebSocket closed without opened" noise hmr:false leaves behind; stubbing /@vite/client instead breaks Vite's dep graph and 503s every module.
const HMR_RELOAD_SUPPRESS = `<script>
(() => {
  const OrigWS = window.WebSocket;
  if (!OrigWS) return;
  const Patched = function (url, protocols) {
    const ws = protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols);
    // Capture phase so these run before the HMR client's own listeners.
    if (String(url).includes('vite-hmr') || String(url).includes('24678')) {
      ws.addEventListener('error', (e) => e.stopImmediatePropagation(), true);
      ws.addEventListener('close', (e) => e.stopImmediatePropagation(), true);
    }
    return ws;
  };
  Patched.prototype = OrigWS.prototype;
  Patched.CONNECTING = OrigWS.CONNECTING; Patched.OPEN = OrigWS.OPEN;
  Patched.CLOSING = OrigWS.CLOSING; Patched.CLOSED = OrigWS.CLOSED;
  window.WebSocket = Patched;
})();
</script>`;

export async function setupVite(app: Express, server: Server) {
  // hmr:false stops the reloads: the client's socket never opens, so the close handler that calls location.reload() is unreachable. Costs Fast Refresh.
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const resolvedConfig = typeof viteConfig === "function"
    ? viteConfig({ command: "serve", mode: "development" })
    : viteConfig;

  const vite = await createViteServer({
    ...resolvedConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      // Log without exiting: a transient Vite error used to kill the whole preview process.
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Mirrors serveStatic's circuit breaker: latch off rather than throw once per request.
  const DEV_SSR_FAILURE_LIMIT = 5;
  let devSsrEnabled = true;
  let devSsrFailures = 0;

  // No path: express 5 rejects the bare "/*" wildcard, and imported apps often run express 5.
  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "frontend",
        "index.html"
      );

      // Always reload the index.html file from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      const ENTRY_SCRIPT = `<script type="module" src="/src/main.tsx"></script>`;
      if (!template.includes(`src="/src/main.tsx"`) && !template.includes(`src='/src/main.tsx'`)) {
        template = template
          .replace(/<script[^>]*src=["'][^"']*main\.[^"']*["'][^>]*><\/script>/gi, "")
          .replace("</body>", `  ${ENTRY_SCRIPT}\n</body>`);
        log("Warning: entry script tag was missing or wrong — auto-restored");
      }

      let page = await vite.transformIndexHtml(url, template);

      // Must land before Vite's injected module preamble so the patch is in place when it connects.
      page = page.includes("<head>")
        ? page.replace("<head>", `<head>\n${HMR_RELOAD_SUPPRESS}`)
        : `${HMR_RELOAD_SUPPRESS}\n${page}`;

      // Render head tags in dev so View Source matches prod; a failure falls back to the shell.
      if (devSsrEnabled) {
        try {
          const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
          const { helmetContext } = render(url, requestOrigin(req));
          page = injectHead(page, helmetHeadTags(helmetContext));
        } catch (ssrErr) {
          devSsrFailures += 1;
          if (devSsrFailures >= DEV_SSR_FAILURE_LIMIT) {
            devSsrEnabled = false;
            log(`Dev SSR head injection disabled after ${devSsrFailures} failures — serving SPA shell. Last error: ${ssrErr}`);
          } else {
            log(`Dev SSR head injection skipped for ${url} (${devSsrFailures}/${DEV_SSR_FAILURE_LIMIT}): ${ssrErr}`);
          }
        }
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  log("Vite development server setup complete");
}

export async function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const templatePath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Load the SSR bundle if the build produced one; a missing bundle means SPA, not an error.
  let ssrRender: RenderFn | null = null;
  try {
    const mod = await import(path.resolve(import.meta.dirname, "server/entry-server.js"));
    ssrRender = mod.render as RenderFn;
    log("SSR rendering enabled");
  } catch {
    log("SSR bundle not found, serving in SPA mode");
  }

  // Read the built shell once; injectHead operates on this string.
  const template = fs.readFileSync(templatePath, "utf-8");

  // Circuit breaker: after repeated SSR failures serve the SPA shell instead of failing hard.
  const SSR_FAILURE_LIMIT = 5;
  let ssrFailures = 0;

  // index: false so "/" falls through to the SSR catch-all instead of being served directly.
  app.use(express.static(distPath, { index: false }));

  // No path: express 5 rejects the bare "/*" wildcard, and imported apps often run express 5.
  app.use(async (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    if (!ssrRender) {
      return res.sendFile(templatePath);
    }
    try {
      const { helmetContext } = ssrRender(req.originalUrl, requestOrigin(req));
      const html = injectHead(template, helmetHeadTags(helmetContext));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      ssrFailures += 1;
      log(`SSR render failed for ${req.originalUrl} (${ssrFailures}/${SSR_FAILURE_LIMIT}): ${e}`);
      if (ssrFailures >= SSR_FAILURE_LIMIT) {
        ssrRender = null;
        log("SSR disabled for this process after repeated failures — serving SPA");
      }
      // Never re-enter the router on SSR failure; that would loop back into this handler.
      res.sendFile(templatePath);
    }
  });

  log("Static file serving setup complete");
}
