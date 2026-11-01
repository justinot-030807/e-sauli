import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { fetchItemDetail } from '@/services/items';
import { raiseDispute } from '@/services/returns';
import type { Item } from '@/types/database';
import { LoadingView, ErrorView } from '@/components/StateViews';

const DISPUTE_REASONS = [
  'Hindi ko natanggap ang gamit',
  'Ibang gamit ang ibinigay o hindi tumutugma',
  'May pinsala o nawawalang bahagi ang gamit',
  'Humingi ng kabayaran o gantimpala ang nag-sauli',
  'Iba pang dahilan',
];

export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReason, setSelectedReason] = useState(DISPUTE_REASONS[0]);
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchItemDetail(id);
      if (!data || !data.item) {
        setError('Hindi nahanap ang item.');
        return;
      }
      setItem(data.item);
    } catch (err: any) {
      setError(err.message || 'Nabigong i-load ang mga detalye ng item.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!id) return;

    if (!explanation.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Mangyaring magbigay ng maikling paliwanag ukol sa iyong dispute.');
      return;
    }

    const fullReason = `${selectedReason}: ${explanation.trim()}`;

    Alert.alert(
      'Kumpirmahin ang Pagsumite ng Dispute',
      'Ang paghahain ng dispute ay magpapahinto sa awtomatikong kumpirmasyon ng item at aabisuhan ang mga administrator para sa pagsusuri. Sigurado ka ba?',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Oo, Isumite',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await raiseDispute(id, fullReason);
              Alert.alert(
                'Dispute Naitala',
                'Matagumpay na naitala ang iyong dispute. Aabisuhan ang administrasyon ng Lost & Found upang repasuhin ang insidente.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)'),
                  },
                ]
              );
            } catch (err: any) {
              Alert.alert('May Error', err.message || 'Nabigong isumite ang dispute.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <LoadingView message="Kinukuha ang impormasyon..." />;
  }

  if (error || !item) {
    return <ErrorView message={error || 'Hindi nahanap ang item.'} onRetry={loadItem} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Maghain ng Dispute',
          headerStyle: { backgroundColor: '#7B1123' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* Warning Alert Card */}
      <View style={styles.warningCard}>
        
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>Proteksyon ng Mag-aaral</Text>
          <Text style={styles.warningDescription}>
            Kapag naghain ka ng dispute, pansamantalang ihihinto ang auto-confirmation ng pagsauli at ipapasa sa administrasyon para sa masusing imbestigasyon.
          </Text>
        </View>
      </View>

      {/* Target Item Summary */}
      <View style={styles.itemCard}>
        <Text style={styles.itemLabel}>Item na may Dispute:</Text>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemCategory}>{item.category} • {item.location}</Text>
      </View>

      {/* Reason Selection */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Pangunahing Dahilan</Text>
        {DISPUTE_REASONS.map((reason) => {
          const isSelected = selectedReason === reason;
          return (
            <TouchableOpacity
              key={reason}
              style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
              onPress={() => setSelectedReason(reason)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>{isSelected ? '[x]' : '[ ]'}</Text>
              <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                {reason}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detailed Explanation */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Karagdagang Detalye at Paliwanag</Text>
        <Text style={styles.helperText}>
          Ilarawan kung ano ang nangyari upang matulungan ang admin sa patas na pagsusuri.
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Ibahagi ang kumpletong impormasyon tungkol sa insidente..."
          placeholderTextColor="#999"
          value={explanation}
          onChangeText={setExplanation}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{explanation.length}/500</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.disabledButton]}
        onPress={handleSubmitDispute}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            
            <Text style={styles.submitButtonText}>Isumite ang Dispute sa Admin</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 4,
  },
  warningDescription: {
    fontSize: 13,
    color: '#491217',
    lineHeight: 18,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    marginBottom: 16,
  },
  itemLabel: {
    fontSize: 12,
    color: '#6B5A5E',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1E20',
  },
  itemCategory: {
    fontSize: 13,
    color: '#6B5A5E',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1E20',
    marginBottom: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 10,
  },
  reasonOptionSelected: {
    backgroundColor: '#F8EBEB',
  },
  reasonText: {
    fontSize: 14,
    color: '#2A1E20',
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: '600',
    color: '#7B1123',
  },
  helperText: {
    fontSize: 13,
    color: '#6B5A5E',
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: '#FBF8F3',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#2A1E20',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#C62828',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
