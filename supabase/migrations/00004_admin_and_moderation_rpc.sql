-- ==============================================================================
-- Migration 00004: Admin Dashboard, Moderation, Audit Trails & Point Reversals
-- ==============================================================================
-- Timezone: Asia/Manila

--- 1. RPC: ADMIN SET USER APPROVAL ---
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
  v_admin_role public.user_role;
  v_user_name TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_target_user_id::TEXT,
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
  v_admin_role public.user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_target_user_id::TEXT,
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
  v_admin_role public.user_role;
  v_item_title TEXT;
  v_item_owner UUID;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_target_item_id::TEXT,
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
  v_admin_role public.user_role;
  v_dispute RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_dispute_id::TEXT,
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
  v_admin_role public.user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_target_user_id::TEXT,
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
  v_admin_role public.user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
    p_item_id::TEXT,
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
  v_admin_role public.user_role;
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

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role != 'admin' THEN
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
REVOKE EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, public.approval_status) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, public.approval_status) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_suspended(UUID, BOOLEAN, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspended(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_item(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_item(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_reverse_points(UUID, UUID, INTEGER, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reverse_points(UUID, UUID, INTEGER, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_override_lockout(UUID, UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_lockout(UUID, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
