import type { LedgerService, MonthViewState } from '../ledger/contracts.ts';
import { assertMonthState, monthOffsets, validMonthOffset } from '../ledger/contracts.ts';

export type MonthState = {
  /** The month the user chose; 0 is this month. Changes at once, before the month has arrived. */
  offset: number;
  /** The chosen month once it was read; null while it loads, so another month's numbers never sit under the new title. */
  month: MonthViewState | null;
  loading: boolean;
  error: string | null;
};

const readFailure = '월 기록을 불러오지 못했어요.';

// Month selection and loading. Plain TypeScript so the ordering rule is testable without React.
export class MonthStore {
  private state: MonthState = { offset: monthOffsets.newest, month: null, loading: false, error: null };
  private listeners = new Set<() => void>();
  // Every read takes a number; only the newest one may write state, so a late answer for an earlier month is dropped.
  private latest = 0;
  private service: Pick<LedgerService, 'getMonth'>;
  constructor(service: Pick<LedgerService, 'getMonth'>) { this.service = service; }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = () => this.state;
  private set(patch: Partial<MonthState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  /** Choose a month. Returns false and changes nothing for an offset outside the kept months. */
  select(offset: number): boolean {
    if (!validMonthOffset(offset)) return false;
    if (offset !== this.state.offset) this.set({ offset, month: null, error: null });
    void this.reload();
    return true;
  }

  /** Read the chosen month again; the month already shown stays until the new answer arrives. */
  async reload(): Promise<void> {
    const request = ++this.latest;
    const { offset } = this.state;
    this.set({ loading: true });
    try {
      const month = assertMonthState(await this.service.getMonth(offset), offset);
      if (request === this.latest) this.set({ month, error: null, loading: false });
    } catch (cause) {
      if (request === this.latest) this.set({ error: cause instanceof Error ? cause.message : readFailure, loading: false });
    }
  }
}
