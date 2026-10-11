import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';

export default function IndexScreen() {
  const { isLoading, isAuthenticated, hasConsented, isApproved, isSuspended } = useAuthContext();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasConsented) {
    return <Redirect href="/privacy-consent" />;
  }

  if (!isApproved) {
    return <Redirect href="/pending-approval" />;
  }

  if (isSuspended) {
    return <Redirect href="/pending-approval" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
