import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Animates a displayed number from its previous value to `target` whenever
// target changes — used by StatCard so KPIs feel alive on every data refresh
// instead of just snapping to the new number.
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = typeof target === 'number' ? target : 0;
    if (from === to) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutExpo(progress);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}
