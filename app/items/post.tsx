import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
  SENSITIVE_CATEGORIES,
  CATEGORY_ICONS,
  type ItemCategory,
  type CampusLocation,
} from '@/constants/categories';
import { createItemPost } from '@/services/items';
import { uploadItemPhoto } from '@/services/storage';
import { supabase } from '@/lib/supabase';
import type { ItemType } from '@/types/database';

export default function PostItemScreen() {
  const theme = useTheme();

  // Form Fields
  const [itemType, setItemType] = useState<ItemType>('found');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Phone/Gadgets');
  const [location, setLocation] = useState<CampusLocation>('Library');
  const [dateHappened, setDateHappened] = useState(new Date().toISOString().split('T')[0]);

  // Image Upload State
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Found Post Specific Verification Fields
  const [hasSecretQuestion, setHasSecretQuestion] = useState(false);
  const [secretQuestion, setSecretQuestion] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [privateDetails, setPrivateDetails] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSensitive = SENSITIVE_CATEGORIES.includes(category);

  // If user switches to a sensitive category, clear any chosen photo
  const handleCategorySelect = (selected: ItemCategory) => {
    setCategory(selected);
    if (SENSITIVE_CATEGORIES.includes(selected)) {
      setSelectedImageUri(null);
    }
  };

  const handlePickImage = async () => {
    if (isSensitive) {
      Alert.alert(
        'Protektadong Kategorya',
        `Bawal ang pag-upload ng larawan para sa ${category} upang maprotektahan ang pagkakakilanlan ng gamit.`
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Pahintulot', 'Kinakailangan ang pahintulot upang makapili ng larawan.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Nagka-aberya', 'Hindi napili ang larawan.');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Pakilagay ang pamagat ng gamit.');
      return;
    }
    if (!description.trim()) {
      setError('Pakilagay ang deskripsyon ng gamit.');
      return;
    }
    if (hasSecretQuestion && itemType === 'found') {
      if (!secretQuestion.trim() || !secretAnswer.trim()) {
        setError('Pakikumpleto ang lihim na tanong at tamang sagot.');
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kailangang naka-sign in upang mag-post.');

      // 1. Upload photo if selected and allowed
      let photoPath: string | null = null;
      if (selectedImageUri && !isSensitive) {
        photoPath = await uploadItemPhoto(user.id, selectedImageUri, category);
      }

      // 2. Prepare secret questions if enabled
      let secretQuestionsList: Array<{ question: string; answerHmac: string }> | undefined;
      if (hasSecretQuestion && itemType === 'found' && secretQuestion.trim() && secretAnswer.trim()) {
        // Hash the answer for storage
        const answerHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          secretAnswer.trim().toLowerCase()
        );
        secretQuestionsList = [
          {
            question: secretQuestion.trim(),
            answerHmac: answerHash,
          },
        ];
      }

      // 3. Create Item Post
      const created = await createItemPost({
        type: itemType,
        title: title.trim(),
        description: description.trim(),
        category,
        location,
        dateHappened,
        photoPath,
        privateDetails: privateDetails.trim() || undefined,
        secretQuestions: secretQuestionsList,
      });

      Alert.alert(
        'Matagumpay na Na-post!',
        itemType === 'found'
          ? 'Nai-report ang nahanap na gamit! Makakatanggap ka ng abiso kung may makatugmang nawawalang gamit.'
          : 'Nai-report ang nawalang gamit. Aabisuhan ka kapag may nakatugmang gamit.',
        [
          {
            text: 'Tingnan ang Post',
            onPress: () => router.replace({ pathname: '/items/[id]', params: { id: created.id } }),
          },
        ]
      );
    } catch (err: any) {
      console.error('Post creation error:', err);
      setError(err?.message || 'Nagka-aberya sa pag-post. Pakisubukang muli.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: itemType === 'found' ? 'Mag-report ng Nahanap' : 'Mag-report ng Nawala',
          headerShown: true,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.headerText,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Type Toggle: Nahanap (Found) vs Nawala (Lost) */}
        <View style={[styles.toggleContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              itemType === 'found' && { backgroundColor: '#1E5B32' },
            ]}
            onPress={() => setItemType('found')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: itemType === 'found' ? '#ffffff' : theme.textSecondary },
              ]}
            >
              ✨ Nahanap Ko (Found)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              itemType === 'lost' && { backgroundColor: theme.primary },
            ]}
            onPress={() => setItemType('lost')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: itemType === 'lost' ? '#ffffff' : theme.textSecondary },
              ]}
            >
              🔍 Nawala Sa Akin (Lost)
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.error + '18' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Category Selector */}
          <Text style={[styles.label, { color: theme.text }]}>Kategorya ng Gamit *</Text>
          <View style={styles.categoryGrid}>
            {ITEM_CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary + '14' : theme.background,
                    },
                  ]}
                  onPress={() => handleCategorySelect(cat)}
                >
                  <Text style={styles.categoryItemIcon}>{CATEGORY_ICONS[cat]}</Text>
                  <Text
                    style={[
                      styles.categoryItemText,
                      { color: isSelected ? theme.primary : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sensitive Category Notice */}
          {isSensitive && (
            <View style={[styles.sensitiveNotice, { backgroundColor: '#FFF9E6', borderColor: '#E3B23C' }]}>
              <Text style={styles.sensitiveNoticeTitle}>
                ⚠️ Protektadong Kategorya ({category})
              </Text>
              <Text style={styles.sensitiveNoticeBody}>
                Bawal mag-upload ng larawan para sa kategoryang ito. Ang gamit ay dadalhin sa
                Campus Lost & Found Office upang maprotektahan ang may-ari.
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>
            Pangalan o Pamagat ng Gamit *
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
            placeholder={isSensitive ? `Hal: ${category}` : 'Hal: Casio Scientific Calculator'}
            placeholderTextColor={theme.placeholder}
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>
            Deskripsyon at Katangian *
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
            placeholder="Ilarawan ang kulay, modelo, at palatandaan..."
            placeholderTextColor={theme.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {/* Location */}
          <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>
            Lokasyon sa Campus *
          </Text>
          <View style={styles.locationGrid}>
            {CAMPUS_LOCATIONS.map((loc) => {
              const isSelected = location === loc;
              return (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.locationChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary + '14' : theme.background,
                    },
                  ]}
                  onPress={() => setLocation(loc)}
                >
                  <Text
                    style={[
                      styles.locationChipText,
                      { color: isSelected ? theme.primary : theme.text },
                    ]}
                  >
                    📍 {loc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Date */}
          <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>
            Petsa Nangyari (YYYY-MM-DD) *
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
            value={dateHappened}
            onChangeText={setDateHappened}
            placeholder="2026-10-11"
            placeholderTextColor={theme.placeholder}
          />

          {/* Photo Upload (Only if non-sensitive) */}
          {!isSensitive && (
            <View style={{ marginTop: Spacing.md }}>
              <Text style={[styles.label, { color: theme.text }]}>Larawan ng Gamit (Opsyonal)</Text>
              {selectedImageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImageUri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setSelectedImageUri(null)}
                  >
                    <Text style={styles.removeImageText}>✕ Tanggalin</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.uploadBox,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.inputBackground,
                    },
                  ]}
                  onPress={handlePickImage}
                >
                  <Text style={styles.uploadIcon}>📷</Text>
                  <Text style={[styles.uploadText, { color: theme.primary }]}>
                    Pumili ng Larawan mula sa Gallery
                  </Text>
                  <Text style={[styles.uploadSubtext, { color: theme.textSecondary }]}>
                    Awtomatikong ire-resize at tatanggalin ang EXIF GPS metadata
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Found Post Extra Verification Options */}
          {itemType === 'found' && (
            <View style={styles.foundExtras}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setHasSecretQuestion(!hasSecretQuestion)}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: theme.primary },
                    hasSecretQuestion && { backgroundColor: theme.primary },
                  ]}
                >
                  {hasSecretQuestion && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                  Magdagdag ng Lihim na Tanong para sa Pag-verify
                </Text>
              </TouchableOpacity>

              {hasSecretQuestion && (
                <View style={[styles.secretBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <Text style={[styles.label, { color: theme.text }]}>Lihim na Tanong</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
                    placeholder="Hal: Ano ang nakasulat sa likod ng keychain?"
                    placeholderTextColor={theme.placeholder}
                    value={secretQuestion}
                    onChangeText={setSecretQuestion}
                  />

                  <Text style={[styles.label, { color: theme.text, marginTop: Spacing.sm }]}>Tamang Sagot</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
                    placeholder="Hal: Campus 2026"
                    placeholderTextColor={theme.placeholder}
                    value={secretAnswer}
                    onChangeText={setSecretAnswer}
                  />
                  <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                    Ang sagot ay ise-save bilang hash at hindi makikita ng claimant.
                  </Text>
                </View>
              )}

              {/* Private Details */}
              <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>
                Pribadong Detalye (Ikaw at Admin lang ang makakakita)
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
                placeholder="Hal: eksaktong halaga o serial number..."
                placeholderTextColor={theme.placeholder}
                value={privateDetails}
                onChangeText={setPrivateDetails}
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: itemType === 'found' ? '#1E5B32' : theme.primary },
              isSubmitting && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {itemType === 'found' ? 'I-post ang Nahanap na Gamit' : 'I-post ang Nawalang Gamit'}
              </Text>
            )}
          </TouchableOpacity>
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
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  toggleButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
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
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  categoryItemIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  categoryItemText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sensitiveNotice: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginVertical: Spacing.sm,
  },
  sensitiveNoticeTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#8F6600',
    marginBottom: 2,
  },
  sensitiveNoticeBody: {
    fontSize: 11,
    color: '#614600',
    lineHeight: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },
  multilineInput: {
    height: 96,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top',
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  locationChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  locationChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  uploadText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  uploadSubtext: {
    fontSize: 10,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  removeImageBtn: {
    padding: Spacing.xs,
  },
  removeImageText: {
    color: '#DC3545',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  foundExtras: {
    marginTop: Spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  checkboxLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  secretBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  helperText: {
    fontSize: 10,
    marginTop: 4,
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
