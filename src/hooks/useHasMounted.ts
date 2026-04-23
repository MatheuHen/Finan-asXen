"use client";

import { useSyncExternalStore } from "react";

let mounted = false;

function schedule(cb: () => void) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(cb);
    return;
  }
  Promise.resolve().then(cb);
}

export function useHasMounted() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!mounted) {
        mounted = true;
        schedule(onStoreChange);
      }
      return () => {};
    },
    () => mounted,
    () => false
  );
}
