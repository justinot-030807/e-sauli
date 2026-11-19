import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
  type ItemCategory,
  type CampusLocation,
} from '@/constants/categories';
import { fetchFeedItems, type ItemWithMeta } from '@/services/items';
import { ItemCard } from '@/components/ItemCard';
import { LoadingView, EmptyView, ErrorView } from '@/components/StateViews';
import { useAuthContext } from '@/contexts/AuthContext';

type FilterType = 'all' | 'lost' | 'found';

export default function HomeFeedScreen() {
  const theme = useTheme();
  const { session, isAuthenticated } = useAuthContext();
  const isDemo = isAuthenticated && !session;

  // Filter States
  const [activeType, setActiveType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'All'>('All');
  const [selectedLocation, setSelectedLocation] = useState<CampusLocation | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Modal State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftLocation, setDraftLocation] = useState<CampusLocation | 'All'>('All');
  const [draftSort, setDraftSort] = useState<'newest' | 'oldest'>('newest');

  // Data States
  const [items, setItems] = useState<ItemWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const errorPage = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const filtersActive = selectedLocation !== 'All' || sortBy !== 'newest';
  const hasFilters = filtersActive || activeType !== 'all' || selectedCategory !== 'All' || !!searchQuery.trim();

  const loadFeed = useCallback(
    async (targetPage = 1, shouldRefresh = false) => {
      if (targetPage > 1 && inFlight.current) return;
      const currentRequest = ++requestId.current;
      inFlight.current = true;
      setIsLoading(targetPage === 1 && !shouldRefresh);
      setIsRefreshing(shouldRefresh);
      setIsLoadingMore(targetPage > 1);
      setError(null);
      try {
        const result = await fetchFeedItems({
          type: activeType,
          category: selectedCategory,
          location: selectedLocation,
          searchQuery,
          sortBy,
          page: targetPage,
          pageSize: 12,
        }, isDemo);
        if (currentRequest !== requestId.current) return;

        if (targetPage === 1) {
          setItems(result.items);
        } else {
          setItems((prev) => [...prev, ...result.items.filter((item) => !prev.some(({ id }) => id === item.id))]);
        }

        setHasMore(result.hasMore);
        setPage(targetPage);
      } catch {
        if (currentRequest !== requestId.current) return;
        errorPage.current = targetPage;
        setError(targetPage > 1 ? 'Hindi maikarga ang iba pang gamit.' : 'Hindi maikarga ang mga gamit.');
      } finally {
        if (currentRequest === requestId.current) {
          inFlight.current = false;
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [activeType, selectedCategory, selectedLocation, searchQuery, sortBy, isDemo]
  );

  useFocusEffect(useCallback(() => {
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setItems([]);
    setPage(1);
    setHasMore(false);
    const timer = setTimeout(() => void loadFeed(), searchQuery.trim() ? 250 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current++;
      inFlight.current = false;
    };
  }, [loadFeed, searchQuery]));

  const handleRefresh = () => {
    void loadFeed(1, true);
  };

  const handleLoadMore = () => {
    if (!inFlight.current && !error && hasMore) {
      void loadFeed(page + 1);
    }
  };

  const header = (
      <View style={styles.headerContainer}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Mga Nawawala at Nahanap</Text>
        {isDemo && <Text style={[styles.demoLabel, { color: theme.textSecondary }]}>Demo · Mga halimbawang ulat</Text>}
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Maghanap ng gamit..."
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Maghanap ng gamit"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              maxLength={100}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" style={styles.iconButton} onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Modal Toggle Button */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: theme.surface,
                borderColor: filtersActive ? theme.primary : theme.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={filtersActive ? 'Mga filter, may napili' : 'Mga filter'}
            accessibilityState={{ expanded: showFilterModal }}
            onPress={() => {
              setDraftLocation(selectedLocation);
              setDraftSort(sortBy);
              setShowFilterModal(true);
            }}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filtersActive ? theme.text : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Type Tabs: Lahat / Nawala / Nahanap */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(['all', 'lost', 'found'] as FilterType[]).map((type) => {
            const isSelected = activeType === type;
            const label = type === 'all' ? 'Lahat' : type === 'lost' ? 'Nawala' : 'Nahanap';
            return (
              <TouchableOpacity
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.tabItem,
                  isSelected && {
                    backgroundColor: theme.primary,
                  },
                ]}
                onPress={() => setActiveType(type)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    {
                      color: isSelected ? '#ffffff' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Horizontal Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {['All', ...ITEM_CATEGORIES].map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? theme.primary + '18' : theme.card,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat as ItemCategory | 'All')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: theme.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {cat === 'All' ? 'Lahat ng Kategorya' : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={styles.feed}
        aria-hidden={showFilterModal}
        importantForAccessibility={showFilterModal ? 'no-hide-descendants' : 'auto'}
      >
        {header}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={[styles.listContent, !isDemo && styles.liveListContent]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            isLoading || isRefreshing ? <LoadingView message="Kinakarga ang mga gamit..." /> :
              error ? <ErrorView message={error} onRetry={() => void loadFeed()} /> :
                <EmptyView
                  title={hasFilters ? 'Walang tugmang gamit' : 'Wala pang ulat ng gamit'}
                  description={hasFilters ? 'Baguhin ang paghahanap o i-reset ang mga filter.' : 'Kapag may nag-ulat ng nawawala o nahanap na gamit, makikita ito rito.'}
                  actionLabel={hasFilters ? 'I-reset ang mga filter' : undefined}
                  onAction={() => {
                    setSelectedCategory('All');
                    setSelectedLocation('All');
                    setActiveType('all');
                    setSearchQuery('');
                    setSortBy('newest');
                  }}
                />
          }
          ListFooterComponent={items.length > 0 && (isLoadingMore || error) ? (
            isLoadingMore ? <LoadingView message="Kinakarga ang iba pang gamit..." /> :
              <ErrorView message={error ?? undefined} onRetry={() => void loadFeed(errorPage.current, errorPage.current === 1)} />
          ) : null}
        />

      {/* Floating Action Button (Mag-report ng gamit) */}
      {!isDemo && <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        accessibilityRole="button"
        onPress={() => router.push('/items/post')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#ffffff" style={{ marginRight: 4 }} />
        <Text style={styles.fabText}>Mag-report</Text>
      </TouchableOpacity>}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View accessibilityViewIsModal style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Mga Karagdagang Filter</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Isara ang mga filter" style={styles.iconButton} onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalFilters}>
            {/* Location Filter */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lokasyon sa Campus</Text>
            <View style={styles.filterChipGroup}>
              {['All', ...CAMPUS_LOCATIONS].map((loc) => {
                const isSelected = draftLocation === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? theme.primary + '18' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setDraftLocation(loc as CampusLocation | 'All')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {loc === 'All' ? 'Kahit saan' : loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sorting Order */}
            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.md }]}>
              Pagkakasunod-sunod
            </Text>
            <View style={styles.filterChipGroup}>
              {[
                { key: 'newest', label: 'Pinakabago' },
                { key: 'oldest', label: 'Pinakaluma' },
              ].map((sortOption) => {
                const isSelected = draftSort === sortOption.key;
                return (
                  <TouchableOpacity
                    key={sortOption.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? theme.primary + '18' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setDraftSort(sortOption.key as 'newest' | 'oldest')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {sortOption.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </ScrollView>

            {/* Apply Button */}
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              accessibilityRole="button"
              onPress={() => {
                setSelectedLocation(draftLocation);
                setSortBy(draftSort);
                setShowFilterModal(false);
              }}
            >
              <Text style={styles.applyButtonText}>Ilapat ang Filter</Text>
            </TouchableOpacity>
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
  feed: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  liveListContent: {
    paddingBottom: 88,
  },
  headerContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  demoLabel: {
    fontSize: FontSize.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    minHeight: 44,
    minWidth: 0,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.xs,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabItemText: {
    fontSize: FontSize.sm,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: FontSize.xs,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  modalFilters: {
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  filterChipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  applyButton: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
