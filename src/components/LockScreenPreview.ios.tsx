import type { AppSnapshot } from '../ledger/contracts';

// The iPhone shows the real widget; the design preview exists only in the browser build (LockScreenPreview.web.tsx).
export function LockScreenPreview(_: { snapshot: AppSnapshot }) { return null; }
