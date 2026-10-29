/**
 * JOYLO INFRASTRUCTURE — web HTML shell.
 *
 * This is Expo Router's default web document wrapper PLUS a tiny boot guard.
 * The guard runs BEFORE the JS bundle executes, so it catches the one failure
 * class nothing else can: module-evaluation / import errors that crash before
 * React (and therefore JoyloErrorBoundary) ever mounts. Those used to leave a
 * silent white screen visible only in the backend logs. Now the guard posts
 * APP_BOOT_ERROR to the Joylo host, which shows the same error popup + Fix CTA
 * as every other error — so the preview is never an unexplained blank.
 */
import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// Runs inside the preview iframe, before any app code. Kept dependency-free and
// defensive so it can never itself break the page.
const bootGuard = `
(function () {
  if (typeof window === "undefined") return;
  if (window.self === window.top) return; // only inside the Joylo preview iframe
  var posted = false;
  function post(msg) {
    if (posted) return;
    posted = true;
    try { window.parent.postMessage({ type: "APP_BOOT_ERROR", error: String(msg || "App failed to start") }, "*"); } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    // Ignore resource-load errors (img/script/link 404s) — only real JS errors.
    if (e && e.target && e.target !== window) return;
    var m = (e && (e.message || (e.error && e.error.message))) || "Script error";
    post(m);
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    post((r && (r.message || r)) || "Unhandled promise rejection");
  });
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Boot guard must run before the bundle — inline, first thing in head. */}
        <script dangerouslySetInnerHTML={{ __html: bootGuard }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
