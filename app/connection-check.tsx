import { ConnectionCheck } from '../src/components/Guides';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { Alert, Body } from '../src/components/ui';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function ConnectionCheckScreen() {
  const close = useClose('/settings');
  const { snapshot, readError } = useLedger();
  useActiveRefresh();
  return <ScreenFrame title="연결 확인" onBack={close}>
    {readError && <Alert message={readError} />}
    {snapshot?.ledger ? <ConnectionCheck snapshot={snapshot} /> : !readError && <Body>기록을 불러오고 있어요.</Body>}
  </ScreenFrame>;
}
