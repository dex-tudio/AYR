import { PreviewLedger } from './preview.ts';
import type { PreviewScenario } from './preview.ts';
const requested = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scenario');
const scenarios: PreviewScenario[] = ['firstStart', 'empty', 'readFailure', 'maximum', 'readFailureOnce', 'carried', 'saveFailureOnce', 'dayChange', 'listChange',
  'firstStartSaveFailureOnce', 'corrupt', 'corruptResetFailureOnce', 'mixedSources', 'monthReadFailureOnce', 'receptionFailure'];
const scenario: PreviewScenario = scenarios.find(item => item === requested) ?? 'default';
/** The scenario this page was opened with; the preview tools show and change it. */
export const activeScenario: PreviewScenario = scenario;
const preview = new PreviewLedger(scenario);
export const ledgerService = preview;
// The browser has no shortcut automation, so the connection check offers this clearly labelled simulation instead.
export const simulateTestReception: (() => void) | null = () => preview.receiveTest();
