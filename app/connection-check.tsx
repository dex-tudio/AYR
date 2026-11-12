import { ConnectionCheck } from '../src/components/Guides';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function ConnectionCheckScreen() {
  const close = useClose('/settings');
  const { snapshot } = useLedger();
  useActiveRefresh();
  return <ScreenFrame title="연결 확인" onBack={close}>
    {snapshot?.ledger && <ConnectionCheck snapshot={snapshot} />}
  </ScreenFrame>;
}
