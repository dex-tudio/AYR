import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ledgerService } from '../ledger/service';
import { watchActive } from './polling';
import { LedgerStore } from './store';
import { MonthStore } from './monthStore';

const Context = createContext<LedgerStore | null>(null);
const MonthContext = createContext<MonthStore | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new LedgerStore(ledgerService));
  const [months] = useState(() => new MonthStore(ledgerService));
  return <Context.Provider value={store}><MonthContext.Provider value={months}>{children}</MonthContext.Provider></Context.Provider>;
}

export function useMonth() {
  const store = useContext(MonthContext);
  if (!store) throw new Error('LedgerProvider 안에서만 사용할 수 있어요.');
  return { store, ...useSyncExternalStore(store.subscribe, store.getState, store.getState) };
}

export function useLedger() {
  const store = useContext(Context);
  if (!store) throw new Error('LedgerProvider 안에서만 사용할 수 있어요.');
  return { store, ...useSyncExternalStore(store.subscribe, store.getState, store.getState) };
}

// An active screen reads on focus, when the app returns to the foreground, and every 30 seconds while active.
function useActiveReload(reload: () => void) {
  useFocusEffect(useCallback(() => {
    reload();
    return watchActive(AppState, reload, 30000);
  }, [reload]));
}
export function useActiveRefresh() {
  const { store } = useLedger();
  useActiveReload(useCallback(() => void store.reload(), [store]));
}
// The monthly screen reads the chosen month the same way.
export function useActiveMonthRefresh() {
  const { store } = useMonth();
  useActiveReload(useCallback(() => void store.reload(), [store]));
}

// Faster polling for a screen that waits for something to arrive (the connection check). Stops on blur, unmount and in the background.
export function useActivePolling(ms: number) {
  const { store } = useLedger();
  useFocusEffect(useCallback(() => watchActive(AppState, () => void store.reload(), ms), [store, ms]));
}
