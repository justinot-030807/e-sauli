import { supabase } from '@/lib/supabase';
import type { Badge, UserBadge, Item } from '@/types/database';

export interface UserBadgeWithDetail extends Badge {
  isEarned: boolean;
  earnedAt?: string;
}

/**
 * Fetches all badges and marks which ones the user has earned.
 */
export async function fetchUserBadges(userId: string): Promise<UserBadgeWithDetail[]> {
  const { data: allBadges, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .order('requirement', { ascending: true });

  if (badgesError || !allBadges) {
    console.error('Error fetching badges:', badgesError);
    return [];
  }

  const { data: earnedBadges, error: userBadgesError } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId);

  if (userBadgesError) {
    console.error('Error fetching user badges:', userBadgesError);
  }

  const earnedMap = new Map<string, string>();
  if (earnedBadges) {
    earnedBadges.forEach((ub: UserBadge) => earnedMap.set(ub.badge_id, ub.earned_at));
  }

  return allBadges.map((badge: Badge) => ({
    ...badge,
    isEarned: earnedMap.has(badge.id),
    earnedAt: earnedMap.get(badge.id),
  }));
}

/**
 * Evaluates return criteria and awards any newly earned badges to the finder.
 * Emits an in-app notification when a new badge is unlocked.
 */
export async function evaluateAndAwardBadges(
  finderId: string,
  returnedItem: Item,
  isSpeedy: boolean
): Promise<Badge[]> {
  // 1. Fetch current profile returns_count
  const { data: profile } = await supabase
    .from('profiles')
    .select('returns_count')
    .eq('id', finderId)
    .single();

  const currentReturns = (profile?.returns_count || 0) + 1; // including this return

  // 2. Fetch all badges
  const { data: allBadges } = await supabase.from('badges').select('*');
  if (!allBadges) return [];

  // 3. Fetch already earned badge IDs
  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', finderId);

  const earnedBadgeIds = new Set((earnedBadges || []).map((b) => b.badge_id));
  const newlyAwarded: Badge[] = [];

  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    let qualifies = false;

    // Quantity-based badges
    if (badge.code === 'first_find' && currentReturns >= 1) qualifies = true;
    if (badge.code === 'good_samaritan' && currentReturns >= 5) qualifies = true;
    if (badge.code === 'campus_hero' && currentReturns >= 10) qualifies = true;
    if (badge.code === 'legend' && currentReturns >= 25) qualifies = true;

    // Action-based badges
    if (badge.code === 'speedy' && isSpeedy) qualifies = true;
    if (badge.code === 'honest_heart' && (returnedItem.category === 'Cash' || returnedItem.category === 'ID/Cards')) {
      qualifies = true;
    }

    if (qualifies) {
      const { error: insertError } = await supabase.from('user_badges').insert({
        user_id: finderId,
        badge_id: badge.id,
      });

      if (!insertError) {
        newlyAwarded.push(badge);

        // Notify finder
        await supabase.from('notifications').insert({
          user_id: finderId,
          type: 'badge_earned',
          body: `Binabati ka! Nakuha mo ang bagong badge: ${badge.icon} "${badge.name}" (${badge.description})!`,
          item_id: returnedItem.id,
          read: false,
        });
      }
    }
  }

  return newlyAwarded;
}
