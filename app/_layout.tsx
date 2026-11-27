import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerGate } from '../src/components/LedgerGate';
import { PreviewTools } from '../src/preview/PreviewTools';
import { LedgerProvider } from '../src/state/LedgerProvider';
// Web preview loads the display font from Google Fonts once; iOS bundles the same font file.
function useWebDisplayFont() {
  useEffect(() => {
    if (Platform.OS !== 'web' || document.getElementById('ayr-display-font')) return;
    const link = document.createElement('link');
    link.id = 'ayr-display-font'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap';
    document.head.appendChild(link);
  }, []);
}
export default function Layout() {
  useWebDisplayFont();
  // The preview tools sit outside the gate so they stay available over the recovery screen. Native builds render nothing for them.
  return <SafeAreaProvider><LedgerProvider>
    <View style={{ flex: 1 }}><PreviewTools /><View style={{ flex: 1 }}><LedgerGate><Stack screenOptions={{ headerShown: false }} /></LedgerGate></View></View>
  </LedgerProvider></SafeAreaProvider>;
}
