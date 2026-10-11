import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="privacy-consent" />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="items/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="items/post" options={{ headerShown: true }} />
        <Stack.Screen name="claims/create" options={{ headerShown: true }} />
        <Stack.Screen name="claims/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="chat/[claimId]" options={{ headerShown: true }} />
        <Stack.Screen name="items/confirm-return" options={{ headerShown: true }} />
        <Stack.Screen name="items/dispute" options={{ headerShown: true }} />
        <Stack.Screen name="admin/index" options={{ headerShown: true }} />
      </Stack>
    </AuthProvider>
  );
}
