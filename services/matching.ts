import { supabase } from '@/lib/supabase';
import type { Item, ItemType } from '@/types/database';

export interface MatchScore {
  candidateItem: Item;
  score: number;
}

/**
 * Deterministic Item Matching Engine (Specification Section 17):
 * When a new item is posted, search for opposite-type active items.
 * Scoring rules:
 * - Same category: +40
 * - Same location: +30
 * - Date within 1 day: +20
 * - Date within 3 days: +10
 * If score >= threshold (default 70 from system_settings), create an in-app notification.
 * Private details are NEVER exposed during matching.
 */
export async function findAndNotifyMatches(newItem: Item): Promise<MatchScore[]> {
  const oppositeType: ItemType = newItem.type === 'lost' ? 'found' : 'lost';

  // 1. Fetch match score threshold from system_settings
  const { data: settingData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'match_score_threshold')
    .maybeSingle();

  const threshold = settingData ? parseInt(settingData.value, 10) : 70;

  // 2. Fetch active candidate items of the opposite type
  const { data: candidates, error } = await supabase
    .from('items')
    .select('*')
    .eq('type', oppositeType)
    .eq('status', 'open')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .neq('user_id', newItem.user_id) // Do not match user's own items
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !candidates) {
    console.error('Error fetching candidate items for matching:', error);
    return [];
  }

  const newDate = new Date(newItem.date_happened).getTime();
  const qualifyingMatches: MatchScore[] = [];

  for (const candidate of candidates) {
    let score = 0;

    // Same category: +40
    if (candidate.category.toLowerCase() === newItem.category.toLowerCase()) {
      score += 40;
    }

    // Same location: +30
    if (candidate.location.toLowerCase() === newItem.location.toLowerCase()) {
      score += 30;
    }

    // Date proximity
    const candidateDate = new Date(candidate.date_happened).getTime();
    const diffDays = Math.abs(newDate - candidateDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      score += 20;
    } else if (diffDays <= 3) {
      score += 10;
    }

    if (score >= threshold) {
      qualifyingMatches.push({ candidateItem: candidate, score });

      // Notify the owner of the candidate item
      const itemTitleExcerpt = newItem.title.length > 25 ? newItem.title.substring(0, 22) + '...' : newItem.title;
      const notifyMessage =
        newItem.type === 'found'
          ? `Possible match found! Someone posted a found item matching your report: "${itemTitleExcerpt}".`
          : `Possible match found! A new lost report matches an item you found: "${itemTitleExcerpt}".`;

      await supabase.from('notifications').insert({
        user_id: candidate.user_id,
        type: 'possible_match',
        body: notifyMessage,
        item_id: candidate.id,
        read: false,
      });

      // Also notify the author of the new item
      const candidateTitleExcerpt =
        candidate.title.length > 25 ? candidate.title.substring(0, 22) + '...' : candidate.title;
      const selfNotifyMessage =
        newItem.type === 'found'
          ? `Possible match: An earlier report matches the item you found: "${candidateTitleExcerpt}".`
          : `Possible match: Someone previously reported finding an item matching yours: "${candidateTitleExcerpt}".`;

      await supabase.from('notifications').insert({
        user_id: newItem.user_id,
        type: 'possible_match',
        body: selfNotifyMessage,
        item_id: candidate.id,
        read: false,
      });
    }
  }

  return qualifyingMatches;
}
