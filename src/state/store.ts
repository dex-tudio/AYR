import type { AppSnapshot, LedgerService, MutationResult } from '../ledger/contracts.ts';
import { assertSnapshotMoney } from '../ledger/contracts.ts';

// source tells which screen's action failed, so the screen underneath a form does not repeat the form's failure.
export type Failure = { message: string; canReset: boolean; source: 'add' | 'remove' };
export type StoreState = {
  snapshot: AppSnapshot | null;
  /** The last read failed; the previous snapshot, if any, is the last good one. */
  readError: string | null;
  refreshing: boolean;
  mutating: boolean;
  /** The last add/remove failed. Only a new attempt or clearFailure() removes it, never a read. */
  failure: Failure | null;
};

const unknownOutcome = '저장 결과를 확인하지 못했어요. 오늘 지출 목록을 확인한 뒤 필요하면 다시 시도해주세요.';
const readFailure = '기록을 불러오지 못했어요.';

// Shared ledger state. Plain TypeScript so ordering rules are testable without React.
export class LedgerStore {
  private state: StoreState = { snapshot: null, readError: null, refreshing: false, mutating: false, failure: null };
  private listeners = new Set<() => void>();
  // Every read and mutation takes a number; only the newest one may write state.
  private latest = 0;
  private service: LedgerService;
  constructor(service: LedgerService) { this.service = service; }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = () => this.state;
  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  async reload(): Promise<void> {
    if (this.state.mutating) return;
    const request = ++this.latest;
    this.set({ refreshing: true });
    try {
      const snapshot = assertSnapshotMoney(await this.service.getSnapshot());
      if (request === this.latest) this.set({ snapshot, readError: null, refreshing: false });
    } catch (cause) {
      if (request === this.latest) this.set({ readError: cause instanceof Error ? cause.message : readFailure, refreshing: false });
    }
  }

  clearFailure() { if (this.state.failure) this.set({ failure: null }); }

  addSpending(amount: string, expectedDay: string) { return this.mutate('add', () => this.service.addSpending(amount, expectedDay)); }
  removeSpending(index: number, expectedCurrent: string) { return this.mutate('remove', () => this.service.removeSpending(index, expectedCurrent)); }

  // One mutation at a time: a second press while one is running is ignored, not queued.
  private async mutate(source: Failure['source'], run: () => Promise<MutationResult>): Promise<boolean> {
    if (this.state.mutating) return false;
    ++this.latest; // drops any read still in flight
    this.set({ mutating: true, failure: null });
    let saved = false;
    let unknown = false;
    try {
      const result = await run();
      const snapshot = assertSnapshotMoney(result.snapshot);
      ++this.latest;
      if (result.ok) {
        saved = true;
        this.set({ snapshot, readError: null, refreshing: false });
      } else {
        const { error } = snapshot;
        this.set({
          // The failure is kept apart from snapshot.error so a later read cannot erase it.
          snapshot: snapshot.ledger ? { ...snapshot, error: null } : this.state.snapshot,
          readError: null, refreshing: false,
          failure: { message: error?.message ?? '저장하지 못했어요.', canReset: error?.canReset ?? false, source },
        });
      }
    } catch {
      // Whether the change reached the ledger is unknown, so never retry for the user; show the real list instead.
      unknown = true;
      this.set({ failure: { message: unknownOutcome, canReset: false, source } });
    } finally {
      this.set({ mutating: false });
    }
    if (unknown) await this.reload();
    return saved;
  }
}
