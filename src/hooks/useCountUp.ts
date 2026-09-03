import { useEffect, useRef, useState } from 'react';

/**
 * Anima um número de 0 até `end`, respeitando prefers-reduced-motion
 * (nesse caso, mostra o valor final imediatamente, sem animação).
 */
export function useCountUp(end: number, durationMs = 1200, active = true): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!active) {
      setValue(0);
      return;
    }

    if (prefersReducedMotion) {
      setValue(end);
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setValue(end);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, durationMs, active]);

  return value;
}
