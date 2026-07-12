import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

// localStorage-backed useState. Persistence is client-side for now; when a real
// backend arrives, these values can move to server-side user preferences behind
// api.ts without changing the call sites.
export function usePersistentState<T>(
  key: string,
  initial: T,
  sanitize?: (stored: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return sanitize ? sanitize(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage blocked or full — persistence is best-effort
    }
  }, [key, value]);

  return [value, setValue];
}
