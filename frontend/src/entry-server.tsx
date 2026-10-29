import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import App from "./App";
import * as ProvidersModule from "@/components/Providers";
import { SiteUrlContext } from "@/lib/site-url";

// SSR entry. Mirrors main.tsx exactly except for the router (StaticRouter vs BrowserRouter).
// Providers is shared, so any provider added there is present here automatically — never add
// providers to this file.
// Namespace import: codegen flips Providers.tsx between named and default export; a named import would fail esbuild's dep scan at startup.
const Providers = (ProvidersModule as Record<string, any>)["Providers"] ?? (ProvidersModule as Record<string, any>)["default"];

export function render(url: string, origin = "") {
  const helmetContext: Record<string, any> = {};

  renderToString(
    <Providers helmetContext={helmetContext}>
      <SiteUrlContext.Provider value={origin}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </SiteUrlContext.Provider>
    </Providers>,
  );

  return { helmetContext };
}
