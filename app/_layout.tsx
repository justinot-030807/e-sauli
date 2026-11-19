import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AppStack />
    </AuthProvider>
  );
}

function AppStack() {
  const theme = useTheme();
  const { session, isAuthenticated, isLoading, isApproved, isSuspended, hasConsented, isAdmin } = useAuthContext();
  const canBrowse = isAuthenticated && isApproved && !isSuspended && hasConsented;

  return (
    <Stack screenOptions={{
      headerShown: false,
      headerStyle: { backgroundColor: theme.headerBackground },
      headerTintColor: theme.headerText,
      headerTitleStyle: { fontWeight: '700' },
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="privacy-consent" />
      <Stack.Screen name="pending-approval" />
      <Stack.Protected guard={isLoading || canBrowse}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="items/[id]" options={{ headerShown: true, headerTitle: 'Detalye ng Gamit' }} />
      </Stack.Protected>
      <Stack.Protected guard={isLoading || (canBrowse && !!session)}>
        <Stack.Screen name="items/post" options={{ headerShown: true, headerTitle: 'Mag-report ng Gamit' }} />
        <Stack.Screen name="claims/create" options={{ headerShown: true }} />
        <Stack.Screen name="claims/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="chat/[claimId]" options={{ headerShown: true }} />
        <Stack.Screen name="items/confirm-return" options={{ headerShown: true }} />
        <Stack.Screen name="items/dispute" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={canBrowse && isAdmin}>
        <Stack.Screen name="admin/index" options={{ headerShown: true }} />
      </Stack.Protected>
    </Stack>
  );
}
