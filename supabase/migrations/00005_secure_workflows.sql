
BEGIN;

-- Private identity data is visible to its owner and active administrators.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND approval_status = 'approved'
      AND NOT is_suspended AND deleted_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND approval_status = 'approved' AND NOT is_suspended
      AND deleted_at IS NULL AND consent_accepted_at IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.is_active_admin(), public.is_active_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin(), public.is_active_member() TO authenticated;

DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_read_admin ON public.profiles FOR SELECT TO authenticated
  USING (public.is_active_admin());

-- Privileged updates run through existing moderation and points functions.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (consent_accepted_at, nickname) ON public.profiles TO authenticated;
DROP TRIGGER IF EXISTS protect_profile_columns_trigger ON public.profiles;

ALTER TABLE public.claim_attempts ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'legacy';

-- Report, approval and release transitions use the validated functions below.
REVOKE INSERT, UPDATE ON public.items, public.claims FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.item_private, public.secret_questions FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- Preserve legacy verification details in the private table before correcting public rows.
INSERT INTO public.item_private (item_id, private_details)
SELECT id, concat_ws(E'\n', title, description, 'Stored photo: ' || photo_path)
FROM public.items
WHERE type = 'found' AND category IN ('Cash', 'Wallet', 'ID/Cards')
ON CONFLICT (item_id) DO UPDATE
SET private_details = concat_ws(E'\n', nullif(item_private.private_details, ''), excluded.private_details);

UPDATE public.items SET
  title = CASE category WHEN 'Cash' THEN 'Cash found' WHEN 'Wallet' THEN 'Wallet found' ELSE 'ID/Card found' END,
  description = 'Sa Lost & Found Office kukumpirmahin ang pagmamay-ari.',
  photo_path = NULL
WHERE type = 'found' AND category IN ('Cash', 'Wallet', 'ID/Cards');

CREATE OR REPLACE FUNCTION public.create_item_report(
  p_type public.item_type, p_title text, p_description text, p_category text, p_location text,
  p_date date, p_photo_path text, p_private_details text, p_question text, p_answer_hash text
)
RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  report public.items;
  sensitive boolean := p_category IN ('Cash', 'Wallet', 'ID/Cards');
BEGIN
  IF NOT public.is_active_member() THEN
    RAISE EXCEPTION 'Kailangan ng aprubadong account upang mag-ulat.';
  END IF;
  IF p_type IS NULL OR coalesce(length(trim(p_title)), 0) NOT BETWEEN 1 AND 160
    OR coalesce(length(trim(p_description)), 0) NOT BETWEEN 1 AND 3000
    OR coalesce(length(trim(p_category)), 0) NOT BETWEEN 1 AND 80
    OR coalesce(length(trim(p_location)), 0) NOT BETWEEN 1 AND 160
    OR p_date IS NULL OR p_date > (now() AT TIME ZONE 'Asia/Manila')::date
    OR coalesce(length(p_private_details), 0) > 3000 THEN
    RAISE EXCEPTION 'Suriin ang pamagat, deskripsyon, lokasyon, at petsa ng ulat.';
  END IF;
  IF p_question IS NOT NULL OR p_answer_hash IS NOT NULL THEN
    IF p_type <> 'found' OR coalesce(length(trim(p_question)), 0) NOT BETWEEN 1 AND 240
      OR p_answer_hash IS NULL OR p_answer_hash !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'Suriin ang lihim na tanong at sagot.';
    END IF;
  END IF;
  -- Serialize daily limit checks and photo assignment for this account.
  PERFORM 1 FROM public.profiles WHERE id = actor FOR UPDATE;
  IF p_photo_path IS NOT NULL AND (sensitive OR NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'item-photos'
      AND name = p_photo_path AND (storage.foldername(name))[1] = actor::text
  ) OR EXISTS (SELECT 1 FROM public.items WHERE photo_path = p_photo_path)) THEN
    RAISE EXCEPTION 'Hindi maaaring gamitin ang larawang ito.';
  END IF;

  INSERT INTO public.items (user_id, type, title, description, category, location, date_happened, photo_path)
  VALUES (actor, p_type,
    CASE WHEN sensitive AND p_type = 'found' THEN
      CASE p_category WHEN 'Cash' THEN 'Cash found' WHEN 'Wallet' THEN 'Wallet found' ELSE 'ID/Card found' END
      ELSE trim(p_title) END,
    CASE WHEN sensitive AND p_type = 'found' THEN 'Sa Lost & Found Office kukumpirmahin ang pagmamay-ari.'
      ELSE trim(p_description) END,
    p_category, p_location, p_date, p_photo_path)
  RETURNING * INTO report;

  IF p_private_details IS NOT NULL OR (sensitive AND p_type = 'found') THEN
    INSERT INTO public.item_private (item_id, private_details)
    VALUES (report.id, CASE WHEN sensitive AND p_type = 'found'
      THEN concat_ws(E'\n', trim(p_title), trim(p_description), p_private_details)
      ELSE p_private_details END);
  END IF;
  IF p_question IS NOT NULL THEN
    INSERT INTO public.secret_questions (item_id, question, answer_hmac)
    VALUES (report.id, trim(p_question), p_answer_hash);
  END IF;

  WITH candidates AS (
    SELECT i.id, i.user_id, i.date_happened, i.category, i.location
    FROM public.items i
    WHERE i.type <> report.type AND i.user_id <> actor AND i.status = 'open'
      AND NOT i.is_hidden AND i.deleted_at IS NULL
    ORDER BY i.created_at DESC, i.id
    LIMIT 50
  ), matches AS (
    SELECT * FROM candidates c
    WHERE (CASE WHEN lower(c.category) = lower(report.category) THEN 40 ELSE 0 END
      + CASE WHEN lower(c.location) = lower(report.location) THEN 30 ELSE 0 END
      + CASE WHEN abs(c.date_happened - report.date_happened) <= 1 THEN 20
          WHEN abs(c.date_happened - report.date_happened) <= 3 THEN 10 ELSE 0 END)
      >= coalesce((SELECT value::integer FROM public.system_settings WHERE key = 'match_score_threshold'), 70)
  )
  INSERT INTO public.notifications (user_id, type, body, item_id)
  SELECT m.user_id, 'possible_match', 'May bagong ulat na maaaring tumugma sa gamit mo.', report.id FROM matches m
  UNION ALL
  SELECT actor, 'possible_match', 'May naunang ulat na maaaring tumugma sa gamit mo.', m.id FROM matches m;

  RETURN report;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_item_questions(p_item_id uuid)
RETURNS TABLE (id uuid, question text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT q.id, q.question
  FROM public.secret_questions q JOIN public.items i ON i.id = q.item_id
  WHERE i.id = p_item_id AND i.type = 'found' AND i.status IN ('open', 'claim_requested')
    AND NOT i.is_hidden AND i.deleted_at IS NULL AND public.is_active_member()
  ORDER BY q.id;
$$;

CREATE OR REPLACE FUNCTION public.verify_claim_secret(p_item_id uuid, p_answer_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  failures integer;
  matches boolean;
  override_at timestamptz;
  expected_hash text;
BEGIN
  IF NOT public.is_active_member() OR p_answer_hash IS NULL OR p_answer_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Hindi maaaring beripikahin ang claim.';
  END IF;
  PERFORM 1 FROM public.items WHERE id = p_item_id AND type = 'found'
    AND status IN ('open', 'claim_requested') AND user_id <> actor
    AND NOT is_hidden AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hindi maaaring i-claim ang gamit na ito.'; END IF;

  SELECT answer_hmac INTO expected_hash FROM public.secret_questions
    WHERE item_id = p_item_id ORDER BY id LIMIT 1;
  IF expected_hash IS NULL THEN RAISE EXCEPTION 'Walang lihim na tanong para sa gamit na ito.'; END IF;

  SELECT max(created_at) INTO override_at FROM public.claim_lockout_overrides
    WHERE item_id = p_item_id AND user_id = actor;
  SELECT count(*) INTO failures FROM public.claim_attempts
    WHERE item_id = p_item_id AND user_id = actor AND NOT matched
      AND created_at > coalesce(override_at, '-infinity'::timestamptz);
  IF failures >= 3 THEN
    RAISE EXCEPTION 'Naabot ang 3 maling pagtatangka. Makipag-ugnayan sa Lost & Found Office.';
  END IF;

  matches := expected_hash = p_answer_hash;
  INSERT INTO public.claim_attempts (item_id, user_id, matched, created_at, verification_method)
  VALUES (p_item_id, actor, matches, clock_timestamp(), 'secret_question');
  IF NOT matches AND failures = 2 THEN
    INSERT INTO public.notifications (user_id, type, body, item_id)
    VALUES (actor, 'claim_lockout', 'Naabot ang 3 maling pagtatangka. Makipag-ugnayan sa Lost & Found Office.', p_item_id);
  END IF;
  RETURN matches;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_item_claim(p_item_id uuid, p_proof text, p_type public.item_type)
RETURNS public.claims LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  report public.items;
  claim_row public.claims;
BEGIN
  IF NOT public.is_active_member() OR coalesce(length(trim(p_proof)), 0) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Kailangan ng aprubadong account at wastong patunay.';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = actor FOR UPDATE;
  SELECT * INTO report FROM public.items WHERE id = p_item_id AND type = p_type
    AND user_id <> actor AND NOT is_hidden AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hindi maaaring i-claim ang gamit na ito.'; END IF;

  SELECT * INTO claim_row FROM public.claims WHERE item_id = p_item_id AND claimant_id = actor
    AND status IN ('pending', 'approved') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN claim_row; END IF;

  IF report.status NOT IN ('open', 'claim_requested') THEN
    RAISE EXCEPTION 'Sarado na ang claim para sa gamit na ito.';
  END IF;
  IF p_type = 'found'
    AND EXISTS (SELECT 1 FROM public.secret_questions WHERE item_id = p_item_id)
    AND NOT EXISTS (SELECT 1 FROM public.claim_attempts
      WHERE item_id = p_item_id AND user_id = actor AND matched AND verification_method = 'secret_question') THEN
    RAISE EXCEPTION 'Sagutan muna ang lihim na tanong bago magsumite ng claim.';
  END IF;

  INSERT INTO public.claims (item_id, claimant_id, proof_text)
  VALUES (p_item_id, actor, trim(p_proof)) RETURNING * INTO claim_row;
  UPDATE public.items SET status = 'claim_requested' WHERE id = p_item_id AND status = 'open';
  IF p_type = 'lost' THEN
    INSERT INTO public.messages (claim_id, sender_id, body) VALUES (claim_row.id, actor, trim(p_proof));
  ELSE
    INSERT INTO public.notifications (user_id, type, body, item_id)
    VALUES (report.user_id, 'claim_requested', 'May bagong claim para sa iyong ulat.', p_item_id);
  END IF;
  RETURN claim_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_item_claim(p_claim_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  report public.items;
  claimant uuid;
BEGIN
  IF NOT public.is_active_member() OR p_approve IS NULL THEN RAISE EXCEPTION 'Walang pahintulot.'; END IF;
  SELECT i.* INTO report FROM public.items i JOIN public.claims c ON c.item_id = i.id
    WHERE c.id = p_claim_id FOR UPDATE OF i;
  IF NOT FOUND OR report.is_hidden OR report.deleted_at IS NOT NULL
    OR report.status NOT IN ('open', 'claim_requested')
    OR (report.user_id <> actor AND NOT public.is_active_admin()) THEN
    RAISE EXCEPTION 'Hindi maaaring baguhin ang claim na ito.';
  END IF;
  IF p_approve AND report.requires_office_pickup AND NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Sa Lost & Found Office inaaprubahan ang claim para sa gamit na ito.';
  END IF;

  UPDATE public.claims SET status = CASE WHEN p_approve THEN 'approved'::public.claim_status ELSE 'rejected'::public.claim_status END
  WHERE id = p_claim_id AND status = 'pending'
  RETURNING claimant_id INTO claimant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nasuri na ang claim na ito.'; END IF;

  IF NOT p_approve THEN
    INSERT INTO public.notifications (user_id, type, body, item_id)
    VALUES (claimant, 'claim_rejected', 'Tinanggihan ang iyong claim para sa gamit na ito.', report.id);
    IF NOT EXISTS (SELECT 1 FROM public.claims WHERE item_id = report.id AND status = 'pending') THEN
      UPDATE public.items SET status = 'open' WHERE id = report.id AND status = 'claim_requested';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  report public.items;
  claimant uuid;
  finder uuid;
  recipient uuid;
  office_time timestamp := now() AT TIME ZONE 'Asia/Manila';
  days integer;
BEGIN
  IF NOT public.is_active_member() THEN RAISE EXCEPTION 'Walang pahintulot.'; END IF;
  SELECT * INTO report FROM public.items WHERE id = p_item_id AND NOT is_hidden AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR report.status <> 'verified' THEN RAISE EXCEPTION 'Kailangan muna ng aprubadong claim.'; END IF;

  SELECT claimant_id INTO claimant FROM public.claims WHERE item_id = p_item_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Kailangan muna ng aprubadong claim.'; END IF;
  finder := CASE WHEN report.type = 'lost' THEN claimant ELSE report.user_id END;
  recipient := CASE WHEN report.type = 'lost' THEN report.user_id ELSE claimant END;

  IF report.requires_office_pickup THEN
    IF NOT public.is_active_admin() THEN
      RAISE EXCEPTION 'Admin ng Lost & Found Office lamang ang maaaring mag-release nito.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.office_settings
      WHERE trim(to_char(office_time, 'Day')) = ANY (open_days)
      AND office_time::time >= open_time AND office_time::time < close_time) THEN
      RAISE EXCEPTION 'Sarado ang Lost & Found Office o wala pang iskedyul.';
    END IF;
  ELSIF finder <> auth.uid() AND NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Walang pahintulot na i-release ang gamit na ito.';
  END IF;

  SELECT coalesce((SELECT value::integer FROM public.system_settings WHERE key = 'auto_confirm_days'), 7) INTO days;
  UPDATE public.items SET status = 'released', released_at = now(),
    auto_confirm_at = now() + make_interval(days => days) WHERE id = p_item_id;
  INSERT INTO public.notifications (user_id, type, body, item_id)
  VALUES (recipient, 'confirm_receipt_reminder', 'Nai-release na ang gamit. Kumpirmahin ang pagkakatanggap.', p_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.surrender_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_active_member() THEN RAISE EXCEPTION 'Walang pahintulot.'; END IF;
  UPDATE public.items SET requires_office_pickup = true
  WHERE id = p_item_id AND deleted_at IS NULL AND NOT is_hidden
    AND status IN ('open', 'claim_requested', 'verified')
    AND (user_id = auth.uid() OR public.is_active_admin());
  IF NOT FOUND THEN RAISE EXCEPTION 'Hindi maaaring ilipat ang gamit na ito sa opisina.'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.create_item_report(public.item_type, text, text, text, text, date, text, text, text, text),
  public.submit_item_claim(uuid, text, public.item_type), public.resolve_item_claim(uuid, boolean),
  public.release_item(uuid), public.surrender_item(uuid),
  public.get_item_questions(uuid), public.verify_claim_secret(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_item_report(public.item_type, text, text, text, text, date, text, text, text, text),
  public.submit_item_claim(uuid, text, public.item_type), public.resolve_item_claim(uuid, boolean),
  public.release_item(uuid), public.surrender_item(uuid),
  public.get_item_questions(uuid), public.verify_claim_secret(uuid, text)
TO authenticated;

DROP POLICY IF EXISTS item_photos_authenticated_read ON storage.objects;
CREATE POLICY item_photos_read_visible ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'item-photos' AND public.is_active_member() AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.items i WHERE i.photo_path = storage.objects.name
      AND i.category NOT IN ('Cash', 'Wallet', 'ID/Cards') AND i.deleted_at IS NULL AND NOT i.is_hidden)
  )
);
DROP POLICY IF EXISTS item_photos_user_delete ON storage.objects;
CREATE POLICY item_photos_delete_unattached ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'item-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.photo_path = storage.objects.name)
);

-- Deliver chat alerts from the persisted message and its authorized participants.
CREATE FUNCTION public.notify_claim_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, body, item_id)
  SELECT CASE WHEN NEW.sender_id = c.claimant_id THEN i.user_id ELSE c.claimant_id END,
    'new_message', 'May bagong mensahe tungkol sa iyong ulat o claim.', i.id
  FROM public.claims c JOIN public.items i ON i.id = c.item_id WHERE c.id = NEW.claim_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_claim_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_claim_message_trigger AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_claim_message();

REVOKE INSERT ON public.messages FROM PUBLIC, anon, authenticated;
GRANT INSERT (claim_id, sender_id, body) ON public.messages TO authenticated;
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert_participants ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND public.is_active_member() AND length(trim(body)) BETWEEN 1 AND 3000
  AND EXISTS (SELECT 1 FROM public.claims c JOIN public.items i ON i.id = c.item_id
    WHERE c.id = claim_id AND c.status IN ('pending', 'approved')
      AND NOT i.is_hidden AND i.deleted_at IS NULL
      AND (c.claimant_id = auth.uid() OR i.user_id = auth.uid()))
);

DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY['messages', 'notifications'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_confirm_released_items(), public.expire_stale_items(),
  public.remind_unconfirmed_claims() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_confirm_released_items(), public.expire_stale_items(),
  public.remind_unconfirmed_claims() TO service_role;

COMMIT;
