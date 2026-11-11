import { PreviewLedger } from './preview.ts';
import type { PreviewScenario } from './preview.ts';
const requested = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scenario');
const scenarios: PreviewScenario[] = ['firstStart', 'empty', 'readFailure', 'maximum', 'readFailureOnce', 'carried', 'saveFailureOnce', 'dayChange', 'listChange',
  'firstStartSaveFailureOnce', 'corrupt', 'corruptResetFailureOnce', 'mixedSources', 'monthReadFailureOnce'];
const scenario: PreviewScenario = scenarios.find(item => item === requested) ?? 'default';
const preview = new PreviewLedger(scenario);
export const ledgerService = preview;
// The browser has no shortcut automation, so the connection check offers this clearly labelled simulation instead.
export const simulateTestReception: (() => void) | null = () => preview.receiveTest();
