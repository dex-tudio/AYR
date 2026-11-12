import { Text, View } from 'react-native';
import type { AppSnapshot } from '../ledger/contracts';
import { describeReception } from '../ledger/contracts';
import { useTheme } from '../theme';

// The last automation call, global across screens. Only a success or test call is marked as connected.
export function ReceptionStatus({ ledger }: { ledger: NonNullable<AppSnapshot['ledger']> }) {
  const theme = useTheme();
  const view = describeReception(ledger);
  return <View style={{ gap: 6 }} testID="reception-status">
    {view.at && <Text style={{ color: theme.secondary, fontSize: 12 }}>{view.at}</Text>}
    <Text style={{ color: view.success ? theme.calm : theme.secondary, fontSize: 14, lineHeight: 22 }}>{view.success ? '✓ ' : ''}{view.text}</Text>
  </View>;
}
