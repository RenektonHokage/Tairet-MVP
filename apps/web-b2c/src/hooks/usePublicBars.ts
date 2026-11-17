import { useEffect, useState } from "react";
import { getPublicBars, type PublicBar } from "@/lib/publicBars";

// No persisted catalog or fixture fallback: an error leaves bars undiscoverable.
export function usePublicBars() {
  const [bars, setBars] = useState<PublicBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      const current = ++revision;
      setBars([]);
      setIsLoading(true);
      setError(false);
      getPublicBars().then(result => {
        if (active && current === revision) setBars(result);
      }).catch(() => {
        if (active && current === revision) setError(true);
      }).finally(() => {
        if (active && current === revision) setIsLoading(false);
      });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);

  return { bars, isLoading, error };
}
