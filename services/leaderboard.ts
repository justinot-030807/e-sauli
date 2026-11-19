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
  limit = 50,
  isDemo = false,
): Promise<LeaderboardEntry[]> {
  if (isDemo) {
    return SAMPLE_LEADERBOARD.filter((row) => !college || row.college === college)
      .slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
  }

  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_timeframe: timeframe,
    p_college: college || null,
    p_limit: limit,
  });
  if (error) throw new Error('Hindi maikarga ang leaderboard.');

  return data.map((row) => ({
    userId: row.user_id,
    rank: Number(row.rank),
    nickname: row.nickname,
    college: row.college,
    points: Number(row.points),
    returnsCount: Number(row.returns_count),
  }));
}

export async function fetchUserRank(
  userId: string,
  timeframe: LeaderboardTimeframe = 'all_time',
  college?: string | null,
): Promise<UserRankInfo | null> {
  const { data, error } = await supabase.rpc('get_user_rank', {
    p_user_id: userId,
    p_timeframe: timeframe,
    p_college: college || null,
  });
  if (error) throw new Error('Hindi maikarga ang iyong ranggo.');

  const row = data[0];
  return row ? {
    rank: Number(row.rank),
    points: Number(row.points),
    pointsToTop10: Number(row.points_to_top10),
  } : null;
}
