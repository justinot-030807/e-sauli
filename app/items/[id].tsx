import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { initiateLostItemContact, fetchClaimsForItem, type ClaimWithMeta } from '@/services/claims';
import { supabase } from '@/lib/supabase';
import { LoadingView, ErrorView } from '@/components/StateViews';
import type { ReportReason } from '@/types/database';
import { markItemAsReturned, getOfficeStatus, type OfficeStatusResult } from '@/services/returns';

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<ItemDetailResponse | null>(null);
  const [existingClaims, setExistingClaims] = useState<ClaimWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User & Office Role States
  const [currentUser, setCurrentUser] = useState<{ id: string; role: 'student' | 'admin' } | null>(null);
  const [approvedClaimantId, setApprovedClaimantId] = useState<string | null>(null);
  const [officeStatus, setOfficeStatus] = useState<OfficeStatusResult | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Contact Modal States (for Lost posts)
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

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

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setCurrentUser({ id: user.id, role: profile?.role || 'student' });
      }

      // Check if item has an approved claim
      const { data: approvedClaim } = await supabase
        .from('claims')
        .select('claimant_id')
        .eq('item_id', id)
        .eq('status', 'approved')
        .maybeSingle();
      setApprovedClaimantId(approvedClaim?.claimant_id || null);

      if (res.item.requires_office_pickup) {
        const off = await getOfficeStatus();
        setOfficeStatus(off);
      }

      if (res.isOwner) {
        const claims = await fetchClaimsForItem(id);
        setExistingClaims(claims);
      }
    } catch (err: any) {
      console.error('Error loading item detail:', err);
      setError(err?.message || 'Hindi maikarga ang impormasyon ng gamit.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const handleMarkAsReturned = async () => {
    if (!id || !detail) return;
    Alert.alert(
      'Markahan bilang Naisauli / Released',
      'Sigurado ka bang naibigay o naisauli na ang gamit? Aabisuhan ang may-ari upang kumpirmahin ang pagkakatanggap sa loob ng 7 araw.',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Oo, Nai-release Na',
          onPress: async () => {
            try {
              setIsActionLoading(true);
              await markItemAsReturned(id);
              Alert.alert('Nai-release Na', 'Matagumpay na minarkahan ang item bilang released.');
              loadDetail();
            } catch (err: any) {
              Alert.alert('May Error', err?.message || 'Nabigong markahan ang item.');
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

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
              personal sa Campus Lost & Found Office upang maiwasan ang maling pag-claim.
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
          {item.status === 'returned' ? (
            <View style={[styles.statusCard, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 6 }}>🎉</Text>
              <Text style={[styles.statusCardTitle, { color: '#2E7D32', textAlign: 'center' }]}>
                Matagumpay na Naisauli (Returned)
              </Text>
              <Text style={[styles.statusCardBody, { color: '#1B5E20', textAlign: 'center' }]}>
                Ang gamit na ito ay matagumpay nang naibalik sa verified na may-ari.
              </Text>
            </View>
          ) : item.status === 'expired' ? (
            <View style={[styles.statusCard, { backgroundColor: '#F5F5F5', borderColor: '#9E9E9E' }]}>
              <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 4 }}>⌛</Text>
              <Text style={[styles.statusCardTitle, { color: '#616161', textAlign: 'center' }]}>
                Nag-expire na ang Post
              </Text>
              <Text style={[styles.statusCardBody, { color: '#757575', textAlign: 'center' }]}>
                {item.type === 'found'
                  ? 'Inilipat na sa pangangalaga ng Lost & Found Office.'
                  : 'Inilagay na sa archive ang post na ito.'}
              </Text>
            </View>
          ) : item.status === 'released' ? (
            <View>
              <View style={[styles.statusCard, { backgroundColor: '#FFF8E1', borderColor: '#FFA000', marginBottom: 12 }]}>
                <Text style={[styles.statusCardTitle, { color: '#E65100' }]}>⏳ Nai-release Na ang Gamit</Text>
                <Text style={[styles.statusCardBody, { color: '#BF360C' }]}>
                  Naghihintay ng kumpirmasyon ng may-ari sa loob ng 7 araw bago ito awtomatikong mag-confirm.
                </Text>
              </View>

              {currentUser?.id === approvedClaimantId || (isLost && isOwner) ? (
                <View>
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#E8B83A' }]}
                    onPress={() => router.push({ pathname: '/items/confirm-return', params: { id: item.id } })}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.primaryActionBtnText, { color: '#3A0C14' }]}>
                      ✨ Kumpirmahin ang Pagkakatanggap (+5 Pts)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
                    onPress={() => router.push({ pathname: '/items/dispute', params: { id: item.id } })}
                  >
                    <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 14 }}>
                      ⚠️ May problema ba? Maghain ng Dispute
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : isOwner ? (
                <View style={[styles.ownerBadge, { backgroundColor: theme.accent + '25' }]}>
                  <Text style={[styles.ownerBadgeText, { color: '#8F6600' }]}>
                    ⭐ Nai-release mo na ang gamit. Naghihintay ng kumpirmasyon mula sa may-ari.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : item.status === 'verified' ? (
            <View>
              <View style={[styles.statusCard, { backgroundColor: '#E3F2FD', borderColor: '#2196F3', marginBottom: 12 }]}>
                <Text style={[styles.statusCardTitle, { color: '#1565C0' }]}>✅ Na-verify na ang Claim</Text>
                <Text style={[styles.statusCardBody, { color: '#0D47A1' }]}>
                  Naaprubahan ang claim at handa na para sa pagsasauli ng gamit.
                </Text>
              </View>

              {item.requires_office_pickup ? (
                <View>
                  <View
                    style={[
                      styles.officeStatusRow,
                      {
                        backgroundColor: officeStatus?.isOpen ? '#E8F5E9' : '#FFEBEE',
                        borderColor: officeStatus?.isOpen ? '#4CAF50' : '#EF5350',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: officeStatus?.isOpen ? '#2E7D32' : '#C62828' }}>
                      {officeStatus?.isOpen ? '🟢 BUKAS ANG OPISINA' : '🔴 SARADO ANG OPISINA'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{officeStatus?.message}</Text>
                  </View>

                  {currentUser?.role === 'admin' ? (
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        { backgroundColor: '#7B1123', marginTop: 12 },
                        (!officeStatus?.isOpen || isActionLoading) && { opacity: 0.5 },
                      ]}
                      onPress={handleMarkAsReturned}
                      disabled={!officeStatus?.isOpen || isActionLoading}
                      activeOpacity={0.85}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>🏢 I-release sa Opisina (Admin)</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.noteBox, { marginTop: 12, backgroundColor: '#FFF9E6', borderColor: '#E3B23C' }]}>
                      <Text style={{ color: '#8F6600', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                        🔒 Ang administrator sa Lost & Found Office lamang ang maaaring mag-release ng item na ito habang bukas ang opisina.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                (isOwner && !isLost) || (isLost && currentUser?.id === approvedClaimantId) ? (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#7B1123' }, isActionLoading && { opacity: 0.6 }]}
                    onPress={handleMarkAsReturned}
                    disabled={isActionLoading}
                    activeOpacity={0.85}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryActionBtnText}>🤝 Markahan bilang Naisauli / Released</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              )}
            </View>
          ) : isOwner ? (
            <View>
              <View style={[styles.ownerBadge, { backgroundColor: theme.accent + '25' }]}>
                <Text style={[styles.ownerBadgeText, { color: '#8F6600' }]}>
                  ⭐ Ikaw ang nag-post ng gamit na ito
                </Text>
              </View>

              {existingClaims.length > 0 && (
                <View style={styles.ownerClaimsSection}>
                  <Text style={[styles.ownerClaimsTitle, { color: theme.text }]}>
                    Mga Isinumiteng Claim ({existingClaims.length})
                  </Text>
                  {existingClaims.map((cl) => (
                    <TouchableOpacity
                      key={cl.id}
                      style={[styles.claimRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() =>
                        router.push({
                          pathname: '/claims/[id]',
                          params: { id: cl.id },
                        })
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.claimRowName, { color: theme.text }]}>
                          👤 {cl.claimantNickname}
                        </Text>
                        <Text style={[styles.claimRowStatus, { color: theme.textSecondary }]}>
                          Katayuan: {cl.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.claimRowArrow, { color: theme.primary }]}>Suriin ➤</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : isLost ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowContactModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>🤝 Nahanap Ko Ito</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: '#1E5B32' }]}
              onPress={() =>
                router.push({
                  pathname: '/claims/create',
                  params: { itemId: item.id },
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>✨ I-claim ang Gamit</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Contact Modal (for Lost items) */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={[styles.reportModalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.reportModalTitle, { color: theme.text }]}>
              Nahanap Mo Ba Ito?
            </Text>
            <Text style={[styles.reportModalSubtitle, { color: theme.textSecondary }]}>
              Magpadala ng mensahe sa nag-post upang mapagkasunduan ang pagbabalik ng gamit.
            </Text>

            <TextInput
              style={[
                styles.contactInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Hal: Nahanap ko ang gamit mo sa Library 2nd floor kaninang umaga..."
              placeholderTextColor={theme.placeholder}
              value={contactMessage}
              onChangeText={setContactMessage}
              multiline
              numberOfLines={4}
            />

            <View style={styles.reportBtnRow}>
              <TouchableOpacity
                style={[styles.reportCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowContactModal(false)}
                disabled={isSubmittingContact}
              >
                <Text style={[styles.reportCancelBtnText, { color: theme.text }]}>Kanselahin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportSubmitBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!contactMessage.trim()) {
                    Alert.alert('Puna', 'Pakisulat ang iyong mensahe.');
                    return;
                  }
                  try {
                    setIsSubmittingContact(true);
                    const claim = await initiateLostItemContact(item.id, contactMessage);
                    setShowContactModal(false);
                    router.push({
                      pathname: '/chat/[claimId]',
                      params: { claimId: claim.id },
                    });
                  } catch (err: any) {
                    Alert.alert('Nagka-aberya', err?.message || 'Hindi naipadala ang mensahe.');
                  } finally {
                    setIsSubmittingContact(false);
                  }
                }}
                disabled={isSubmittingContact}
              >
                {isSubmittingContact ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.reportSubmitBtnText}>Ipadala at Mag-chat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  ownerClaimsSection: {
    marginTop: Spacing.md,
  },
  ownerClaimsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  claimRowName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  claimRowStatus: {
    fontSize: FontSize.xs,
  },
  claimRowArrow: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  contactInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  statusCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusCardBody: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  officeStatusRow: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noteBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
