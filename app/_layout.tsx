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
      </Stack>
    </AuthProvider>
  );
}
