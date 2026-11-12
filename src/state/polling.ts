type AppStateLike = {
  currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
};

// Timer functions can be swapped so a test can count the timers that are still running.
type TimerApi = { setInterval(handler: () => void, ms: number): unknown; clearInterval(id: never): void };

// Calls tick every `ms` while the app is active. Leaving the app clears the timer; coming back reads once and starts it again.
// The returned function stops everything (screen blur or unmount).
export function watchActive(appState: AppStateLike, tick: () => void, ms: number, timers: TimerApi = globalThis): () => void {
  let timer: unknown = null;
  const start = () => { if (timer === null) timer = timers.setInterval(tick, ms); };
  const stop = () => { if (timer !== null) { timers.clearInterval(timer as never); timer = null; } };
  if (appState.currentState === 'active') start();
  const subscription = appState.addEventListener('change', state => {
    if (state === 'active') { tick(); start(); } else stop();
  });
  return () => { subscription.remove(); stop(); };
}
