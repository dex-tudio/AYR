import { PreviewLedger } from './preview.ts';
import type { PreviewScenario } from './preview.ts';
const requested = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scenario');
const scenarios: PreviewScenario[] = ['firstStart', 'empty', 'readFailure', 'maximum', 'readFailureOnce', 'carried', 'saveFailureOnce', 'dayChange', 'listChange'];
const scenario: PreviewScenario = scenarios.find(item => item === requested) ?? 'default';
export const ledgerService = new PreviewLedger(scenario);
