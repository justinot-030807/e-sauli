import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { signOut } from '@/services/auth';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { profile, user } = useAuthContext();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {profile.nickname.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.nickname, { color: theme.text }]}>{profile.nickname}</Text>
        <Text style={[styles.college, { color: theme.textSecondary }]}>{profile.college}</Text>
        <Text style={[
          styles.badge,
          {
            backgroundColor: profile.role === 'admin' ? theme.accent + '30' : theme.primary + '20',
            color: profile.role === 'admin' ? theme.accent : theme.primary,
          },
        ]}>
          {profile.role === 'admin' ? '👑 Admin' : '🎓 Student'}
        </Text>
      </View>

      <View style={[styles.statsRow, { borderColor: theme.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.primary }]}>{profile.points}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Points</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.primary }]}>{profile.returns_count}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Returns</Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>Account Details</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Full Name</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{profile.full_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Student ID</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{profile.student_id}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Status</Text>
          <Text style={[
            styles.statusBadge,
            { 
              backgroundColor: profile.approval_status === 'approved' ? theme.success + '20' : theme.warning + '20',
              color: profile.approval_status === 'approved' ? theme.success : theme.warning,
            },
          ]}>
            {profile.approval_status}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: theme.error }]}
        onPress={handleSignOut}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color={theme.error} />
        ) : (
          <Text style={[styles.signOutText, { color: theme.error }]}>Sign Out</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton}>
        <Text style={[styles.deleteText, { color: theme.error }]}>Delete My Account & Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { margin: Spacing.lg, borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { color: '#ffffff', fontSize: FontSize.xxl, fontWeight: '700' },
  nickname: { fontSize: FontSize.xl, fontWeight: '700' },
  college: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  badge: { fontSize: FontSize.xs, fontWeight: '600', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, marginTop: Spacing.sm, overflow: 'hidden' },
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statDivider: { width: 1 },
  statValue: { fontSize: FontSize.xxl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  infoCard: { margin: Spacing.lg, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1 },
  infoTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 0 },
  infoLabel: { fontSize: FontSize.sm },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  statusBadge: { fontSize: FontSize.xs, fontWeight: '600', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, overflow: 'hidden', textTransform: 'capitalize' },
  signOutButton: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, height: 48, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  signOutText: { fontSize: FontSize.md, fontWeight: '700' },
  deleteButton: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.xxl, height: 48, justifyContent: 'center', alignItems: 'center' },
  deleteText: { fontSize: FontSize.sm, fontWeight: '600' },
});
