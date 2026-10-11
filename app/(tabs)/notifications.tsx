import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  fetchMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToUserNotifications,
} from '@/services/notifications';
import { supabase } from '@/lib/supabase';
import { LoadingView, EmptyView, ErrorView } from '@/components/StateViews';
import type { Notification } from '@/types/database';

export default function NotificationsScreen() {
  const theme = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const data = await fetchMyNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err?.message || 'Hindi maikarga ang mga abiso.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription for incoming notifications
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserNotifications(currentUserId, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadNotifications(true);
  };

  const handlePressNotification = async (notification: Notification) => {
    if (!notification.read) {
      markNotificationAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }

    if (notification.item_id) {
      router.push({
        pathname: '/items/[id]',
        params: { id: notification.item_id },
      });
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'claim_received':
        return '📥';
      case 'claim_approved':
        return '🎉';
      case 'claim_rejected':
        return '❌';
      case 'claim_lockout':
        return '🔒';
      case 'new_message':
        return '💬';
      case 'possible_match':
        return '🔍';
      case 'item_expired':
        return '⏰';
      default:
        return '🔔';
    }
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingView message="Kinakarga ang iyong mga abiso..." />
      </View>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ErrorView message={error} onRetry={() => loadNotifications()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mga Abiso</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={[styles.markAllText, { color: theme.primary }]}>
              Basahin Lahat
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        renderItem={({ item }) => {
          const isUnread = !item.read;
          const icon = getNotificationIcon(item.type);

          return (
            <TouchableOpacity
              style={[
                styles.notificationCard,
                {
                  backgroundColor: isUnread ? theme.card : theme.background,
                  borderColor: isUnread ? theme.primary + '50' : theme.border,
                },
              ]}
              onPress={() => handlePressNotification(item)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isUnread ? theme.primary + '18' : theme.surface,
                  },
                ]}
              >
                <Text style={styles.iconEmoji}>{icon}</Text>
              </View>

              <View style={styles.contentContainer}>
                <Text
                  style={[
                    styles.notificationBody,
                    {
                      color: theme.text,
                      fontWeight: isUnread ? '700' : '400',
                    },
                  ]}
                >
                  {item.body}
                </Text>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {new Date(item.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {isUnread && (
                <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyView
            emoji="🔕"
            title="Walang mga abiso"
            description="Walang bagong aktibidad o mensahe sa iyong account."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  markAllText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  listContent: {
    padding: Spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
  },
  notificationBody: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
