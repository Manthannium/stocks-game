import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Tweens from the currently displayed value to `value`.
 * If the value changes mid-animation, it continues from the current frame.
 */
export default function useAnimatedNumber(value, duration = 650) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;

    if (from === target) return;

    if (prefersReducedMotion()) {
      current.current = target;
      setDisplay(target);
      return;
    }

    let frame;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (target - from) * eased;

      current.current = next;
      setDisplay(next);

      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}