BEGIN;

-- Only the person receiving a released item can open a return dispute.
CREATE OR REPLACE FUNCTION public.validate_return_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  recipient uuid;
BEGIN
  IF NOT public.is_active_member() OR NEW.raised_by IS DISTINCT FROM auth.uid()
    OR NEW.status <> 'open' OR coalesce(length(trim(NEW.reason)), 0) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Hindi maaaring isumite ang dispute.';
  END IF;

  SELECT CASE WHEN i.type = 'lost' THEN i.user_id ELSE c.claimant_id END INTO recipient
  FROM public.items i JOIN public.claims c ON c.item_id = i.id AND c.status = 'approved'
  WHERE i.id = NEW.item_id AND i.status = 'released' AND NOT i.is_hidden AND i.deleted_at IS NULL
  FOR UPDATE OF i;

  IF recipient IS DISTINCT FROM auth.uid() OR EXISTS (
    SELECT 1 FROM public.disputes WHERE item_id = NEW.item_id AND status = 'open'
  ) THEN RAISE EXCEPTION 'Hindi maaaring isumite ang dispute para sa gamit na ito.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_return_dispute() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_return_dispute_trigger BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.validate_return_dispute();

DROP POLICY IF EXISTS disputes_update_admin ON public.disputes;
REVOKE UPDATE ON public.disputes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS office_settings_update_admin ON public.office_settings;
CREATE POLICY office_settings_active_admin ON public.office_settings FOR UPDATE TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS system_settings_update_admin ON public.system_settings;
CREATE POLICY system_settings_active_admin ON public.system_settings FOR UPDATE TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS audit_log_select_admin ON public.admin_audit_log;
CREATE POLICY audit_log_active_admin ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_active_admin());
DROP POLICY IF EXISTS audit_log_insert_admin ON public.admin_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS claim_lockout_overrides_admin_insert ON public.claim_lockout_overrides;
REVOKE INSERT, UPDATE, DELETE ON public.claim_lockout_overrides FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS job_logs_select_admin ON public.job_logs;
CREATE POLICY job_logs_active_admin ON public.job_logs FOR SELECT TO authenticated
  USING (public.is_active_admin());

-- Found and lost reports record the finder and recipient on opposite sides of the claim.
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

  IF NOT public.is_active_member() THEN
    RAISE EXCEPTION 'Kailangan ng aprubadong account upang kumpirmahin ang pagbabalik.';
  END IF;

  -- Fetch item
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id AND NOT is_hidden AND deleted_at IS NULL FOR UPDATE;
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
  IF (CASE WHEN v_item.type = 'lost' THEN v_item.user_id ELSE v_claim.claimant_id END) <> v_caller_id THEN
    RAISE EXCEPTION 'Only the verified owner can confirm receipt.';
  END IF;

  v_finder_id := CASE WHEN v_item.type = 'lost' THEN v_claim.claimant_id ELSE v_item.user_id END;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_finder_id::text || ':' || v_caller_id::text, 0));

  -- Check if item has an open dispute
  IF EXISTS (SELECT 1 FROM public.disputes WHERE item_id = p_item_id AND status = 'open') THEN
    RAISE EXCEPTION 'Cannot confirm return while item is in open dispute.';
  END IF;

  -- Anti-farming check (Section 18):
  -- Max 2 point-earning returns per finder-owner pair per month in Asia/Manila
  SELECT COUNT(*) INTO v_pair_count
  FROM public.items i
  JOIN public.claims c ON c.item_id = i.id
  WHERE (CASE WHEN i.type = 'lost' THEN c.claimant_id ELSE i.user_id END) = v_finder_id
    AND (CASE WHEN i.type = 'lost' THEN i.user_id ELSE c.claimant_id END) = v_caller_id
    AND c.status = 'approved'
    AND i.status = 'returned'
    AND date_trunc('month', i.released_at AT TIME ZONE 'Asia/Manila') = date_trunc('month', now() AT TIME ZONE 'Asia/Manila');

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
  v_finder_id uuid;
  v_owner_id uuid;
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
    FOR UPDATE OF i SKIP LOCKED
  LOOP
    -- Get approved claim
    SELECT * INTO v_claim FROM public.claims WHERE item_id = v_rec.id AND status = 'approved' LIMIT 1;
    IF v_claim IS NOT NULL THEN
      v_finder_id := CASE WHEN v_rec.type = 'lost' THEN v_claim.claimant_id ELSE v_rec.user_id END;
      v_owner_id := CASE WHEN v_rec.type = 'lost' THEN v_rec.user_id ELSE v_claim.claimant_id END;
      IF NOT pg_try_advisory_xact_lock(hashtextextended(v_finder_id::text || ':' || v_owner_id::text, 0)) THEN
        CONTINUE;
      END IF;
      -- Check anti-farming pair limit
      SELECT COUNT(*) INTO v_pair_count
      FROM public.items i
      JOIN public.claims c ON c.item_id = i.id
      WHERE (CASE WHEN i.type = 'lost' THEN c.claimant_id ELSE i.user_id END) = v_finder_id
        AND (CASE WHEN i.type = 'lost' THEN i.user_id ELSE c.claimant_id END) = v_owner_id
        AND c.status = 'approved'
        AND i.status = 'returned'
        AND date_trunc('month', i.released_at AT TIME ZONE 'Asia/Manila') = date_trunc('month', now() AT TIME ZONE 'Asia/Manila');

      IF v_pair_count < 2 THEN
        -- Award +50 finder points (+0 owner confirmation bonus per Section 18)
        INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
        VALUES (v_finder_id, v_rec.id, 50, 'Auto-confirmed return pagkatapos ng 7 araw', 'auto_return_' || v_rec.id)
        ON CONFLICT (event_key) DO NOTHING;
      END IF;

      -- Update item status to returned
      UPDATE public.items SET status = 'returned' WHERE id = v_rec.id;

      -- Increment finder returns_count
      UPDATE public.profiles SET returns_count = returns_count + 1 WHERE id = v_finder_id;

      -- Speedy check
      v_is_speedy := (v_rec.released_at IS NOT NULL AND (v_rec.released_at - v_rec.created_at) <= interval '24 hours');

      -- Evaluate badges
      SELECT returns_count INTO v_new_returns_count FROM public.profiles WHERE id = v_finder_id;
      FOR v_badge IN SELECT * FROM public.badges LOOP
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_finder_id AND badge_id = v_badge.id) THEN
          IF (v_badge.code = 'first_find' AND v_new_returns_count >= 1)
             OR (v_badge.code = 'good_samaritan' AND v_new_returns_count >= 5)
             OR (v_badge.code = 'campus_hero' AND v_new_returns_count >= 10)
             OR (v_badge.code = 'legend' AND v_new_returns_count >= 25)
             OR (v_badge.code = 'speedy' AND v_is_speedy)
             OR (v_badge.code = 'honest_heart' AND (v_rec.category IN ('Cash', 'ID/Cards', 'Wallet')))
          THEN
            INSERT INTO public.user_badges (user_id, badge_id)
            VALUES (v_finder_id, v_badge.id)
            ON CONFLICT (user_id, badge_id) DO NOTHING;
          END IF;
        END IF;
      END LOOP;

      -- Notify both parties
      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_finder_id,
        'return_confirmed',
        'Awtomatikong nakumpirma ang pagkakabalik ng "' || v_rec.title || '".',
        v_rec.id,
        false
      );

      INSERT INTO public.notifications (user_id, type, body, item_id, read)
      VALUES (
        v_owner_id,
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
    FOR UPDATE SKIP LOCKED
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
  v_owner_id uuid;
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
    FOR UPDATE OF i SKIP LOCKED
  LOOP
    SELECT * INTO v_claim FROM public.claims WHERE item_id = v_rec.id AND status = 'approved' LIMIT 1;
    IF v_claim IS NOT NULL THEN
      v_owner_id := CASE WHEN v_rec.type = 'lost' THEN v_rec.user_id ELSE v_claim.claimant_id END;
      -- Check if reminder already sent
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_owner_id
          AND item_id = v_rec.id
          AND type = 'day5_reminder'
      ) THEN
        INSERT INTO public.notifications (user_id, type, body, item_id, read)
        VALUES (
          v_owner_id,
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

-- Keep the existing admin API while checking active privileges and preserving UUID types in audit records.
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(
  p_target_user_id UUID,
  p_new_status public.approval_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_user_name TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_target_user_id;

  -- Update approval status directly
  UPDATE public.profiles
  SET approval_status = p_new_status
  WHERE id = p_target_user_id;

  -- Create immutable audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'user_approval_updated',
    'profile',
    p_target_user_id,
    jsonb_build_object('new_status', p_new_status, 'user_name', v_user_name)
  );

  -- Notify user
  INSERT INTO public.notifications (user_id, type, body, read)
  VALUES (
    p_target_user_id,
    'account_approval_updated',
    CASE
      WHEN p_new_status = 'approved' THEN 'Naaprubahan na ng administrator ang iyong E-Sauli account. Maaari ka nang mag-post at mag-claim!'
      WHEN p_new_status = 'rejected' THEN 'Hindi naaprubahan ang iyong account registration. Makipag-ugnayan sa Lost & Found office.'
      ELSE 'Binago ang katayuan ng iyong account.'
    END,
    false
  );
END;
$$;

--- 2. RPC: ADMIN SET USER SUSPENDED ---
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(
  p_target_user_id UUID,
  p_is_suspended BOOLEAN,
  p_reason TEXT DEFAULT 'Violation of community policies'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  UPDATE public.profiles
  SET is_suspended = p_is_suspended
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_is_suspended THEN 'user_suspended' ELSE 'user_restored' END,
    'profile',
    p_target_user_id,
    jsonb_build_object('is_suspended', p_is_suspended, 'reason', p_reason)
  );

  INSERT INTO public.notifications (user_id, type, body, read)
  VALUES (
    p_target_user_id,
    'account_suspension_status',
    CASE
      WHEN p_is_suspended THEN 'Pansamantalang sinuspinde ang iyong account. Dahilan: ' || p_reason
      ELSE 'Naibalik na ang access ng iyong E-Sauli account.'
    END,
    false
  );
END;
$$;

--- 3. RPC: ADMIN MODERATE ITEM (HIDE / RESTORE / SOFT-DELETE) ---
CREATE OR REPLACE FUNCTION public.admin_moderate_item(
  p_target_item_id UUID,
  p_action TEXT, -- 'hide', 'restore', 'delete'
  p_reason TEXT DEFAULT 'Administrative review'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_item_title TEXT;
  v_item_owner UUID;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT title, user_id INTO v_item_title, v_item_owner FROM public.items WHERE id = p_target_item_id;

  IF p_action = 'hide' THEN
    UPDATE public.items SET is_hidden = true WHERE id = p_target_item_id;
  ELSIF p_action = 'restore' THEN
    UPDATE public.items SET is_hidden = false, deleted_at = NULL WHERE id = p_target_item_id;
  ELSIF p_action = 'delete' THEN
    UPDATE public.items SET deleted_at = now() WHERE id = p_target_item_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'item_moderated_' || p_action,
    'item',
    p_target_item_id,
    jsonb_build_object('action', p_action, 'reason', p_reason, 'title', v_item_title)
  );

  IF v_item_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, body, item_id, read)
    VALUES (
      v_item_owner,
      'item_moderation_alert',
      'Inaksyunan ng admin ang iyong post ("' || COALESCE(v_item_title, 'Item') || '"): ' || p_action || '. Dahilan: ' || p_reason,
      p_target_item_id,
      false
    );
  END IF;
END;
$$;

--- 4. RPC: ADMIN RESOLVE DISPUTE ---
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_resolution_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_dispute RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF v_dispute IS NULL THEN
    RAISE EXCEPTION 'Dispute not found.';
  END IF;

  UPDATE public.disputes
  SET status = 'resolved'
  WHERE id = p_dispute_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'dispute_resolved',
    'dispute',
    p_dispute_id,
    jsonb_build_object('item_id', v_dispute.item_id, 'resolution', p_resolution_note)
  );

  -- Notify dispute raiser
  INSERT INTO public.notifications (user_id, type, body, item_id, read)
  VALUES (
    v_dispute.raised_by,
    'dispute_resolved',
    'Naresolba na ng administrator ang iyong dispute. Resolusyon: ' || p_resolution_note,
    v_dispute.item_id,
    false
  );
END;
$$;

--- 5. RPC: ADMIN POINT REVERSALS (SECTION 23) ---
-- Creates an offsetting negative points_log entry, records reason, admin, and audit log.
CREATE OR REPLACE FUNCTION public.admin_reverse_points(
  p_target_user_id UUID,
  p_target_item_id UUID,
  p_points_to_deduct INTEGER,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF p_points_to_deduct <= 0 THEN
    RAISE EXCEPTION 'Points to deduct must be greater than zero.';
  END IF;

  -- Insert offsetting negative points_log entry
  INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
  VALUES (
    p_target_user_id,
    p_target_item_id,
    -p_points_to_deduct,
    'Reversal by Admin: ' || p_reason,
    'reversal_' || gen_random_uuid()
  );

  -- Record in admin audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'points_reversed',
    'profile',
    p_target_user_id,
    jsonb_build_object(
      'points_deducted', p_points_to_deduct,
      'reason', p_reason,
      'item_id', p_target_item_id
    )
  );

  -- Notify user
  INSERT INTO public.notifications (user_id, type, body, item_id, read)
  VALUES (
    p_target_user_id,
    'points_reversal_notice',
    'Ibinawas ang ' || p_points_to_deduct || ' Aura points mula sa iyong account ng administrator. Dahilan: ' || p_reason,
    p_target_item_id,
    false
  );
END;
$$;

--- 6. RPC: ADMIN OVERRIDE CLAIM LOCKOUT ---
CREATE OR REPLACE FUNCTION public.admin_override_lockout(
  p_item_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Identity verified in office'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  -- Insert override record
  INSERT INTO public.claim_lockout_overrides (item_id, user_id, admin_id, reason)
  VALUES (p_item_id, p_user_id, v_admin_id, p_reason);

  -- Record audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'claim_lockout_overridden',
    'claim_lockout',
    p_item_id,
    jsonb_build_object('user_id', p_user_id, 'reason', p_reason)
  );

  -- Notify user
  INSERT INTO public.notifications (user_id, type, body, item_id, read)
  VALUES (
    p_user_id,
    'lockout_overridden',
    'Inalis ng administrator ang lockout sa iyong claim verification. Maaari ka nang sumubok muli o mag-claim sa opisina.',
    p_item_id,
    false
  );
END;
$$;

--- 7. RPC: GET ADMIN STATS DASHBOARD ---
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_total_users INTEGER;
  v_pending_users INTEGER;
  v_active_items INTEGER;
  v_office_items INTEGER;
  v_pending_claims INTEGER;
  v_open_disputes INTEGER;
  v_total_returns INTEGER;
  v_unresolved_reports INTEGER;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total_users FROM public.profiles WHERE deleted_at IS NULL;
  SELECT COUNT(*)::INTEGER INTO v_pending_users FROM public.profiles WHERE approval_status = 'pending' AND deleted_at IS NULL;
  SELECT COUNT(*)::INTEGER INTO v_active_items FROM public.items WHERE status IN ('open', 'claim_requested', 'verified') AND is_hidden = false AND deleted_at IS NULL;
  SELECT COUNT(*)::INTEGER INTO v_office_items FROM public.items WHERE requires_office_pickup = true AND status != 'returned' AND deleted_at IS NULL;
  SELECT COUNT(*)::INTEGER INTO v_pending_claims FROM public.claims WHERE status = 'pending';
  SELECT COUNT(*)::INTEGER INTO v_open_disputes FROM public.disputes WHERE status = 'open';
  SELECT COUNT(*)::INTEGER INTO v_total_returns FROM public.items WHERE status = 'returned';
  SELECT COUNT(*)::INTEGER INTO v_unresolved_reports FROM public.reports;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'pending_users', v_pending_users,
    'active_items', v_active_items,
    'office_items', v_office_items,
    'pending_claims', v_pending_claims,
    'open_disputes', v_open_disputes,
    'total_returns', v_total_returns,
    'unresolved_reports', v_unresolved_reports
  );
END;
$$;

--- PERMISSIONS ---

COMMIT;
