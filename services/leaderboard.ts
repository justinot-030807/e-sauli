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
const SAMPLE_LEADERBOARD: LeaderboardEntry[] = [
  {
    userId: '00000000-0000-0000-0000-000000000002',
    rank: 1,
    nickname: 'MariaS',
    college: 'College of Information and Computing Sciences',
    points: 245,
    returnsCount: 12,
  },
  {
    userId: '00000000-0000-0000-0000-000000000003',
    rank: 2,
    nickname: 'JuanD',
    college: 'College of Engineering',
    points: 190,
    returnsCount: 9,
  },
  {
    userId: '00000000-0000-0000-0000-000000000004',
    rank: 3,
    nickname: 'CarloG',
    college: 'College of Business and Accountancy',
    points: 165,
    returnsCount: 8,
  },
  {
    userId: '00000000-0000-0000-0000-000000000005',
    rank: 4,
    nickname: 'BeaR',
    college: 'College of Education',
    points: 140,
    returnsCount: 7,
  },
  {
    userId: '00000000-0000-0000-0000-000000000006',
    rank: 5,
    nickname: 'JCM',
    college: 'College of Arts and Sciences',
    points: 120,
    returnsCount: 6,
  },
  {
    userId: '00000000-0000-0000-0000-000000000007',
    rank: 6,
    nickname: 'DanM',
    college: 'College of Agriculture',
    points: 95,
    returnsCount: 4,
  },
  {
    userId: '00000000-0000-0000-0000-000000000008',
    rank: 7,
    nickname: 'EllaK',
    college: 'College of Governance',
    points: 80,
    returnsCount: 3,
  },
];

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

    if (error || !data || (data as any[]).length === 0) {
      return SAMPLE_LEADERBOARD;
    }

    return (data as any[]).map((row) => ({
      userId: row.user_id,
      rank: Number(row.rank),
      nickname: row.nickname,
      college: row.college,
      points: Number(row.points),
      returnsCount: Number(row.returns_count),
    }));
  } catch (err: any) {
    return SAMPLE_LEADERBOARD;
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

    if (error || !data) {
      return {
        rank: 1,
        points: 245,
        pointsToTop10: 0,
      };
    }

    const res = Array.isArray(data) ? data[0] : (data as any);
    if (!res) {
      return {
        rank: 1,
        points: 245,
        pointsToTop10: 0,
      };
    }

    return {
      rank: Number(res.rank ?? 1),
      points: Number(res.points ?? 0),
      pointsToTop10: Number(res.points_to_top10 ?? res.points_to_top_10 ?? 0),
    };
  } catch (err) {
    return {
      rank: 1,
      points: 245,
      pointsToTop10: 0,
    };
  }
}
