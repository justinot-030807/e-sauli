import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CATEGORY_ICONS, type ItemCategory } from '@/constants/categories';
import type { ItemWithMeta } from '@/services/items';

interface ItemCardProps {
  item: ItemWithMeta;
}

export const ItemCard = React.memo(function ItemCard({ item }: ItemCardProps) {
  const theme = useTheme();

  const isLost = item.type === 'lost';
  const categoryIcon = CATEGORY_ICONS[item.category as ItemCategory] || 'cube-outline';
  const imageSource = (item as any).localImage || (item.signedPhotoUrl ? { uri: item.signedPhotoUrl } : null);

  const handlePress = () => {
    router.push({
      pathname: '/items/[id]',
      params: { id: item.id },
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      {/* Thumbnail or Category Icon */}
      <View
        style={[
          styles.thumbnailContainer,
          { backgroundColor: isLost ? '#FBEBEB' : '#EAF7EE' },
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name={categoryIcon}
            size={32}
            color={isLost ? '#A83246' : '#1E5B32'}
          />
        )}
      </View>

      {/* Item Information */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          {/* Type Badge: Nawala vs Nahanap */}
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isLost ? '#7B1E2B18' : '#1E5B3218',
              },
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

          {/* Category Chip */}
          <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
            {item.category}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {item.title}
        </Text>

        {/* Location & Date */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.location}
          </Text>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            • {item.date_happened}
          </Text>
        </View>

        {/* Office Pickup Indicator */}
        {item.requires_office_pickup && (
          <View style={[styles.officeBadge, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name="business-outline" size={11} color="#8F6600" />
            <Text style={[styles.officeBadgeText, { color: '#8F6600' }]}>
              Sa Opisina Kukunin
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  categoryEmoji: {
    fontSize: 34,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  officeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 6,
  },
  officeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
