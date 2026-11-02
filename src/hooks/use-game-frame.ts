import { useEffect, useRef } from "react";

/** A stable loop: no React updates per frame and no restart when callbacks change. */
export function useGameFrame(step: (dt: number) => boolean | void) {
  const latest = useRef(step);
  latest.current = step;
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let hidden = document.hidden;
    const visibility = () => {
      hidden = document.hidden;
      last = performance.now();
    };
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!hidden && latest.current(dt) === false) return;
      frame = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
}
