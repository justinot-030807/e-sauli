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
  ActivityIndicator,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signIn, signInDemo } from '@/services/auth';
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
      setError('Pakisulatan ang email at password.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (err: any) {
      const message = err?.message || 'Hindi nakapag-login. Pakisubukang muli.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = async (role: 'student' | 'admin') => {
    setIsLoading(true);
    setError(null);
    try {
      await signInDemo(role);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Nabigong mag-login sa demo.');
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
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: theme.primary }]}>E-Sauli</Text>
          <Text style={[styles.appSubtitle, { color: theme.text }]}>Campus Lost & Found Platform</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Tulungang maibalik ang mga nawawalang gamit sa buong komunidad ng campus
          </Text>
        </View>

        {/* Quick Demo Access Card */}
        <View style={[styles.demoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.demoCardTitle, { color: theme.text }]}>
            Mabilisang Pagsubok (1-Tap Demo Access)
          </Text>
          <Text style={[styles.demoCardSubtitle, { color: theme.textSecondary }]}>
            Pumili ng account para subukan agad ang buong app nang walang kahirap-hirap:
          </Text>

          <View style={styles.demoButtonsContainer}>
            <TouchableOpacity
              style={[styles.demoButton, { backgroundColor: '#7a1f2b' }]}
              onPress={() => handleDemoAccess('student')}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="school-outline" size={20} color="#FFFFFF" style={styles.demoIcon} />
              <View style={styles.demoTextWrap}>
                <Text style={styles.demoButtonLabel}>Estudyante (Maria Santos)</Text>
                <Text style={styles.demoButtonSublabel}>Mag-post, mag-claim, at leaderboard</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoButton, { backgroundColor: '#1E293B' }]}
              onPress={() => handleDemoAccess('admin')}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" style={styles.demoIcon} />
              <View style={styles.demoTextWrap}>
                <Text style={styles.demoButtonLabel}>Campus Administrator</Text>
                <Text style={styles.demoButtonSublabel}>Admin dashboard at verifications</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Traditional Credentials Login Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardHeader, { color: theme.text }]}>Mag-login gamit ang Account</Text>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.error} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="maria@marsu.edu.ph"
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
            placeholder="Ipasok ang password (default: password123)"
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
              <Text style={styles.buttonText}>Mag-login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Wala ka pang account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.primary }]}>Mag-rehistro rito</Text>
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
    paddingTop: Spacing.xl * 1.5,
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  tagline: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  demoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  demoCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoCardSubtitle: {
    fontSize: FontSize.xs,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  demoButtonsContainer: {
    gap: Spacing.xs,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  demoIcon: {
    marginRight: Spacing.sm,
  },
  demoTextWrap: {
    flex: 1,
  },
  demoButtonLabel: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  demoButtonSublabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  button: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.sm,
  },
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
