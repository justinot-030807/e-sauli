import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CATEGORY_ICONS, type ItemCategory } from '@/constants/categories';
import { formatDateManila } from '@/utils/formatters';
import type { ItemWithMeta } from '@/services/items';

interface ItemCardProps {
  item: ItemWithMeta;
}

export const ItemCard = React.memo(function ItemCard({ item }: ItemCardProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  const isLost = item.type === 'lost';
  const statusColor = isLost ? '#A83246' : '#1E5B32';
  const categoryIcon = CATEGORY_ICONS[item.category as ItemCategory] || 'cube-outline';
  const imageSource = item.localImage ?? (item.signedPhotoUrl ? { uri: item.signedPhotoUrl } : null);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  React.useEffect(() => setPhotoFailed(false), [item.signedPhotoUrl, item.localImage]);
  const date = formatDateManila(item.date_happened);

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
      accessibilityRole="button"
      accessibilityLabel={[item.title, isLost ? 'Nawala' : 'Nahanap', item.category, item.location, date, item.requires_office_pickup && 'Sa opisina kukunin'].filter(Boolean).join(', ')}
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
        {imageSource && !photoFailed ? (
          <Image
            source={imageSource}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <Ionicons
            name={categoryIcon}
            size={32}
            color={statusColor}
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
                { color: isDark ? theme.text : statusColor },
              ]}
            >
              {isLost ? 'NAWALA' : 'NAHANAP'}
            </Text>
          </View>

          {/* Category Chip */}
          <Text style={[styles.categoryText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.category}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Location & Date */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
          <Text style={[styles.metaText, styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.location}
          </Text>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            • {date}
          </Text>
        </View>

        {/* Office Pickup Indicator */}
        {item.requires_office_pickup && (
          <View style={[styles.officeBadge, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name="business-outline" size={12} color={theme.text} />
            <Text style={[styles.officeBadgeText, { color: theme.text }]}>
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
    width: 64,
    height: 64,
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
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
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
  locationText: {
    flexShrink: 1,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  officeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
