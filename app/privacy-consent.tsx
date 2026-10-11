import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { acceptConsent } from '@/services/auth';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

const PRIVACY_SECTIONS = [
  {
    title: '📋 What We Collect',
    body: 'We collect your full name, student ID, nickname, college, and email address when you register. When you post items, we collect titles, descriptions, categories, locations, dates, and optional photos.',
  },
  {
    title: '🎯 Why We Collect It',
    body: 'Your information helps us verify your identity as a MarSU student, connect lost items with their owners, and maintain a safe community. Your student ID and full name are used only for verification and are never shown publicly.',
  },
  {
    title: '🔒 How We Protect It',
    body: 'Your data is stored securely in our database with Row-Level Security. Sensitive information like cash amounts is encrypted. Photos are stored in private buckets accessible only through secure, time-limited URLs.',
  },
  {
    title: '👥 Who Can See Your Data',
    body: 'Only your nickname and college are visible to other users. Your full name and student ID are visible only to you and authorized administrators. Admins access private data only for moderation and verification purposes.',
  },
  {
    title: '📦 Lost & Found Data',
    body: 'Item posts are visible to all registered users. Sensitive categories (Cash, Wallet, ID/Cards) have additional privacy protections — exact amounts and personal details are never shown publicly. Claim conversations are private between the claimant, item poster, and admins.',
  },
  {
    title: '🗑️ Account Deletion',
    body: 'You can request account and data deletion at any time from your profile settings. Your personal information will be removed or anonymized. Minimal audit records may be retained for transaction integrity.',
  },
];

export default function PrivacyConsentScreen() {
  const theme = useTheme();
  const { refreshProfile } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await acceptConsent();
      await refreshProfile();
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to save consent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: theme.primary }]}>Privacy & Data Consent</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Please review how we handle your data before continuing.
        </Text>

        {PRIVACY_SECTIONS.map((section, index) => (
          <View
            key={index}
            style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <Text style={[styles.footerNote, { color: theme.textSecondary }]}>
          By tapping "I Accept", you consent to the collection and processing of your data as described above.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }, isLoading && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>I Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.xxl, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  section: { borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.xs },
  sectionBody: { fontSize: FontSize.sm, lineHeight: 20 },
  errorBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  errorText: { fontSize: FontSize.sm, textAlign: 'center' },
  footer: { padding: Spacing.lg, borderTopWidth: 1 },
  footerNote: { fontSize: FontSize.xs, textAlign: 'center', marginBottom: Spacing.md },
  button: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: FontSize.lg, fontWeight: '700' },
});
