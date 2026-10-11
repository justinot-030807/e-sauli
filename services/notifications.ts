import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Fetches all notifications for the current authenticated user.
 */
export async function fetchMyNotifications(): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !notifications) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return notifications;
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
}

/**
 * Marks all notifications for the current user as read.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);
}

/**
 * Subscribes to realtime in-app notifications for a user.
 */
export function subscribeToUserNotifications(
  userId: string,
  onNotificationReceived: (notification: Notification) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`user_notifications_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onNotificationReceived(payload.new as Notification);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
