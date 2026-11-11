import { Platform } from 'react-native';
import { DisplayGuide } from '../src/components/Guides';
import { LockScreenPreview } from '../src/components/LockScreenPreview';
import { ScreenFrame, useClose } from '../src/components/ScreenFrame';
import { useActiveRefresh, useLedger } from '../src/state/LedgerProvider';

export default function Display() {
  const close = useClose('/settings');
  const { snapshot } = useLedger();
  useActiveRefresh();
  // The iPhone shows the real widget; the browser can only show how it will look.
  return <ScreenFrame title="잠금화면 표시" onBack={close}>
    {snapshot && Platform.OS === 'web' && <LockScreenPreview snapshot={snapshot} />}
    {snapshot && <DisplayGuide snapshot={snapshot} />}
  </ScreenFrame>;
}
