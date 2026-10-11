import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { signOut } from '@/services/auth';
import { fetchUserBadges, UserBadgeWithDetail } from '@/services/badges';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/database';
import { CATEGORY_ICONS, ItemCategory } from '@/constants/categories';

export default function ProfileScreen() {
  const { profile, user, refreshProfile } = useAuthContext();

  const [badges, setBadges] = useState<UserBadgeWithDetail[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<UserBadgeWithDetail | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // My Posts States
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [itemFilter, setItemFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [postsCount, setPostsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Load badges
      const userBadges = await fetchUserBadges(user.id);
      setBadges(userBadges);

      // 2. Load my items
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!itemsError && items) {
        setMyItems(items);
        setPostsCount(items.length);
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadProfileData();
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Mag-sign Out',
      'Sigurado ka bang nais mong mag-sign out sa E-Sauli?',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Mag-sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch (err) {
              console.error('Sign out error:', err);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Burahin ang Account at Datos',
      'Ang aksyong ito ay hindi na mababawi. Ang iyong personal na impormasyon (pangalan, student ID, email) ay permanenteng buburahin o ia-anonymize ayon sa Data Privacy Act.',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Oo, Burahin ang Aking Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const { error } = await supabase.rpc('delete_own_account');
              if (error) {
                Alert.alert('May Error', error.message || 'Nabigong burahin ang account.');
                return;
              }
              await signOut();
              Alert.alert('Account Nabura', 'Matagumpay na nabura ang iyong account at na-anonymize ang iyong datos.');
              router.replace('/(auth)/login');
            } catch (err: any) {
              Alert.alert('May Error', err?.message || 'Nabigong burahin ang account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const filteredItems = myItems.filter((it) => {
    if (itemFilter === 'all') return true;
    return it.type === itemFilter;
  });

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7B1123" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7B1123']} />}
    >
      {/* Profile Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(profile.nickname)}</Text>
        </View>

        <Text style={styles.nickname}>{profile.nickname}</Text>
        <Text style={styles.college}>{profile.college}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.verifiedChip}>
            <Text style={styles.verifiedText}>✓ Verified MarSU student</Text>
          </View>
          <View style={[styles.roleChip, profile.role === 'admin' && styles.adminChip]}>
            <Text style={[styles.roleText, profile.role === 'admin' && styles.adminText]}>
              {profile.role === 'admin' ? '👑 Admin' : '🎓 Mag-aaral'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3-Column Stats Grid (Mockup Screen 9) */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile.points}</Text>
          <Text style={styles.statLabel}>Aura Points</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile.returns_count}</Text>
          <Text style={styles.statLabel}>Naibalik</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{postsCount}</Text>
          <Text style={styles.statLabel}>Nai-post</Text>
        </View>
      </View>

      {/* Achievements / Badges Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mga Badge at Achievements</Text>
          <Text style={styles.badgeCount}>
            {badges.filter((b) => b.isEarned).length}/{badges.length}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#7B1123" style={{ paddingVertical: 12 }} />
        ) : (
          <View style={styles.badgesWrapper}>
            {badges.map((badge) => {
              const isEarned = badge.isEarned;
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeChip, isEarned ? styles.badgeChipEarned : styles.badgeChipLocked]}
                  onPress={() => {
                    setSelectedBadge(badge);
                    setShowBadgeModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.badgeChipIcon}>{badge.icon}</Text>
                  <Text
                    style={[styles.badgeChipText, isEarned ? styles.badgeChipTextEarned : styles.badgeChipTextLocked]}
                  >
                    {badge.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* My Posts Section ("Mga Post Ko") */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mga Post Ko</Text>
          <View style={styles.itemFilterTabs}>
            <TouchableOpacity
              style={[styles.filterTab, itemFilter === 'all' && styles.filterTabActive]}
              onPress={() => setItemFilter('all')}
            >
              <Text style={[styles.filterTabText, itemFilter === 'all' && styles.filterTabTextActive]}>Lahat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, itemFilter === 'lost' && styles.filterTabActive]}
              onPress={() => setItemFilter('lost')}
            >
              <Text style={[styles.filterTabText, itemFilter === 'lost' && styles.filterTabTextActive]}>Nawala</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, itemFilter === 'found' && styles.filterTabActive]}
              onPress={() => setItemFilter('found')}
            >
              <Text style={[styles.filterTabText, itemFilter === 'found' && styles.filterTabTextActive]}>Nahanap</Text>
            </TouchableOpacity>
          </View>
        </View>

        {filteredItems.length === 0 ? (
          <Text style={styles.emptyItemsText}>Walang nakitang post sa kategoryang ito.</Text>
        ) : (
          filteredItems.map((item) => {
            const isLost = item.type === 'lost';
            const icon = CATEGORY_ICONS[item.category as ItemCategory] || '📦';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.postItemCard}
                onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
                activeOpacity={0.7}
              >
                <View style={[styles.postItemIconBox, { backgroundColor: isLost ? '#FBE6E8' : '#E3F1E7' }]}>
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </View>

                <View style={styles.postItemInfo}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.postTypeTag,
                        { color: isLost ? '#8A1F2E' : '#1E5B32', backgroundColor: isLost ? '#FBE6E8' : '#E3F1E7' },
                      ]}
                    >
                      {isLost ? 'NAWALA' : 'NAHANAP'}
                    </Text>
                    <Text style={styles.postStatusText}>{item.status.toUpperCase()}</Text>
                  </View>

                  <Text style={styles.postItemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.postItemSubtext}>📍 {item.location} • 📅 {item.date_happened}</Text>
                </View>

                <View style={styles.viewButton}>
                  <Text style={styles.viewButtonText}>Tingnan</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Account Details Card (Section 2 - Private to Own User) */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Impormasyon ng Account</Text>
        <Text style={styles.privacyNotice}>
          🔒 Ang iyong buong pangalan at student ID ay pribado at hindi kailanman ibinubunyag sa ibang mag-aaral o sa leaderboard.
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Buong Pangalan:</Text>
          <Text style={styles.infoValue}>{profile.full_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Student ID:</Text>
          <Text style={styles.infoValue}>{profile.student_id}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Katayuan ng Account:</Text>
          <Text style={[styles.infoValue, { color: '#2E7D32', fontWeight: '700' }]}>
            {profile.approval_status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        disabled={loggingOut}
        activeOpacity={0.8}
      >
        {loggingOut ? (
          <ActivityIndicator color="#C62828" />
        ) : (
          <Text style={styles.signOutText}>Mag-sign Out</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
        disabled={deleting}
        activeOpacity={0.7}
      >
        {deleting ? (
          <ActivityIndicator color="#9E9E9E" />
        ) : (
          <Text style={styles.deleteText}>Burahin ang Aking Account at Datos</Text>
        )}
      </TouchableOpacity>

      {/* Badge Details Modal (Screen 15: Badge Popup) */}
      <Modal
        visible={showBadgeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBadgeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View
              style={[
                styles.modalBadgeIconCircle,
                selectedBadge?.isEarned ? styles.modalIconEarned : styles.modalIconLocked,
              ]}
            >
              <Text style={{ fontSize: 44 }}>{selectedBadge?.icon}</Text>
            </View>

            <Text style={styles.modalBadgeTitle}>{selectedBadge?.name}</Text>
            <Text style={styles.modalBadgeDesc}>{selectedBadge?.description}</Text>

            <View style={styles.modalBadgeStatusBox}>
              <Text style={styles.modalRequirementText}>
                🎯 Kailangan: {selectedBadge?.requirement} matagumpay na naibalik
              </Text>
              {selectedBadge?.isEarned ? (
                <Text style={styles.modalEarnedStatus}>
                  ✅ Nakuha na {selectedBadge.earnedAt ? `noong ${new Date(selectedBadge.earnedAt).toLocaleDateString()}` : ''}!
                </Text>
              ) : (
                <Text style={styles.modalLockedStatus}>
                  🔒 Hindi pa nakukuha. Ipagpatuloy ang pagbabalik ng mga gamit!
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowBadgeModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Isara</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    marginBottom: 16,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#7B1123',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nickname: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A1E20',
  },
  college: {
    fontSize: 13,
    color: '#6B5A5E',
    marginTop: 2,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  verifiedChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F1E7',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E5B32',
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F0EAE1',
  },
  adminChip: {
    backgroundColor: '#FFF8E1',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5A4000',
  },
  adminText: {
    color: '#B78103',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7B1123',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B5A5E',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1E20',
  },
  badgeCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B1123',
  },
  badgesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    gap: 6,
  },
  badgeChipEarned: {
    backgroundColor: '#F3E4B8',
    borderWidth: 1,
    borderColor: '#E8B83A',
  },
  badgeChipLocked: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9B9A3',
  },
  badgeChipIcon: {
    fontSize: 14,
  },
  badgeChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeChipTextEarned: {
    color: '#5A4000',
  },
  badgeChipTextLocked: {
    color: '#9E9E9E',
  },
  itemFilterTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  filterTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#7B1123',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B5A5E',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  emptyItemsText: {
    fontSize: 13,
    color: '#9E9E9E',
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  postItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE1',
    gap: 10,
  },
  postItemIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  postTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  postStatusText: {
    fontSize: 10,
    color: '#6B5A5E',
    fontWeight: '600',
  },
  postItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1E20',
    marginTop: 2,
  },
  postItemSubtext: {
    fontSize: 11,
    color: '#6B5A5E',
    marginTop: 1,
  },
  viewButton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#E8B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3A0C14',
  },
  privacyNotice: {
    fontSize: 12,
    color: '#6B5A5E',
    lineHeight: 16,
    marginBottom: 12,
    backgroundColor: '#FBF8F3',
    padding: 8,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE1',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B5A5E',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A1E20',
  },
  signOutButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C62828',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C62828',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteText: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalBadgeIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalIconEarned: {
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#E8B83A',
  },
  modalIconLocked: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#BDBDBD',
  },
  modalBadgeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A1E20',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalBadgeDesc: {
    fontSize: 14,
    color: '#6B5A5E',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalBadgeStatusBox: {
    width: '100%',
    backgroundColor: '#FBF8F3',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    marginBottom: 20,
  },
  modalRequirementText: {
    fontSize: 13,
    color: '#2A1E20',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalEarnedStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  modalLockedStatus: {
    fontSize: 13,
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  modalCloseButton: {
    width: '100%',
    backgroundColor: '#7B1123',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
