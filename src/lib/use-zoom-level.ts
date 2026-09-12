"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Approximates the browser's page zoom as a percentage relative to whatever
 * zoom was active on mount (read as 100%, same as a fresh tab's own zoom
 * indicator). `devicePixelRatio` scales exactly with Ctrl+/- zoom, so its
 * ratio to that baseline tracks zoom changes precisely -- unlike
 * `outerWidth / innerWidth`, which also moves with the scrollbar, devtools,
 * and window chrome and so reports a false ~104% even sitting at a real
 * 100%.
 *
 * Known tradeoff, accepted deliberately: a page reloaded at a non-100%
 * browser zoom still reads "100%" (the baseline resets on every mount) --
 * an absolute-zoom version was tried and pulled: solving for zoom from
 * devicePixelRatio alone means guessing which OS display-scale factor it's
 * layered on top of, and that guess was wrong often enough in practice to
 * show worse (random-looking) numbers than this simpler relative version
 * ever did. Live zoom changes during a session are what this needs to get
 * right, and does.
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
