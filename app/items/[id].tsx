import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CATEGORY_ICONS, type ItemCategory } from '@/constants/categories';
import { fetchItemDetail, type ItemDetailResponse } from '@/services/items';
import { supabase } from '@/lib/supabase';
import { LoadingView, ErrorView } from '@/components/StateViews';
import type { ReportReason } from '@/types/database';

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<ItemDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchItemDetail(id);
      setDetail(res);
    } catch (err: any) {
      console.error('Error loading item detail:', err);
      setError(err?.message || 'Hindi maikarga ang impormasyon ng gamit.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleReportSubmit = async () => {
    if (!id || !detail) return;
    try {
      setIsSubmittingReport(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Puna', 'Kailangang naka-sign in upang mag-ulat.');
        return;
      }

      const { error: reportError } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: 'item',
        target_id: id,
        reason: reportReason,
      });

      if (reportError) {
        if (reportError.message.includes('unique') || reportError.code === '23505') {
          Alert.alert('Puna', 'Naiulat mo na ang gamit na ito dati.');
        } else {
          Alert.alert('Nagka-aberya', reportError.message);
        }
      } else {
        Alert.alert(
          'Salamat sa Pag-ulat',
          'Naitala ang iyong ulat at susuriin ito ng administrator ng Lost & Found office.'
        );
        setShowReportModal(false);
      }
    } catch (err: any) {
      Alert.alert('Nagka-aberya', err?.message || 'Hindi naisumite ang ulat.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Detalye ng Item', headerShown: true }} />
        <LoadingView message="Kinakarga ang detalye ng gamit..." />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Detalye ng Item', headerShown: true }} />
        <ErrorView message={error || 'Hindi natagpuan ang item.'} onRetry={loadDetail} />
      </View>
    );
  }

  const { item, officeSettings, isOwner } = detail;
  const isLost = item.type === 'lost';
  const categoryIcon = CATEGORY_ICONS[item.category as ItemCategory] || '📦';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: item.title,
          headerShown: true,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.headerText,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              style={styles.headerRightBtn}
            >
              <Text style={styles.headerRightIcon}>🚩</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Photo or Category Graphic */}
        <View
          style={[
            styles.imageWrapper,
            { backgroundColor: isLost ? '#FBEBEB' : '#EAF7EE' },
          ]}
        >
          {item.signedPhotoUrl ? (
            <Image
              source={{ uri: item.signedPhotoUrl }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderEmoji}>{categoryIcon}</Text>
              {item.requires_office_pickup && (
                <Text style={[styles.placeholderNotice, { color: theme.textSecondary }]}>
                  Protektado ang larawan ng kategoryang ito para sa seguridad.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Title & Badges */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isLost ? '#7B1E2B18' : '#1E5B3218' },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: isLost ? '#A83246' : '#1E5B32' },
                ]}
              >
                {isLost ? 'NAWALA' : 'NAHANAP'}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: theme.primary + '14' }]}>
              <Text style={[styles.statusBadgeText, { color: theme.primary }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
            {item.description}
          </Text>
        </View>

        {/* Sensitive Item / Office Handover Notice */}
        {item.requires_office_pickup && (
          <View
            style={[
              styles.officeCard,
              { backgroundColor: '#FFF9E6', borderColor: '#E3B23C' },
            ]}
          >
            <Text style={styles.officeCardTitle}>🏢 Sa Opisina Lamang Kukunin</Text>
            <Text style={styles.officeCardBody}>
              Dahil ito ay sensitibong gamit ({item.category}), kailangan itong kunin nang
              personal sa MarSU Lost & Found Office upang maiwasan ang maling pag-claim.
            </Text>
            {officeSettings && (
              <View style={styles.officeHoursBox}>
                <Text style={styles.officeHoursTitle}>📍 {officeSettings.office_name}</Text>
                <Text style={styles.officeHoursText}>
                  🕒 {officeSettings.open_time} - {officeSettings.close_time} (
                  {officeSettings.open_days.join(', ')})
                </Text>
                {officeSettings.location_note && (
                  <Text style={styles.officeHoursText}>
                    🏢 {officeSettings.location_note}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Information Grid */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeader, { color: theme.text }]}>Impormasyon ng Gamit</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Kategorya</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {categoryIcon} {item.category}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Lokasyon sa Campus</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>📍 {item.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Petsa</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>📅 {item.date_happened}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Nag-post</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              👤 {item.posterNickname} ({item.posterCollege})
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {isOwner ? (
            <View style={[styles.ownerBadge, { backgroundColor: theme.accent + '25' }]}>
              <Text style={[styles.ownerBadgeText, { color: '#8F6600' }]}>
                ⭐ Ikaw ang nag-post ng gamit na ito
              </Text>
            </View>
          ) : isLost ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                Alert.alert(
                  'Nahanap Mo Ba Ito?',
                  'Makikipag-ugnayan ka sa may-ari ng post sa Phase 4 (Chat & Claims).'
                );
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>🤝 Nahanap Ko Ito</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: '#1E5B32' }]}
              onPress={() => {
                Alert.alert(
                  'Pag-claim ng Item',
                  'Ang proseso ng verification at secret question claim ay magsisimula sa Phase 4.'
                );
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>✨ I-claim ang Gamit</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={[styles.reportModalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.reportModalTitle, { color: theme.text }]}>I-ulat ang Post</Text>
            <Text style={[styles.reportModalSubtitle, { color: theme.textSecondary }]}>
              Pumili ng dahilan kung bakit hindi angkop ang post na ito:
            </Text>

            {(['spam', 'fake', 'inappropriate', 'scam'] as ReportReason[]).map((reason) => {
              const isSelected = reportReason === reason;
              const labels: Record<ReportReason, string> = {
                spam: 'Spam o paulit-ulit na post',
                fake: 'Pekeng post o hindi totoo',
                inappropriate: 'Hindi angkop na salita o larawan',
                scam: 'Maling claim o panlilinlang',
              };
              return (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportOption,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary + '10' : theme.background,
                    },
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text
                    style={[
                      styles.reportOptionText,
                      { color: isSelected ? theme.primary : theme.text },
                    ]}
                  >
                    {labels[reason]}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.reportBtnRow}>
              <TouchableOpacity
                style={[styles.reportCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowReportModal(false)}
                disabled={isSubmittingReport}
              >
                <Text style={[styles.reportCancelBtnText, { color: theme.text }]}>Kanselahin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportSubmitBtn, { backgroundColor: theme.error }]}
                onPress={handleReportSubmit}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.reportSubmitBtnText}>Ipadala ang Ulat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRightBtn: {
    marginRight: Spacing.md,
    padding: 6,
  },
  headerRightIcon: {
    fontSize: 18,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  imageWrapper: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  placeholderNotice: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    maxWidth: 240,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  itemDescription: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  officeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  officeCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#8F6600',
    marginBottom: Spacing.xs,
  },
  officeCardBody: {
    fontSize: FontSize.sm,
    color: '#614600',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  officeHoursBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  officeHoursTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#2A1A1D',
    marginBottom: 4,
  },
  officeHoursText: {
    fontSize: FontSize.xs,
    color: '#555555',
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0D5D740',
  },
  infoLabel: {
    fontSize: FontSize.sm,
  },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: Spacing.sm,
  },
  ownerBadge: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ownerBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  reportModalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  reportModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  reportModalSubtitle: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  reportOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  reportOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  reportBtnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  reportCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportCancelBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  reportSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportSubmitBtnText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
