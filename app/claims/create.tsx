import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { fetchItemDetail, type ItemWithMeta } from '@/services/items';
import { submitClaim } from '@/services/claims';
import { CATEGORY_ICONS, type ItemCategory } from '@/constants/categories';
import { LoadingView, ErrorView } from '@/components/StateViews';

export default function CreateClaimScreen() {
  const theme = useTheme();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const [item, setItem] = useState<ItemWithMeta | null>(null);
  const [questions, setQuestions] = useState<{ id: string; question: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [proofText, setProofText] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const submitting = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadItem = useCallback(async () => {
    if (!itemId) {
      setError('Walang napiling gamit.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchItemDetail(itemId);
      setItem(result.item);
      setQuestions(result.secretQuestions ?? []);
    } catch {
      setError('Hindi maikarga ang impormasyon ng gamit.');
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void loadItem(); });
    return () => cancelAnimationFrame(frame);
  }, [loadItem]);

  const handleSubmit = async () => {
    if (!itemId || submitting.current) return;
    if (!proofText.trim()) {
      setSubmitError('Pakibigay ang patunay ng pagmamay-ari.');
      return;
    }
    if (questions.length && !secretAnswer.trim()) {
      setSubmitError('Pakisagutan ang lihim na tanong.');
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const claim = await submitClaim({ itemId, proofText, secretAnswer });
      router.replace({ pathname: '/claims/[id]', params: { id: claim.id } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Hindi naisumite ang claim. Pakisubukang muli.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Pag-claim ng Gamit', headerShown: true }} />
        <LoadingView message="Inihahanda ang form ng claim..." />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Pag-claim ng Gamit', headerShown: true }} />
        <ErrorView message={error || 'Hindi natagpuan ang item.'} onRetry={itemId ? loadItem : undefined} />
      </View>
    );
  }

  const officePickup = item.requires_office_pickup;
  const categoryIcon = CATEGORY_ICONS[item.category as ItemCategory] || 'cube-outline';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'I-claim ang Gamit',
          headerShown: true,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.headerText,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Item Summary Header Card */}
        <View style={[styles.itemSummaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name={categoryIcon} size={28} color={theme.textSecondary} />
          <View style={styles.summaryDetails}>
            <Text style={[styles.summaryTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
              {item.location} • {item.date_happened}
            </Text>
          </View>
        </View>

        {questions.length > 0 && (
          <View style={[styles.warningBox, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
            <Text style={[styles.warningTitle, { color: theme.text }]}>Tatlong pagsubok sa lihim na tanong</Text>
            <Text style={[styles.warningText, { color: theme.textSecondary }]}>
              Makipag-ugnayan sa Lost &amp; Found Office kung ma-lock ang verification.
            </Text>
          </View>
        )}

        {officePickup && (
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            Sa Lost &amp; Found Office susuriin ang patunay ng pagmamay-ari. Ibigay doon ang mga sensitibong detalye.
          </Text>
        )}

        {/* Verification Section: Secret Questions */}
        {questions.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lihim na Tanong ng Nag-post *</Text>
            <Text style={[styles.questionText, { color: theme.primary }]}>
              Tanong: {questions[0].question}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Ilagay ang iyong sagot..."
              placeholderTextColor={theme.placeholder}
              value={secretAnswer}
              onChangeText={setSecretAnswer}
            />
          </View>
        )}

        {/* Proof of Ownership Description */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Deskripsyon at Patunay ng Pagmamay-ari *
          </Text>
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            Magbigay ng mga partikular na palatandaan (kulay, gasgas, tatak, sticker, o mga laman)
            na makakapagpatunay na sa iyo nga ito.
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.multilineInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Hal: May maliit na pulang sticker sa likod, at may keychain na hugis..."
            placeholderTextColor={theme.placeholder}
            value={proofText}
            onChangeText={setProofText}
            multiline
            numberOfLines={5}
          />
        </View>

        {/* Submit Button */}
        {submitError && <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{submitError}</Text>}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: '#1E5B32' },
            isSubmitting && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Isumite ang Claim</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  itemSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  summaryEmoji: {
    fontSize: 36,
  },
  summaryDetails: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryMeta: {
    fontSize: FontSize.xs,
  },
  warningBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  warningTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#8F6600',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 11,
    color: '#614600',
    lineHeight: 16,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  hintText: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  questionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },
  multilineInput: {
    height: 110,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
