import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { fetchClaimDetail, approveClaim, rejectClaim, type ClaimWithMeta } from '@/services/claims';
import { useAuthContext } from '@/contexts/AuthContext';
import { confirmAction } from '@/utils/confirmAction';
import { LoadingView, ErrorView } from '@/components/StateViews';
import type { Item } from '@/types/database';

export default function ClaimDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [claim, setClaim] = useState<(ClaimWithMeta & { item: Item }) | null>(null);
  const { user, isAdmin } = useAuthContext();
  const processing = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) {
      setError('Walang napiling claim.');
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchClaimDetail(id);
      setClaim(res);
    } catch (err: any) {
      console.error('Error loading claim:', err);
      setError(err?.message || 'Hindi maikarga ang detalye ng claim.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadData());
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  const handleDecision = (approve: boolean) => {
    if (!id || processing.current) return;
    confirmAction(approve ? 'Aprubahan ang claim?' : 'Tanggihan ang claim?',
      approve ? 'Magsasara ang iba pang nakabinbing claim para sa gamit na ito.' : 'Aabisuhan ang nagsumite kapag sinuri ang claim.',
      {
        text: approve ? 'Aprubahan' : 'Tanggihan',
        style: approve ? 'default' : 'destructive',
        onPress: async () => {
          if (processing.current) return;
          processing.current = true;
          setActionError(null);
          setIsProcessing(true);
          try {
            await (approve ? approveClaim(id) : rejectClaim(id));
            await loadData();
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Hindi nabago ang claim.');
          } finally {
            setIsProcessing(false);
            processing.current = false;
          }
        },
      });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Detalye ng Claim', headerShown: true }} />
        <LoadingView message="Kinakarga ang claim..." />
      </View>
    );
  }

  if (error || !claim) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Detalye ng Claim', headerShown: true }} />
        <ErrorView message={error || 'Hindi natagpuan ang claim.'} onRetry={loadData} />
      </View>
    );
  }

  const isPoster = user?.id === claim.item.user_id;
  const canApprove = isAdmin || (isPoster && !claim.item.requires_office_pickup);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: '#FFF9E6', text: '#8F6600', label: 'Nakabinbin (Pending)' },
    approved: { bg: '#EAF7EE', text: '#1E5B32', label: 'Naaprubahan (Approved)' },
    rejected: { bg: '#FBEBEB', text: '#A83246', label: 'Tinanggihan (Rejected)' },
    auto_rejected: { bg: '#F0ECEE', text: '#6B5A5E', label: 'Sarado (Auto-rejected)' },
  };

  const currentStatus = statusColors[claim.status] || {
    bg: '#F0ECEE',
    text: '#6B5A5E',
    label: claim.status,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Suriin ang Claim',
          headerShown: true,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.headerText,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: currentStatus.bg }]}>
          <Text style={[styles.statusLabel, { color: currentStatus.text }]}>
            Katayuan ng Claim: {currentStatus.label}
          </Text>
          <Text style={[styles.dateText, { color: currentStatus.text }]}>
            Isinumite noong: {new Date(claim.created_at).toLocaleDateString()}
          </Text>
        </View>

        {/* Item Summary Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Inire-report na Gamit</Text>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{claim.item.title}</Text>
          <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
            Kategorya: {claim.item.category} • Lokasyon: {claim.item.location}
          </Text>
        </View>

        {/* Claimant Info Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Impormasyon ng Claimant</Text>
          <Text style={[styles.claimantName, { color: theme.text }]}>
            Claimant: {claim.claimantNickname}
          </Text>
          <Text style={[styles.claimantCollege, { color: theme.textSecondary }]}>
            Kolehiyo: {claim.claimantCollege}
          </Text>
        </View>

        {/* Proof Description Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Patunay / Deskripsyon ng Claimant
          </Text>
          <Text style={[styles.proofBody, { color: theme.text }]}>{claim.proof_text}</Text>
        </View>

        {/* Chat Action Button */}
        <TouchableOpacity
          style={[styles.chatButton, { backgroundColor: theme.primary }]}
          onPress={() =>
            router.push({
              pathname: '/chat/[claimId]',
              params: { claimId: claim.id },
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.chatButtonText}>Buksan ang Chat / Komunikasyon</Text>
        </TouchableOpacity>

        {/* Finder Approval / Rejection Controls */}
        {actionError && <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{actionError}</Text>}
        {(isPoster || isAdmin) && claim.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleDecision(false)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>✕ Tanggihan</Text>
              )}
            </TouchableOpacity>

            {canApprove && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleDecision(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>✓ Aprubahan</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: 4,
  },
  dateText: {
    fontSize: FontSize.xs,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  itemTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: FontSize.sm,
  },
  claimantName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  claimantCollege: {
    fontSize: FontSize.sm,
  },
  proofBody: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  chatButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#1E5B32',
  },
  rejectBtn: {
    backgroundColor: '#A83246',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
