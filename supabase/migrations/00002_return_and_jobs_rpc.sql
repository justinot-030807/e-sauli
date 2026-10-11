-- ==============================================================================
-- Migration 00002: Return Confirmation, Gamification, Auto-Confirm, Disputes & Jobs
-- ==============================================================================
-- Timezone: Asia/Manila

--- 1. UPDATE PROTECT_PROFILE_COLUMNS TRIGGER ---
-- Enforces that profiles.points and profiles.returns_count cannot be forged
-- by students, but are reliably synced from points_log and returned items.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = NEW.id) = 'student' THEN
    NEW.role := OLD.role;
    NEW.approval_status := OLD.approval_status;
    NEW.is_suspended := OLD.is_suspended;

    -- Ensure points cannot be directly forged; must reflect sum of points_log
    NEW.points := (
      SELECT COALESCE(SUM(points), 0)
      FROM public.points_log
      WHERE user_id = NEW.id
    );

    -- Ensure returns_count cannot be directly forged; reflects verified returns
    NEW.returns_count := (
      SELECT COUNT(*)::INTEGER
      FROM public.items
      WHERE user_id = NEW.id AND status = 'returned'
    );
  END IF;
  RETURN NEW;
END;
$$;

--- 2. DISPUTE TRIGGER: FREEZE AUTO-CONFIRMATION & NOTIFY ADMINS ---
CREATE OR REPLACE FUNCTION public.handle_dispute_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin RECORD;
  v_item_title TEXT;
BEGIN
  -- Freeze auto-confirmation on item
  UPDATE public.items
  SET auto_confirm_at = NULL
  WHERE id = NEW.item_id;

  SELECT title INTO v_item_title FROM public.items WHERE id = NEW.item_id;

  -- Notify all administrators
  FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, body, item_id, read)
    VALUES (
      v_admin.id,
      'dispute_raised',
      'May bagong dispute na inihain para sa "' || COALESCE(v_item_title, 'Item') || '". Dahilan: ' || NEW.reason,
      NEW.item_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dispute_created ON public.disputes;
CREATE TRIGGER on_dispute_created
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dispute_creation();

--- 3. RPC: CONFIRM ITEM RETURN ---
-- Executed securely when claimant confirms receipt of their item.
CREATE OR REPLACE FUNCTION public.confirm_item_return(
  p_item_id UUID,
  p_thank_you_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_status public.approval_status;
  v_caller_suspended BOOLEAN;
  v_item RECORD;
  v_claim RECORD;
  v_finder_id UUID;
  v_pair_count INTEGER := 0;
  v_is_pair_limit_exceeded BOOLEAN := false;
  v_is_speedy BOOLEAN := false;
  v_base_points INTEGER := 50;
  v_speedy_bonus INTEGER := 0;
  v_thank_you_bonus INTEGER := 0;
  v_owner_bonus INTEGER := 5;
  v_total_points_finder INTEGER := 0;
  v_new_returns_count INTEGER;
  v_badge RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is approved and not suspended
  SELECT approval_status, is_suspended INTO v_caller_status, v_caller_suspended
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_status != 'approved' THEN
    RAISE EXCEPTION 'Account pending admin approval.';
  END IF;

  IF v_caller_suspended THEN
    RAISE EXCEPTION 'Account is suspended.';
  END IF;

  -- Fetch item
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  IF v_item.status != 'released' THEN
    RAISE EXCEPTION 'Item status must be released to confirm return (current status: %)', v_item.status;
  END IF;

  -- Fetch approved claim
  SELECT * INTO v_claim
  FROM public.claims
  WHERE item_id = p_item_id AND status = 'approved';

  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'No approved claim found for this item.';
  END IF;

  -- Only claimant/owner can confirm receipt
  IF v_claim.claimant_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the verified owner can confirm receipt.';
  END IF;

  v_finder_id := v_item.user_id;

  -- Check if item has an open dispute
  IF EXISTS (SELECT 1 FROM public.disputes WHERE item_id = p_item_id AND status = 'open') THEN
    RAISE EXCEPTION 'Cannot confirm return while item is in open dispute.';
  END IF;

  -- Anti-farming check (Section 18):
  -- Max 2 point-earning returns per finder-owner pair per month in Asia/Manila
  SELECT COUNT(*) INTO v_pair_count
  FROM public.items i
  JOIN public.claims c ON c.item_id = i.id
  WHERE i.user_id = v_finder_id
    AND c.claimant_id = v_caller_id
    AND c.status = 'approved'
    AND i.status = 'returned'
    AND date_trunc('month', i.created_at AT TIME ZONE 'Asia/Manila') = date_trunc('month', now() AT TIME ZONE 'Asia/Manila');

  IF v_pair_count >= 2 THEN
    v_is_pair_limit_exceeded := true;
    -- Flag for admin review
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
      v_caller_id,
      'pair_monthly_limit_exceeded',
      'item',
      p_item_id,
      jsonb_build_object(
        'finder_id', v_finder_id,
        'owner_id', v_caller_id,
        'monthly_pair_count', v_pair_count
      )
    );
  END IF;

  -- Calculate speedy bonus (within 24 hours of posting)
  IF v_item.released_at IS NOT NULL AND (v_item.released_at - v_item.created_at) <= interval '24 hours' THEN
    v_is_speedy := true;
  END IF;

  -- Insert points log if anti-farming limit is not exceeded
  IF NOT v_is_pair_limit_exceeded THEN
    -- Finder base points (+50)
    INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
    VALUES (v_finder_id, p_item_id, v_base_points, 'Matagumpay na pagbabalik ng gamit', 'return_' || p_item_id);

    -- Speedy bonus (+15)
    IF v_is_speedy THEN
      v_speedy_bonus := 15;
      INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
      VALUES (v_finder_id, p_item_id, v_speedy_bonus, 'Speedy Return Bonus (sa loob ng 24 oras)', 'speedy_' || p_item_id);
    END IF;

    -- Thank-you note bonus (+5)
    IF p_thank_you_note IS NOT NULL AND length(trim(p_thank_you_note)) > 0 THEN
      v_thank_you_bonus := 5;
      INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
      VALUES (v_finder_id, p_item_id, v_thank_you_bonus, 'Thank You Note Bonus mula sa may-ari', 'thank_you_' || p_item_id);
    END IF;

    -- Owner confirmation bonus (+5)
    INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
    VALUES (v_caller_id, p_item_id, v_owner_bonus, 'Kumpirmasyon ng pagkakatanggap ng sariling gamit', 'owner_confirm_' || p_item_id);

    v_total_points_finder := v_base_points + v_speedy_bonus + v_thank_you_bonus;
  END IF;

  -- Update item status to returned
  UPDATE public.items
  SET status = 'returned'
  WHERE id = p_item_id;

  -- Increment finder returns_count in profiles
  UPDATE public.profiles
  SET returns_count = returns_count + 1
  WHERE id = v_finder_id;

  -- Record thank-you note if provided
  IF p_thank_you_note IS NOT NULL AND length(trim(p_thank_you_note)) > 0 THEN
    INSERT INTO public.thank_you_notes (item_id, from_user, to_user, note)
    VALUES (p_item_id, v_caller_id, v_finder_id, trim(p_thank_you_note));

    INSERT INTO public.notifications (user_id, type, body, item_id, read)
    VALUES (
      v_finder_id,
      'thank_you_received',
      'Nagpadala ng pasasalamat ang may-ari ng "' || v_item.title || '": "' || trim(p_thank_you_note) || '"',
      p_item_id,
      false
    );
  END IF;

  -- Evaluate Badges for finder
  SELECT returns_count INTO v_new_returns_count FROM public.profiles WHERE id = v_finder_id;

  FOR v_badge IN SELECT * FROM public.badges LOOP
    -- Skip if already earned
    IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_finder_id AND badge_id = v_badge.id) THEN
      IF (v_badge.code = 'first_find' AND v_new_returns_count >= 1)
         OR (v_badge.code = 'good_samaritan' AND v_new_returns_count >= 5)
         OR (v_badge.code = 'campus_hero' AND v_new_returns_count >= 10)
         OR (v_badge.code = 'legend' AND v_new_returns_count >= 25)
         OR (v_badge.code = 'speedy' AND v_is_speedy)
         OR (v_badge.code = 'honest_heart' AND (v_item.category IN ('Cash', 'ID/Cards', 'Wallet')))
      THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (v_finder_id, v_badge.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;

        INSERT INTO public.notifications (user_id, type, body, item_id, read)
        VALUES (
          v_finder_id,
          'badge_earned',
          'Binabati ka! Nakuha mo ang bagong badge: ' || v_badge.icon || ' "' || v_badge.name || '" (' || v_badge.description || ')!',
          p_item_id,
          false
        );
      END IF;
    END IF;
  END LOOP;

  -- Notify finder of return confirmation
  INSERT INTO public.notifications (user_id, type, body, item_id, read)
  VALUES (
    v_finder_id,
    'return_confirmed',
    CASE 
      WHEN v_is_pair_limit_exceeded THEN
        'Kinumpirma ng may-ari ang pagkakatanggap ng "' || v_item.title || '". (Naabot ang buwanang limit ng pares - 0 puntos)'
      ELSE
        'Kinumpirma ng may-ari ang pagkakatanggap ng "' || v_item.title || '"! Nakatanggap ka ng +' || v_total_points_finder || ' Aura points. Salamat sa katapatan!'
    END,
    p_item_id,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'base_points', v_base_points,
    'speedy_bonus', v_speedy_bonus,
    'thank_you_bonus', v_thank_you_bonus,
    'owner_bonus', v_owner_bonus,
    'total_points_finder', v_total_points_finder,
    'is_pair_limit_exceeded', v_is_pair_limit_exceeded
  );
END;
$$;

--- 4. RPC: AUTO-CONFIRM RELEASED ITEMS (SCHEDULED JOB) ---
CREATE OR REPLACE FUNCTION public.auto_confirm_released_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := now();
  v_rec RECORD;
  v_claim RECORD;
  v_count INTEGER := 0;
  v_pair_count INTEGER;
  v_new_returns_count INTEGER;
  v_badge RECORD;
  v_is_speedy BOOLEAN;
BEGIN
  FOR v_rec IN 
    SELECT i.* 
    FROM public.items i
    WHERE i.status = 'released'
      AND i.auto_confirm_at IS NOT NULL
      AND i.auto_confirm_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.item_id = i.id AND d.status = 'open'
      )
  LOOP
    -- Get approved claim
    SELECT * INTO v_claim FROM public.claims WHERE item_id = v_rec.id AND status = 'approved' LIMIT 1;
    IF v_claim IS NOT NULL THEN
      -- Check anti-farming pair limit
      SELECT COUNT(*) INTO v_pair_count
      FROM public.items i
      JOIN public.claims c ON c.item_id = i.id
      WHERE i.user_id = v_rec.user_id
        AND c.claimant_id = v_claim.claimant_id
        AND c.status = 'approved'
        AND i.status = 'returned'
        AND date_trunc('month', i.created_at AT TIME ZONE 'Asia/Manila') = date_trunc('month', now() AT TIME ZONE 'Asia/Manila');

      IF v_pair_count < 2 THEN
        -- Award +50 finder points (+0 owner confirmation bonus per Section 18)
        INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
        VALUES (v_rec.user_id, v_rec.id, 50, 'Auto-confirmed return pagkatapos ng 7 araw', 'auto_return_' || v_rec.id)
        ON CONFLICT (event_key) DO NOTHING;
      END IF;

      -- Update item status to returned
      UPDATE public.items SET status = 'returned' WHERE id = v_rec.id;

      -- Increment finder returns_count
      UPDATE public.profiles SET returns_count = returns_count + 1 WHERE id = v_rec.user_id;

      -- Speedy check
      v_is_speedy := (v_rec.released_at IS NOT NULL AND (v_rec.released_at - v_rec.created_at) <= interval '24 hours');

      -- Evaluate badges
      SELECT returns_count INTO v_new_returns_count FROM public.profiles WHERE id = v_rec.user_id;
      FOR v_badge IN SELECT * FROM public.badges LOOP
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_rec.user_id AND badge_id = v_badge.id) THEN
          IF (v_badge.code = 'first_find' AND v_new_returns_count >= 1)
             OR (v_badge.code = 'good_samaritan' AND v_new_returns_count >= 5)
             OR (v_badge.code = 'campus_hero' AND v_new_returns_count >= 10)
             OR (v_badge.code = 'legend' AND v_new_returns_count >= 25)
             OR (v_badge.code = 'speedy' AND v_is_speedy)
             OR (v_badge.code = 'honest_heart' AND (v_rec.category IN ('Cash', 'ID/Cards', 'Wallet')))
          THEN
            INSERT INTO public.user_badges (user_id, badge_id)
            VALUES (v_rec.user_id, v_badge.id)
            ON CONFLICT (user_id, badge_id) DO NOTHING;
          END IF;
        END IF;
      END LOOP;

      -- Notify both parties
      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_rec.user_id,
        'return_confirmed',
        'Awtomatikong nakumpirma ang pagkakabalik ng "' || v_rec.title || '" pagkatapos ng 7 araw (+50 Aura points)!',
        v_rec.id,
        false
      );

      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_claim.claimant_id,
        'return_confirmed',
        'Awtomatikong nakumpirma ang iyong item na "' || v_rec.title || '" pagkatapos ng 7 araw.',
        v_rec.id,
        false
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Log to job_logs
  INSERT INTO public.job_logs (job_name, started_at, completed_at, status, error_message)
  VALUES ('auto_confirm', v_start_time, now(), 'success', 'Processed ' || v_count || ' items.');

  RETURN v_count;
END;
$$;

--- 5. RPC: EXPIRE STALE ITEMS (SCHEDULED JOB) ---
CREATE OR REPLACE FUNCTION public.expire_stale_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := now();
  v_rec RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_rec IN 
    SELECT * 
    FROM public.items
    WHERE status IN ('open', 'claim_requested')
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    IF v_rec.type = 'found' THEN
      -- Found items flag as moved to office
      UPDATE public.items
      SET status = 'expired',
          requires_office_pickup = true
      WHERE id = v_rec.id;

      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_rec.user_id,
        'item_expired',
        'Ang iyong natagpuang gamit ("' || v_rec.title || '") ay nag-expire na at inilipat sa Lost & Found Office.',
        v_rec.id,
        false
      );
    ELSE
      -- Lost items archived
      UPDATE public.items
      SET status = 'expired'
      WHERE id = v_rec.id;

      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_rec.user_id,
        'item_expired',
        'Ang iyong nawalang gamit ("' || v_rec.title || '") ay nag-expire na at inilagay sa archive.',
        v_rec.id,
        false
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- Log to job_logs
  INSERT INTO public.job_logs (job_name, started_at, completed_at, status, error_message)
  VALUES ('item_expiration', v_start_time, now(), 'success', 'Expired ' || v_count || ' items.');

  RETURN v_count;
END;
$$;

--- 6. RPC: REMIND UNCONFIRMED CLAIMS (DAY 5 REMINDER JOB) ---
CREATE OR REPLACE FUNCTION public.remind_unconfirmed_claims()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := now();
  v_rec RECORD;
  v_claim RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT i.*
    FROM public.items i
    WHERE i.status = 'released'
      AND i.auto_confirm_at IS NOT NULL
      AND i.auto_confirm_at > now()
      AND i.auto_confirm_at <= now() + interval '2 days' -- Day 5 of 7
      AND NOT EXISTS (
        SELECT 1 FROM public.disputes d WHERE d.item_id = i.id AND d.status = 'open'
      )
  LOOP
    SELECT * INTO v_claim FROM public.claims WHERE item_id = v_rec.id AND status = 'approved' LIMIT 1;
    IF v_claim IS NOT NULL THEN
      -- Check if reminder already sent
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_claim.claimant_id 
          AND item_id = v_rec.id 
          AND type = 'day5_reminder'
      ) THEN
        INSERT INTO public.notifications (user_id, type, body, item_id, read)
        VALUES (
          v_claim.claimant_id,
          'day5_reminder',
          'Paalala: Mayroon ka na lamang 2 araw para kumpirmahin ang pagkakatanggap ng "' || v_rec.title || '" bago ito awtomatikong kumpirmahin.',
          v_rec.id,
          false
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Log to job_logs
  INSERT INTO public.job_logs (job_name, started_at, completed_at, status, error_message)
  VALUES ('day5_reminder', v_start_time, now(), 'success', 'Sent ' || v_count || ' day-5 reminders.');

  RETURN v_count;
END;
$$;

--- 7. PERMISSIONS ---
REVOKE EXECUTE ON FUNCTION public.confirm_item_return(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_item_return(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_confirm_released_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auto_confirm_released_items() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_stale_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_items() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remind_unconfirmed_claims() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remind_unconfirmed_claims() TO authenticated;
