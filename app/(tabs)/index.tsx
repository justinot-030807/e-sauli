import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { router } from 'expo-router';
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

type FilterType = 'all' | 'lost' | 'found';

export default function HomeFeedScreen() {
  const theme = useTheme();

  // Filter States
  const [activeType, setActiveType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'All'>('All');
  const [selectedLocation, setSelectedLocation] = useState<CampusLocation | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Modal State
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Data States
  const [items, setItems] = useState<ItemWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (targetPage = 1, shouldRefresh = false) => {
      try {
        if (targetPage === 1 && !shouldRefresh) {
          setIsLoading(true);
        }
        setError(null);

        const result = await fetchFeedItems({
          type: activeType,
          category: selectedCategory,
          location: selectedLocation,
          searchQuery,
          sortBy,
          page: targetPage,
          pageSize: 12,
        });

        if (targetPage === 1) {
          setItems(result.items);
        } else {
          setItems((prev) => [...prev, ...result.items]);
        }

        setHasMore(result.hasMore);
        setPage(targetPage);
      } catch (err: any) {
        console.error('Feed loading error:', err);
        setError(err?.message || 'Hindi maikarga ang mga gamit. Pakisubukang muli.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [activeType, selectedCategory, selectedLocation, searchQuery, sortBy]
  );

  useEffect(() => {
    loadFeed(1);
  }, [loadFeed]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeed(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      loadFeed(page + 1);
    }
  };

  const renderHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
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
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Maghanap ng gamit..."
              placeholderTextColor={theme.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={[styles.clearIcon, { color: theme.placeholder }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Modal Toggle Button */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: theme.surface,
                borderColor:
                  selectedLocation !== 'All' || sortBy !== 'newest'
                    ? theme.primary
                    : theme.border,
              },
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
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
                      color: isSelected ? theme.primary : theme.text,
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
  }, [
    theme,
    searchQuery,
    selectedLocation,
    sortBy,
    activeType,
    selectedCategory,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading && page === 1 ? (
        <LoadingView message="Kinakarga ang mga gamit..." />
      ) : error && items.length === 0 ? (
        <ErrorView message={error} onRetry={() => loadFeed(1)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
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
            <EmptyView
              title="Walang natagpuang gamit"
              description="Walang tugmang item sa napiling mga filter. Maaari mong subukang i-reset ang kategorya o lokasyon."
              actionLabel="I-reset ang mga Filter"
              onAction={() => {
                setSelectedCategory('All');
                setSelectedLocation('All');
                setActiveType('all');
                setSearchQuery('');
              }}
            />
          }
        />
      )}

      {/* Floating Action Button (Mag-report ng gamit) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/items/post')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Mag-report</Text>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Mga Karagdagang Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Text style={[styles.modalClose, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Location Filter */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lokasyon sa Campus</Text>
            <View style={styles.filterChipGroup}>
              {['All', ...CAMPUS_LOCATIONS].map((loc) => {
                const isSelected = selectedLocation === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? theme.primary + '18' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setSelectedLocation(loc as CampusLocation | 'All')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSelected ? theme.primary : theme.text },
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
                const isSelected = sortBy === sortOption.key;
                return (
                  <TouchableOpacity
                    key={sortOption.key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? theme.primary + '18' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setSortBy(sortOption.key as 'newest' | 'oldest')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSelected ? theme.primary : theme.text },
                      ]}
                    >
                      {sortOption.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowFilterModal(false)}
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
  listContent: {
    padding: Spacing.md,
    paddingBottom: 90, // Leave room for FAB
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    height: '100%',
  },
  clearIcon: {
    fontSize: 14,
    padding: Spacing.xs,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    fontSize: 18,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabItemText: {
    fontSize: FontSize.sm,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: FontSize.xs,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    gap: 6,
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: FontSize.lg,
    padding: 4,
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
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  applyButton: {
    marginTop: Spacing.xl,
    height: 48,
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
