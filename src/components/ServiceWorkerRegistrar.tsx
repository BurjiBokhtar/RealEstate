"use client";

import { useEffect } from "react";

// Registers the service worker, which is what makes the browser offer
// "Install app" / "Add to home screen". Renders nothing.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Registering from localhost or https only -- the API is unavailable on
    // plain http anyway, so guard rather than throw in the console.
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
