import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  const [questions, setQuestions] = useState<Array<{ id: string; question: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [proofText, setProofText] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadItem() {
      if (!itemId) return;
      try {
        setIsLoading(true);
        const res = await fetchItemDetail(itemId);
        setItem(res.item);
        if (res.secretQuestions) {
          setQuestions(res.secretQuestions);
        }
      } catch (err: any) {
        setError(err?.message || 'Hindi maikarga ang impormasyon ng gamit.');
      } finally {
        setIsLoading(false);
      }
    }
    loadItem();
  }, [itemId]);

  const handleSubmit = async () => {
    if (!itemId) return;

    if (!proofText.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Pakibigay ang iyong patunay o deskripsyon ng gamit.');
      return;
    }

    if (item?.category === 'Cash' && !cashAmount.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Pakilagay ang eksaktong halaga ng salaping nawala sa iyo.');
      return;
    }

    if (questions.length > 0 && !secretAnswer.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Pakisagutan ang lihim na tanong upang mapatunayan ang pagmamay-ari.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newClaim = await submitClaim({
        itemId,
        proofText: proofText.trim(),
        secretAnswer: secretAnswer.trim() || undefined,
        cashAmount: cashAmount.trim() || undefined,
      });

      Alert.alert(
        'Naisumite ang Claim!',
        'Matagumpay na naitala ang iyong claim. Aabisuhan ang nag-post upang suriin ito.',
        [
          {
            text: 'Tingnan ang Claim',
            onPress: () =>
              router.replace({
                pathname: '/claims/[id]',
                params: { id: newClaim.id },
              }),
          },
        ]
      );
    } catch (err: any) {
      console.error('Claim submission failed:', err);
      Alert.alert('Pagkabigo sa Pag-claim', err?.message || 'Hindi naisumite ang claim.');
    } finally {
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
        <ErrorView message={error || 'Hindi natagpuan ang item.'} />
      </View>
    );
  }

  const isCash = item.category === 'Cash';
  const categoryIcon = CATEGORY_ICONS[item.category as ItemCategory] || '📦';

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
          <Text style={styles.summaryEmoji}>{categoryIcon}</Text>
          <View style={styles.summaryDetails}>
            <Text style={[styles.summaryTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
              📍 {item.location} • 📅 {item.date_happened}
            </Text>
          </View>
        </View>

        {/* Lockout Warning Banner */}
        <View style={[styles.warningBox, { backgroundColor: '#FFF9E6', borderColor: '#E3B23C' }]}>
          <Text style={styles.warningTitle}>⚠️ Paalala sa Pag-verify (3 Pagsubok)</Text>
          <Text style={styles.warningText}>
            Upang maiwasan ang panlilinlang, mayroon kang hanggang 3 pagsubok lamang upang sagutan
            ang mga verification tanong. Kapag nagkamali ng tatlong beses, mai-lock ang automated verification.
          </Text>
        </View>

        {/* Verification Section: Cash Amount */}
        {isCash && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Eksaktong Halaga ng Pera *</Text>
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>
              Ilagay ang eksaktong halaga (halimbawa: 500 o 1250).
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
              placeholder="Hal: 500"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
              value={cashAmount}
              onChangeText={setCashAmount}
            />
          </View>
        )}

        {/* Verification Section: Secret Questions */}
        {questions.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lihim na Tanong ng Nag-post *</Text>
            <Text style={[styles.questionText, { color: theme.primary }]}>
              ❓ {questions[0].question}
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
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: '#1E5B32' },
            isSubmitting && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
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
