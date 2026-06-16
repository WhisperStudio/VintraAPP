import { useSyncExternalStore } from 'react';

let tabsHidden = false;
const listeners = new Set<() => void>();

export function setTabsHidden(hidden: boolean) {
  if (tabsHidden === hidden) return;
  tabsHidden = hidden;
  listeners.forEach((listener) => listener());
}

export function useTabsHidden() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => tabsHidden,
    () => false,
  );
}
