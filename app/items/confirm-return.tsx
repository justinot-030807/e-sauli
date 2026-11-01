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
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { fetchItemDetail } from '@/services/items';
import { confirmReturn, ConfirmReturnResult } from '@/services/returns';
import type { Item } from '@/types/database';
import { LoadingView, ErrorView } from '@/components/StateViews';

export default function ConfirmReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [thankYouNote, setThankYouNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Success Celebration Modal
  const [result, setResult] = useState<ConfirmReturnResult | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  const handleConfirmReceipt = async () => {
    if (!id) return;

    Alert.alert(
      'Kumpirmahin ang Pagkakatanggap',
      'Sigurado ka bang natanggap mo na nang maayos ang iyong gamit? Hindi na ito mababawi kapag nakumpirma na.',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Oo, Natanggap Ko Na',
          style: 'default',
          onPress: async () => {
            try {
              setSubmitting(true);
              const res = await confirmReturn(id, thankYouNote);
              setResult(res);
              setShowModal(true);
            } catch (err: any) {
              Alert.alert('May Error', err.message || 'Nabigong kumpirmahin ang pagbabalik.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleFinish = () => {
    setShowModal(false);
    router.replace('/(tabs)');
  };

  const navigateToDispute = () => {
    if (!id) return;
    router.push({
      pathname: '/items/dispute',
      params: { id },
    });
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
          title: 'Kumpirmahin ang Pagsauli',
          headerStyle: { backgroundColor: '#7B1123' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          
        </View>
        <Text style={styles.headerTitle}>Natanggap mo na ba ang iyong gamit?</Text>
        <Text style={styles.headerSubtitle}>
          Pakikumpirma kung naisauli na nang maayos sa iyo ang gamit. Makakatanggap ka ng +5 Aura points sa pagkumpirma!
        </Text>
      </View>

      {/* Item Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Detalye ng Item</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Pangalan:</Text>
          <Text style={styles.value}>{item.title}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Kategorya:</Text>
          <Text style={styles.value}>{item.category}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lokasyon:</Text>
          <Text style={styles.value}>{item.location}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Petsa:</Text>
          <Text style={styles.value}>{item.date_happened}</Text>
        </View>
      </View>

      {/* Thank You Note Input */}
      <View style={styles.formCard}>
        <View style={styles.noteHeader}>
          
          <Text style={styles.sectionTitle}>Mensahe ng Pasasalamat (Opsyonal)</Text>
        </View>
        <Text style={styles.helperText}>
          Mag-iwan ng pasasalamat para sa nag-sauli ng iyong gamit. Makakatanggap sila ng karagdagang +5 Aura points!
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Halimbawa: Maraming salamat sa iyong katapatan at pag-aalaga sa aking gamit!"
          placeholderTextColor="#999"
          value={thankYouNote}
          onChangeText={setThankYouNote}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={300}
        />
        <Text style={styles.charCount}>{thankYouNote.length}/300</Text>
      </View>

      {/* Primary Confirmation Action */}
      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.disabledButton]}
        onPress={handleConfirmReceipt}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#3A0C14" />
        ) : (
          <>
            
            <Text style={styles.primaryButtonText}>Kumpirmahin ang Pagkakatanggap</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Dispute Link Action */}
      <TouchableOpacity
        style={styles.disputeButton}
        onPress={navigateToDispute}
        activeOpacity={0.7}
      >
        
        <Text style={styles.disputeButtonText}>May problema ba? Maghain ng Dispute</Text>
      </TouchableOpacity>

      {/* Celebration Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleFinish}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.celebrationBadge}>
              
            </View>

            <Text style={styles.modalTitle}>Matagumpay na Naisauli!</Text>
            <Text style={styles.modalSubtitle}>
              Salamat sa pagiging tapat na miyembro ng ating komunidad.
            </Text>

            {/* Points Breakdown */}
            <View style={styles.pointsBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Iyong Bonus (Pagkumpirma):</Text>
                <Text style={styles.breakdownValue}>+{result?.ownerBonus || 5} Pts</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Base Points para sa Nag-sauli:</Text>
                <Text style={styles.breakdownValue}>+{result?.basePoints || 50} Pts</Text>
              </View>

              {(result?.speedyBonus || 0) > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>⚡ Speedy Bonus (&lt;24 oras):</Text>
                  <Text style={styles.breakdownValue}>+{result?.speedyBonus} Pts</Text>
                </View>
              )}

              {(result?.thankYouBonus || 0) > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Thank You Note Bonus:</Text>
                  <Text style={styles.breakdownValue}>+{result?.thankYouBonus} Pts</Text>
                </View>
              )}

              {result?.isPairLimitExceeded && (
                <Text style={styles.limitExceededNote}>
                  Paalala: Naabot na ang buwanang limit na 2 pagbabalik para sa pares na ito.
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleFinish}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Bumalik sa Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerCard: {
    backgroundColor: '#7B1123',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#F4E7D7',
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1E20',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE1',
  },
  label: {
    fontSize: 14,
    color: '#6B5A5E',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A1E20',
    maxWidth: '60%',
    textAlign: 'right',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#6B5A5E',
    marginBottom: 12,
    lineHeight: 18,
  },
  textArea: {
    backgroundColor: '#FBF8F3',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#2A1E20',
    minHeight: 90,
  },
  charCount: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'right',
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#E8B83A',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#E8B83A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3A0C14',
  },
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  disputeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  celebrationBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1E20',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B5A5E',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  pointsBreakdown: {
    width: '100%',
    backgroundColor: '#FBF8F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#2A1E20',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  divider: {
    height: 1,
    backgroundColor: '#E6DCCF',
    marginVertical: 8,
  },
  limitExceededNote: {
    fontSize: 12,
    color: '#D32F2F',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    backgroundColor: '#7B1123',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
