import { supabase } from '@/lib/supabase';

export type LeaderboardTimeframe = 'all_time' | 'month' | 'week';

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  nickname: string;
  college: string;
  points: number;
  returnsCount: number;
}

export interface UserRankInfo {
  rank: number;
  points: number;
  pointsToTop10: number;
}

/**
 * Fetches the privacy-safe leaderboard.
 * Section 20 Privacy Rule:
 * Strictly returns ONLY nickname, college, points, and returns_count.
 * NEVER exposes full_name, student_id, or email.
 */
export async function fetchLeaderboard(
  timeframe: LeaderboardTimeframe = 'all_time',
  college?: string | null,
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_timeframe: timeframe,
      p_college: college || null,
      p_limit: limit,
    });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw new Error(error.message || 'Nabigong kumuha ng leaderboard.');
    }

    if (!data) return [];

    return (data as any[]).map((row) => ({
      userId: row.user_id,
      rank: Number(row.rank),
      nickname: row.nickname,
      college: row.college,
      points: Number(row.points),
      returnsCount: Number(row.returns_count),
    }));
  } catch (err: any) {
    console.error('fetchLeaderboard exception:', err);
    throw err;
  }
}

/**
 * Fetches the authenticated user's current rank and remaining points needed for Top 10.
 */
export async function fetchUserRank(
  userId: string,
  timeframe: LeaderboardTimeframe = 'all_time',
  college?: string | null
): Promise<UserRankInfo | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_rank', {
      p_user_id: userId,
      p_timeframe: timeframe,
      p_college: college || null,
    });

    if (error) {
      console.error('Error fetching user rank:', error);
      return null;
    }

    if (!data || (data as any[]).length === 0) return null;

    const row = (data as any[])[0];
    return {
      rank: Number(row.rank),
      points: Number(row.points),
      pointsToTop10: Number(row.points_to_top10),
    };
  } catch (err) {
    console.error('fetchUserRank exception:', err);
    return null;
  }
}
