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
} from 'react-native';
import { Link, router } from 'expo-router';
import { signUp } from '@/services/auth';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { COLLEGES } from '@/constants/categories';

export default function RegisterScreen() {
  const theme = useTheme();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    studentId: '',
    nickname: '',
    college: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCollegePicker, setShowCollegePicker] = useState(false);

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.email.trim()) return 'Email is required.';
    if (!form.password) return 'Password is required.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!form.studentId.trim()) return 'Student ID is required.';
    if (!form.nickname.trim()) return 'Nickname is required.';
    if (!form.college) return 'Please select your college.';
    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        studentId: form.studentId.trim(),
        nickname: form.nickname.trim(),
        college: form.college,
      });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: form.email.trim() } });
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
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
          <Text style={[styles.title, { color: theme.primary }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Join the MarSU Lost & Found community
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>School Email *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="your.email@marsu.edu.ph"
            placeholderTextColor={theme.placeholder}
            value={form.email}
            onChangeText={(v) => updateForm('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>Full Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Juan Dela Cruz"
            placeholderTextColor={theme.placeholder}
            value={form.fullName}
            onChangeText={(v) => updateForm('fullName', v)}
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>Student ID *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="2024-00001"
            placeholderTextColor={theme.placeholder}
            value={form.studentId}
            onChangeText={(v) => updateForm('studentId', v)}
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>Nickname * (shown publicly)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="JD"
            placeholderTextColor={theme.placeholder}
            value={form.nickname}
            onChangeText={(v) => updateForm('nickname', v)}
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>College *</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerButton, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
            onPress={() => setShowCollegePicker(!showCollegePicker)}
            disabled={isLoading}
          >
            <Text style={{ color: form.college ? theme.text : theme.placeholder, fontSize: FontSize.md }}>
              {form.college || 'Select your college'}
            </Text>
          </TouchableOpacity>
          {showCollegePicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {COLLEGES.map((college) => (
                <TouchableOpacity
                  key={college}
                  style={[
                    styles.pickerItem,
                    form.college === college && { backgroundColor: theme.primary + '20' },
                  ]}
                  onPress={() => {
                    updateForm('college', college);
                    setShowCollegePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: theme.text }]}>{college}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>Password *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Min. 6 characters"
            placeholderTextColor={theme.placeholder}
            value={form.password}
            onChangeText={(v) => updateForm('password', v)}
            secureTextEntry
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: theme.text }]}>Confirm Password *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Re-enter your password"
            placeholderTextColor={theme.placeholder}
            value={form.confirmPassword}
            onChangeText={(v) => updateForm('confirmPassword', v)}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.primary }]}>Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800' },
  subtitle: { fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center' },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1 },
  errorBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  errorText: { fontSize: FontSize.sm, textAlign: 'center' },
  label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: { height: 48, borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
  pickerButton: { justifyContent: 'center' },
  pickerDropdown: { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: Spacing.xs, maxHeight: 200 },
  pickerItem: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  pickerItemText: { fontSize: FontSize.sm },
  button: { height: 48, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.lg },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { fontSize: FontSize.sm },
  linkText: { fontSize: FontSize.sm, fontWeight: '600' },
});
