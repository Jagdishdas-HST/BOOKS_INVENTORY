import type express from "express";

// SSR head-injection helpers, scaffolded by the `seo` skill. The base template serves a plain
// SPA; these functions add per-route <head> tags so crawlers and link scrapers (which do not
// execute JS) see real title/description/canonical/og tags in the initial HTML response.

export type RenderFn = (url: string, origin?: string) => { helmetContext: Record<string, any> };

// Build the absolute origin (scheme://host) for a request so SSR renders absolute
// canonical/og:url. Honors proxy headers since apps run behind ingress.
export function requestOrigin(req: express.Request): string {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host");
  return host ? `${proto}://${host}` : "";
}

// Flatten a react-helmet-async context into a head-tag string.
export function helmetHeadTags(helmetContext: any): string {
  const helmet = helmetContext?.helmet;
  if (!helmet) return "";
  return [
    helmet.title?.toString(),
    helmet.meta?.toString(),
    helmet.link?.toString(),
    helmet.script?.toString(),
  ]
    .filter((tag) => tag && tag.trim())
    .join("\n  ");
}

// Inject SSR head tags into the template, removing any static default tag the render already
// provides so View Source has exactly one of each (no duplicate title, description, canonical,
// or og:/twitter: tags). Static tags the route does not override are left as app-wide fallbacks.
export function injectHead(template: string, headTags: string): string {
  if (!headTags) return template;
  let html = template;

  if (/<title[\s>]/i.test(headTags)) {
    html = html.replace(/[ \t]*<title\b[^>]*>[\s\S]*?<\/title>\s*\n?/i, "");
  }

  const canonicalInHead = /<link[^>]*rel=["']canonical["']/i.test(headTags);
  if (canonicalInHead) {
    html = html.replace(/[ \t]*<link[^>]*rel=["']canonical["'][^>]*>\s*\n?/i, "");
  }

  const metaKeys = new Set<string>();
  const metaAttrRe = /<meta[^>]*\b(name|property)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = metaAttrRe.exec(headTags)) !== null) {
    metaKeys.add(`${m[1].toLowerCase()}=${m[2].toLowerCase()}`);
  }
  if (metaKeys.size > 0) {
    html = html.replace(/[ \t]*<meta\b[^>]*>\s*\n?/gi, (tag) => {
      const attr = /\b(name|property)=["']([^"']+)["']/i.exec(tag);
      if (attr && metaKeys.has(`${attr[1].toLowerCase()}=${attr[2].toLowerCase()}`)) {
        return "";
      }
      return tag;
    });
  }

  return html.includes("<!--ssr-head-->")
    ? html.replace("<!--ssr-head-->", headTags)
    : html.replace("<head>", `<head>\n  ${headTags}`);
}
