import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email });
      setResent(true);
    } catch (err) {
      console.error('Resend error:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        
        <Text style={[styles.title, { color: theme.text }]}>Verify Your Email</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          We've sent a verification link to:
        </Text>
        <Text style={[styles.email, { color: theme.primary }]}>{email}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Please check your inbox and click the link to activate your account.
        </Text>

        {resent ? (
          <View style={[styles.successBox, { backgroundColor: theme.success + '15' }]}>
            <Text style={[styles.successText, { color: theme.success }]}>
              Verification email resent! Check your inbox.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.primary }]}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
              {resending ? 'Sending...' : 'Resend Email'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.sm },
  description: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.sm },
  email: { fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.md },
  successBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginVertical: Spacing.md, width: '100%' },
  successText: { fontSize: FontSize.sm, textAlign: 'center' },
  secondaryButton: { height: 44, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, width: '100%', marginTop: Spacing.md },
  secondaryButtonText: { fontSize: FontSize.md, fontWeight: '600' },
  button: { height: 48, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: Spacing.md },
  buttonText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: '700' },
});
