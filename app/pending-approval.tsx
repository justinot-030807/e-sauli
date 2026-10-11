import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { signOut } from '@/services/auth';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useState } from 'react';

export default function PendingApprovalScreen() {
  const theme = useTheme();
  const { profile, refreshProfile, isSuspended, isApproved } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
    // If approved now, the index redirect will handle it
    if (isApproved && !isSuspended) {
      router.replace('/');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const isSuspendedState = isSuspended;
  const isRejected = profile?.approval_status === 'rejected';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.emoji}>
          {isSuspendedState ? '🚫' : isRejected ? '❌' : '⏳'}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {isSuspendedState
            ? 'Account Suspended'
            : isRejected
            ? 'Registration Rejected'
            : 'Pending Approval'}
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {isSuspendedState
            ? 'Your account has been suspended by an administrator. You cannot post, claim, or chat while suspended. Please contact the Lost & Found office for assistance.'
            : isRejected
            ? 'Your registration has been rejected. Please contact the Lost & Found office if you believe this is an error.'
            : 'Your account is awaiting admin approval. You will be able to post, claim, and chat once approved. Check back later!'}
        </Text>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.primary }]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Check Status</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: theme.error }]}
          onPress={handleSignOut}
        >
          <Text style={[styles.outlineButtonText, { color: theme.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  description: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  secondaryButton: { height: 44, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, width: '100%', marginBottom: Spacing.md },
  secondaryButtonText: { fontSize: FontSize.md, fontWeight: '600' },
  outlineButton: { height: 44, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, width: '100%' },
  outlineButtonText: { fontSize: FontSize.md, fontWeight: '600' },
});
