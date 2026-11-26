// Minimal service worker: makes the app installable and shows a friendly page when offline.
// It does NOT cache anything, so you never see stale screens after an update.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(() =>
      new Response(
        '<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1720;color:#e6eef3;font-family:system-ui;text-align:center"><div><h2>AdMind</h2><p>You are offline. Check your connection and try again.</p></div>',
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    )
  );
});