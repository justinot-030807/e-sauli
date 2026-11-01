import { supabase } from '@/lib/supabase';
import type { Badge, UserBadge, Item } from '@/types/database';

export interface UserBadgeWithDetail extends Badge {
  isEarned: boolean;
  earnedAt?: string;
}

export const DEFAULT_BADGES: UserBadgeWithDetail[] = [
  {
    id: 'badge-01',
    code: 'first_find',
    name: 'Unang Pagkilos',
    description: 'Nagsauli ng unang nahanap na gamit sa campus.',
    icon: 'star-outline',
    requirement: 1,
    isEarned: true,
    earnedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'badge-02',
    code: 'good_samaritan',
    name: 'Mabuting Samaritano',
    description: 'Nagsauli ng 5 gamit sa mga kapwa mag-aaral.',
    icon: 'heart-outline',
    requirement: 5,
    isEarned: true,
    earnedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'badge-03',
    code: 'campus_hero',
    name: 'Campus Bayani',
    description: 'Nagsauli ng 10 gamit nang buong katapatan.',
    icon: 'trophy-outline',
    requirement: 10,
    isEarned: true,
    earnedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'badge-04',
    code: 'honest_heart',
    name: 'Tapat na Puso',
    description: 'Nagsauli ng sensitibong gamit gaya ng Wallet o Cash.',
    icon: 'shield-checkmark-outline',
    requirement: 1,
    isEarned: true,
    earnedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'badge-05',
    code: 'legend',
    name: 'Campus Legend',
    description: 'Nagsauli ng 25 gamit sa buong taon ng pag-aaral.',
    icon: 'medal-outline',
    requirement: 25,
    isEarned: false,
  },
];

/**
 * Fetches all badges and marks which ones the user has earned.
 */
export async function fetchUserBadges(userId: string): Promise<UserBadgeWithDetail[]> {
  try {
    const { data: allBadges, error: badgesError } = await supabase
      .from('badges')
      .select('*')
      .order('requirement', { ascending: true });

    if (!badgesError && allBadges && allBadges.length > 0) {
      const { data: earnedBadges } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId);

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
  } catch (err) {
    console.warn('Error fetching badges from Supabase, using default badges:', err);
  }

  return DEFAULT_BADGES;
}

/**
 * Evaluates return criteria and awards any newly earned badges to the finder.
 */
export async function evaluateAndAwardBadges(
  finderId: string,
  returnedItem: Item,
  isSpeedy: boolean
): Promise<Badge[]> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('returns_count')
      .eq('id', finderId)
      .single();

    const currentReturns = (profile?.returns_count || 0) + 1;

    const { data: allBadges } = await supabase.from('badges').select('*');
    if (!allBadges) return [];

    const { data: earnedBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', finderId);

    const earnedBadgeIds = new Set((earnedBadges || []).map((b) => b.badge_id));
    const newlyAwarded: Badge[] = [];

    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let qualifies = false;
      if (badge.code === 'first_find' && currentReturns >= 1) qualifies = true;
      if (badge.code === 'good_samaritan' && currentReturns >= 5) qualifies = true;
      if (badge.code === 'campus_hero' && currentReturns >= 10) qualifies = true;
      if (badge.code === 'legend' && currentReturns >= 25) qualifies = true;
      if (badge.code === 'speedy' && isSpeedy) qualifies = true;
      if (badge.code === 'honest_heart' && (returnedItem.category === 'Cash' || returnedItem.category === 'ID/Cards')) {
        qualifies = true;
      }

      if (qualifies) {
        await supabase.from('user_badges').insert({
          user_id: finderId,
          badge_id: badge.id,
        });
        newlyAwarded.push(badge);
      }
    }

    return newlyAwarded;
  } catch (err) {
    return [];
  }
}
