"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Approximates the browser's page zoom as a percentage relative to whatever
 * zoom was active on mount (read as 100%, same as a fresh tab's own zoom
 * indicator). `devicePixelRatio` scales exactly with Ctrl+/- zoom, so its
 * ratio to that baseline tracks zoom changes precisely -- unlike
 * `outerWidth / innerWidth`, which also moves with the scrollbar, devtools,
 * and window chrome and so reports a false ~104% even sitting at a real
 * 100% (the bug this replaced). There's no "zoom changed" event, so this
 * re-subscribes a `matchMedia` query pinned to the *current* dppx each time
 * it stops matching -- the standard way to observe devicePixelRatio.
 */
export function useZoomLevel(): number {
  const [zoom, setZoom] = useState(100);
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    // jsdom (the test environment) has no matchMedia -- degrade to the
    // static 100% default rather than throwing.
    if (typeof window.matchMedia !== "function") return;

    let mql: MediaQueryList;

    function onChange() {
      const dpr = window.devicePixelRatio;
      baseline.current ??= dpr;
      setZoom(Math.round((dpr / baseline.current) * 100));
      subscribe();
    }

    function subscribe() {
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mql.addEventListener("change", onChange, { once: true });
    }

    baseline.current = window.devicePixelRatio;
    subscribe();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return zoom;
}
