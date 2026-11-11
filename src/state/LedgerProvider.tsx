import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ledgerService } from '../ledger/service';
import { LedgerStore } from './store';

const Context = createContext<LedgerStore | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new LedgerStore(ledgerService));
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useLedger() {
  const store = useContext(Context);
  if (!store) throw new Error('LedgerProvider 안에서만 사용할 수 있어요.');
  return { store, ...useSyncExternalStore(store.subscribe, store.getState, store.getState) };
}

// An active screen reads on focus, when the app returns to the foreground, and every 30 seconds while active.
export function useActiveRefresh() {
  const { store } = useLedger();
  useFocusEffect(useCallback(() => {
    void store.reload();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void store.reload(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void store.reload(); }, 30000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [store]));
}
