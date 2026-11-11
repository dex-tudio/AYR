import { PreviewLedger } from './preview.ts';
import type { PreviewScenario } from './preview.ts';
const requested = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scenario');
const scenario: PreviewScenario = requested === 'firstStart' || requested === 'empty' || requested === 'readFailure' || requested === 'maximum' ? requested : 'default';
export const ledgerService = new PreviewLedger(scenario);
