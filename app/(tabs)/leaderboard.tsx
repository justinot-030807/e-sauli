import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuthContext } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchLeaderboard,
  fetchUserRank,
  LeaderboardTimeframe,
  LeaderboardEntry,
  UserRankInfo,
} from '@/services/leaderboard';
import { COLLEGES } from '@/constants/categories';
import { EmptyView, ErrorView } from '@/components/StateViews';

const TIMEFRAMES: { key: LeaderboardTimeframe; label: string }[] = [
  { key: 'week', label: 'Linggo' },
  { key: 'month', label: 'Buwan' },
  { key: 'all_time', label: 'Lahat' },
];

export default function LeaderboardScreen() {
  const { user, profile } = useAuthContext();

  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('month');
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchLeaderboard(timeframe, selectedCollege, 50);
      setLeaderboard(data);

      if (user?.id) {
        const rankInfo = await fetchUserRank(user.id, timeframe, selectedCollege);
        setUserRank(rankInfo);
      }
    } catch (err: any) {
      console.error('Error loading leaderboard:', err);
      setError(err?.message || 'Nabigong kumuha ng leaderboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe, selectedCollege, user?.id]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Top 3 for podium
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const restEntries = leaderboard.slice(3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aura Farming</Text>
        <Text style={styles.headerSubtitle}>Mga nagbabalik ng gamit sa campus</Text>
      </View>

      {/* Timeframe Tabs */}
      <View style={styles.tabsRow}>
        {TIMEFRAMES.map((tab) => {
          const isActive = timeframe === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setTimeframe(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* College Filter Pills */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedCollege === null && styles.filterChipActive]}
            onPress={() => setSelectedCollege(null)}
          >
            <Text style={[styles.filterChipText, selectedCollege === null && styles.filterChipTextActive]}>
              Lahat ng Kolehiyo
            </Text>
          </TouchableOpacity>

          {COLLEGES.map((col) => {
            const isColActive = selectedCollege === col;
            return (
              <TouchableOpacity
                key={col}
                style={[styles.filterChip, isColActive && styles.filterChipActive]}
                onPress={() => setSelectedCollege(col)}
              >
                <Text style={[styles.filterChipText, isColActive && styles.filterChipTextActive]}>
                  {col}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7B1123" />
          <Text style={styles.loadingText}>Kinakalkula ang ranggo ng Aura...</Text>
        </View>
      ) : error ? (
        <ErrorView message={error} onRetry={loadData} />
      ) : leaderboard.length === 0 ? (
        <EmptyView
          emoji="🏆"
          title="Wala Pang Tala sa Leaderboard"
          description="Maging una sa magsauli ng gamit upang manguna sa ranggo!"
        />
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7B1123']} />}
        >
          {/* Top 3 Podium */}
          <View style={styles.podiumContainer}>
            {/* 2nd Place (Left) */}
            <View style={styles.podiumColumn}>
              {top2 ? (
                <>
                  <View style={[styles.podiumAvatar, { backgroundColor: '#CFC8DE' }]}>
                    <Text style={[styles.podiumAvatarText, { color: '#3A3252' }]}>
                      {getInitials(top2.nickname)}
                    </Text>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{top2.nickname}</Text>
                  <Text style={styles.podiumCollege} numberOfLines={1}>{top2.college}</Text>
                  <View style={[styles.podiumPillar, styles.pillar2]}>
                    <Text style={styles.podiumRankNum}>2</Text>
                    <Text style={styles.podiumPoints}>{top2.points} pts</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.podiumPillar, styles.pillar2, styles.emptyPillar]} />
              )}
            </View>

            {/* 1st Place (Center - Tallest) */}
            <View style={styles.podiumColumn}>
              {top1 ? (
                <>
                  <Ionicons name="trophy" size={24} color="#D4AF37" style={{ marginBottom: 2 }} />
                  <View style={[styles.podiumAvatar, styles.avatar1]}>
                    <Text style={[styles.podiumAvatarText, { color: '#5A4000' }]}>
                      {getInitials(top1.nickname)}
                    </Text>
                  </View>
                  <Text style={[styles.podiumName, styles.podiumName1]} numberOfLines={1}>{top1.nickname}</Text>
                  <Text style={styles.podiumCollege} numberOfLines={1}>{top1.college}</Text>
                  <View style={[styles.podiumPillar, styles.pillar1]}>
                    <Text style={[styles.podiumRankNum, { color: '#FFE082' }]}>1</Text>
                    <Text style={[styles.podiumPoints, { color: '#FFFFFF', fontWeight: '800' }]}>
                      {top1.points} pts
                    </Text>
                  </View>
                </>
              ) : (
                <View style={[styles.podiumPillar, styles.pillar1, styles.emptyPillar]} />
              )}
            </View>

            {/* 3rd Place (Right) */}
            <View style={styles.podiumColumn}>
              {top3 ? (
                <>
                  <View style={[styles.podiumAvatar, { backgroundColor: '#FED7AA' }]}>
                    <Text style={[styles.podiumAvatarText, { color: '#7C2D12' }]}>
                      {getInitials(top3.nickname)}
                    </Text>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{top3.nickname}</Text>
                  <Text style={styles.podiumCollege} numberOfLines={1}>{top3.college}</Text>
                  <View style={[styles.podiumPillar, styles.pillar3]}>
                    <Text style={styles.podiumRankNum}>3</Text>
                    <Text style={styles.podiumPoints}>{top3.points} pts</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.podiumPillar, styles.pillar3, styles.emptyPillar]} />
              )}
            </View>
          </View>

          {/* Ranking List (#4+) */}
          {restEntries.length > 0 && (
            <View style={styles.rankListCard}>
              {restEntries.map((entry) => {
                const isCurrentUser = user?.id === entry.userId;
                return (
                  <View
                    key={entry.userId}
                    style={[styles.rankRow, isCurrentUser && styles.rankRowCurrent]}
                  >
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{entry.rank}</Text>
                    </View>

                    <View style={styles.rankAvatar}>
                      <Text style={styles.rankAvatarText}>{getInitials(entry.nickname)}</Text>
                    </View>

                    <View style={styles.rankInfo}>
                      <Text style={styles.rankNickname} numberOfLines={1}>
                        {entry.nickname} {isCurrentUser && '(Ikaw)'}
                      </Text>
                      <Text style={styles.rankCollege} numberOfLines={1}>
                        {entry.college} • {entry.returnsCount} naisauli
                      </Text>
                    </View>

                    <View style={styles.rankPointsBadge}>
                      <Text style={styles.rankPointsText}>{entry.points} pts</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Current User Rank Pinned at Bottom */}
      {user && profile && (
        <View style={styles.pinnedBottomBar}>
          <View style={styles.pinnedInfo}>
            <View style={styles.pinnedAvatar}>
              <Text style={styles.pinnedAvatarText}>{getInitials(profile.nickname)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pinnedName} numberOfLines={1}>
                {profile.nickname} (Ikaw)
              </Text>
              <Text style={styles.pinnedSubtext}>
                {userRank?.rank && userRank.rank > 0
                  ? `Ranggo #${userRank.rank} • ${userRank.points} Aura`
                  : `${profile.points} Aura`}
              </Text>
            </View>
          </View>

          <View style={styles.pinnedMotivation}>
            {userRank?.pointsToTop10 && userRank.pointsToTop10 > 0 ? (
              <Text style={styles.motivationText}>
                {userRank.pointsToTop10} aura pa para sa Top 10!
              </Text>
            ) : userRank?.rank && userRank.rank <= 3 ? (
              <Text style={styles.motivationGoldText}>Nasa Podium ka na!</Text>
            ) : userRank?.rank && userRank.rank <= 10 ? (
              <Text style={styles.motivationGoldText}>Top 10 Champion!</Text>
            ) : (
              <Text style={styles.motivationText}>Mag-sauli para tumaas!</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7B1123',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B5A5E',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#7B1123',
    borderColor: '#7B1123',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A1E20',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterScrollWrapper: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  filterChipActive: {
    backgroundColor: '#E8B83A',
    borderColor: '#D4A328',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B5A5E',
  },
  filterChipTextActive: {
    color: '#3A0C14',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B5A5E',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 8,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  crownEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatar1: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDE68A',
    borderWidth: 2,
    borderColor: '#E8B83A',
  },
  podiumAvatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A1E20',
    textAlign: 'center',
  },
  podiumName1: {
    fontSize: 13,
    fontWeight: '800',
  },
  podiumCollege: {
    fontSize: 11,
    color: '#6B5A5E',
    textAlign: 'center',
    marginBottom: 8,
  },
  podiumPillar: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  emptyPillar: {
    opacity: 0.3,
  },
  pillar1: {
    height: 110,
    backgroundColor: '#7B1123',
  },
  pillar2: {
    height: 85,
    backgroundColor: '#8C2B3C',
  },
  pillar3: {
    height: 70,
    backgroundColor: '#9E3F50',
  },
  podiumRankNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  podiumPoints: {
    fontSize: 12,
    color: '#F4E7D7',
    marginTop: 2,
    fontWeight: '600',
  },
  rankListCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    overflow: 'hidden',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE1',
  },
  rankRowCurrent: {
    backgroundColor: '#FFF9E6',
  },
  rankBadge: {
    width: 32,
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B5A5E',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE6D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5A4000',
  },
  rankInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  rankNickname: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1E20',
  },
  rankCollege: {
    fontSize: 12,
    color: '#6B5A5E',
    marginTop: 1,
  },
  rankPointsBadge: {
    backgroundColor: '#FBF8F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  rankPointsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B1123',
  },
  pinnedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2A1E20',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#491217',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  pinnedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  pinnedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8B83A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pinnedAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3A0C14',
  },
  pinnedName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinnedSubtext: {
    fontSize: 11,
    color: '#E8B83A',
    marginTop: 1,
  },
  pinnedMotivation: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  motivationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFCDD2',
  },
  motivationGoldText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFE082',
  },
});
