import { useEffect, useRef, useState } from "react";

/**
 * Observe an element's content-box size. Ported verbatim from the reference
 * app (src/lib/useElementSize.ts, PLAN.md §4 "PORT") — used by WindowHost to
 * anchor floating panels within the workspace bounds.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
