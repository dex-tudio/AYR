import { useEffect, useState } from 'react';
import { draftFromSettings, settingsRequest } from '../ledger/contracts';
import type { AppSnapshot, SettingsDraft, SettingsRequest } from '../ledger/contracts';

// The form state shared by onboarding and the settings editor. It starts from the saved settings once;
// later reads never overwrite what the user typed.
export function useSettingsDraft(snapshot: AppSnapshot | null) {
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const ledger = snapshot?.ledger;
  const metadata = snapshot?.metadata;
  useEffect(() => {
    if (draft === null && ledger && metadata) setDraft(draftFromSettings(ledger.settings, metadata));
  }, [draft, ledger, metadata]);
  const update = (patch: Partial<SettingsDraft>) => setDraft(current => current && { ...current, ...patch });
  return {
    draft, metadata, update,
    /** A picked identity also brings its default budget. */
    pickIdentity: (identity: string, dailyBudget: string) => update({ identity, dailyBudget }),
    request: (finishOnboarding: boolean): SettingsRequest | null => draft && metadata ? settingsRequest(draft, metadata, finishOnboarding) : null,
  };
}
