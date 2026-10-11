import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { signIn } from '@/services/auth';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      // Auth state change will handle navigation
    } catch (err: any) {
      const message = err?.message || 'Login failed. Please try again.';
      if (message.includes('Email not confirmed')) {
        router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.appName, { color: theme.primary }]}>MarSU</Text>
          <Text style={[styles.appSubtitle, { color: theme.text }]}>Lost & Found</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Helping Marinduquenos reconnect with their belongings
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="your.email@marsu.edu.ph"
            placeholderTextColor={theme.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Enter your password"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.primary }]}>Register</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  appSubtitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.sm,
  },
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
