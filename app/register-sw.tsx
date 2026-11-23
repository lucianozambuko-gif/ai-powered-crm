"use client";

import { useEffect } from "react";

// Registers the service worker so the app can be installed on phone and laptop.
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
