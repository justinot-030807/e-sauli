-- ==============================================================================
-- Migration 00003: Privacy-Safe Leaderboard & Ranking Functions
-- ==============================================================================
-- Timezone: Asia/Manila (All 'This Month' and 'This Week' calculations use Asia/Manila)
-- Privacy: Displays ONLY nickname, college, points, returns_count.
--          NEVER displays full_name, student_id, or email (Section 20).

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_timeframe TEXT DEFAULT 'all_time',
  p_college TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  rank BIGINT,
  nickname TEXT,
  college TEXT,
  points INTEGER,
  returns_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_timeframe = 'month' THEN
    RETURN QUERY
    WITH user_monthly AS (
      SELECT
        pl.user_id AS uid,
        COALESCE(SUM(pl.points), 0)::INTEGER AS m_points
      FROM public.points_log pl
      WHERE pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
      GROUP BY pl.user_id
    )
    SELECT
      p.id AS user_id,
      ROW_NUMBER() OVER (ORDER BY um.m_points DESC, p.returns_count DESC, p.created_at ASC) AS rank,
      p.nickname,
      p.college,
      um.m_points AS points,
      p.returns_count
    FROM public.profiles p
    JOIN user_monthly um ON um.uid = p.id
    WHERE p.approval_status = 'approved'
      AND p.is_suspended = false
      AND p.deleted_at IS NULL
      AND (p_college IS NULL OR p.college = p_college)
      AND um.m_points > 0
    ORDER BY rank ASC
    LIMIT p_limit;

  ELSIF p_timeframe = 'week' THEN
    RETURN QUERY
    WITH user_weekly AS (
      SELECT
        pl.user_id AS uid,
        COALESCE(SUM(pl.points), 0)::INTEGER AS w_points
      FROM public.points_log pl
      WHERE pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
      GROUP BY pl.user_id
    )
    SELECT
      p.id AS user_id,
      ROW_NUMBER() OVER (ORDER BY uw.w_points DESC, p.returns_count DESC, p.created_at ASC) AS rank,
      p.nickname,
      p.college,
      uw.w_points AS points,
      p.returns_count
    FROM public.profiles p
    JOIN user_weekly uw ON uw.uid = p.id
    WHERE p.approval_status = 'approved'
      AND p.is_suspended = false
      AND p.deleted_at IS NULL
      AND (p_college IS NULL OR p.college = p_college)
      AND uw.w_points > 0
    ORDER BY rank ASC
    LIMIT p_limit;

  ELSE
    -- Default: 'all_time'
    RETURN QUERY
    SELECT
      p.id AS user_id,
      ROW_NUMBER() OVER (ORDER BY p.points DESC, p.returns_count DESC, p.created_at ASC) AS rank,
      p.nickname,
      p.college,
      p.points,
      p.returns_count
    FROM public.profiles p
    WHERE p.approval_status = 'approved'
      AND p.is_suspended = false
      AND p.deleted_at IS NULL
      AND (p_college IS NULL OR p.college = p_college)
    ORDER BY rank ASC
    LIMIT p_limit;
  END IF;
END;
$$;

--- GET USER RANK ---
CREATE OR REPLACE FUNCTION public.get_user_rank(
  p_user_id UUID,
  p_timeframe TEXT DEFAULT 'all_time',
  p_college TEXT DEFAULT NULL
)
RETURNS TABLE (
  rank BIGINT,
  points INTEGER,
  points_to_top10 INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_rank BIGINT := NULL;
  v_user_points INTEGER := 0;
  v_top10_points INTEGER := 0;
  v_diff INTEGER := 0;
BEGIN
  IF p_timeframe = 'month' THEN
    WITH ranked AS (
      SELECT
        p.id AS uid,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pl.points), 0) DESC, p.returns_count DESC, p.created_at ASC) AS r,
        COALESCE(SUM(pl.points), 0)::INTEGER AS pts
      FROM public.profiles p
      LEFT JOIN public.points_log pl 
        ON pl.user_id = p.id 
        AND pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
      WHERE p.approval_status = 'approved'
        AND p.is_suspended = false
        AND p.deleted_at IS NULL
        AND (p_college IS NULL OR p.college = p_college)
      GROUP BY p.id, p.returns_count, p.created_at
    )
    SELECT r, pts INTO v_user_rank, v_user_points
    FROM ranked WHERE uid = p_user_id;

    -- 10th place points
    SELECT pts INTO v_top10_points FROM (
      SELECT pts FROM (
        SELECT COALESCE(SUM(pl.points), 0)::INTEGER AS pts
        FROM public.profiles p
        LEFT JOIN public.points_log pl 
          ON pl.user_id = p.id 
          AND pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
        WHERE p.approval_status = 'approved'
          AND p.is_suspended = false
          AND p.deleted_at IS NULL
          AND (p_college IS NULL OR p.college = p_college)
        GROUP BY p.id, p.returns_count, p.created_at
        ORDER BY pts DESC
        LIMIT 10
      ) t ORDER BY pts ASC LIMIT 1
    ) sub;

  ELSIF p_timeframe = 'week' THEN
    WITH ranked AS (
      SELECT
        p.id AS uid,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pl.points), 0) DESC, p.returns_count DESC, p.created_at ASC) AS r,
        COALESCE(SUM(pl.points), 0)::INTEGER AS pts
      FROM public.profiles p
      LEFT JOIN public.points_log pl 
        ON pl.user_id = p.id 
        AND pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
      WHERE p.approval_status = 'approved'
        AND p.is_suspended = false
        AND p.deleted_at IS NULL
        AND (p_college IS NULL OR p.college = p_college)
      GROUP BY p.id, p.returns_count, p.created_at
    )
    SELECT r, pts INTO v_user_rank, v_user_points
    FROM ranked WHERE uid = p_user_id;

    -- 10th place points
    SELECT pts INTO v_top10_points FROM (
      SELECT pts FROM (
        SELECT COALESCE(SUM(pl.points), 0)::INTEGER AS pts
        FROM public.profiles p
        LEFT JOIN public.points_log pl 
          ON pl.user_id = p.id 
          AND pl.created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
        WHERE p.approval_status = 'approved'
          AND p.is_suspended = false
          AND p.deleted_at IS NULL
          AND (p_college IS NULL OR p.college = p_college)
        GROUP BY p.id, p.returns_count, p.created_at
        ORDER BY pts DESC
        LIMIT 10
      ) t ORDER BY pts ASC LIMIT 1
    ) sub;

  ELSE
    -- all_time
    WITH ranked AS (
      SELECT
        p.id AS uid,
        ROW_NUMBER() OVER (ORDER BY p.points DESC, p.returns_count DESC, p.created_at ASC) AS r,
        p.points AS pts
      FROM public.profiles p
      WHERE p.approval_status = 'approved'
        AND p.is_suspended = false
        AND p.deleted_at IS NULL
        AND (p_college IS NULL OR p.college = p_college)
    )
    SELECT r, pts INTO v_user_rank, v_user_points
    FROM ranked WHERE uid = p_user_id;

    -- 10th place points
    SELECT points INTO v_top10_points FROM (
      SELECT points FROM public.profiles p
      WHERE p.approval_status = 'approved'
        AND p.is_suspended = false
        AND p.deleted_at IS NULL
        AND (p_college IS NULL OR p.college = p_college)
      ORDER BY points DESC
      LIMIT 10
    ) sub ORDER BY points ASC LIMIT 1;
  END IF;

  IF v_user_rank IS NOT NULL AND v_user_rank > 10 THEN
    v_diff := GREATEST(0, (COALESCE(v_top10_points, 0) - v_user_points) + 1);
  ELSE
    v_diff := 0;
  END IF;

  RETURN QUERY SELECT COALESCE(v_user_rank, 0::BIGINT), COALESCE(v_user_points, 0), v_diff;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(TEXT, TEXT, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_rank(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID, TEXT, TEXT) TO authenticated;
