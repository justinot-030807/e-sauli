-- START OF 00001_initial_schema.sql
-- TIMEZONE: Asia/Manila (All daily/monthly/office-hours logic uses Asia/Manila)

--- EXTENSIONS ---
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--- CUSTOM TYPES ---
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE item_type AS ENUM ('lost', 'found');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('open', 'claim_requested', 'verified', 'released', 'returned', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'auto_rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('open', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE report_target_type AS ENUM ('item', 'message', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('spam', 'fake', 'inappropriate', 'scam');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('running', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--- TABLES ---

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  college TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  approval_status approval_status NOT NULL DEFAULT 'pending',
  consent_accepted_at TIMESTAMPTZ,
  points INTEGER NOT NULL DEFAULT 0,
  returns_count INTEGER NOT NULL DEFAULT 0,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id ON public.profiles (lower(trim(student_id))) WHERE deleted_at IS NULL;

-- 2. items
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type item_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  date_happened DATE NOT NULL,
  photo_path TEXT,
  status item_status NOT NULL DEFAULT 'open',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  requires_office_pickup BOOLEAN NOT NULL DEFAULT false,
  released_at TIMESTAMPTZ,
  auto_confirm_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. item_private
CREATE TABLE IF NOT EXISTS public.item_private (
  item_id UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  amount_hmac TEXT,
  private_details TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. claims
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  claimant_id UUID NOT NULL REFERENCES public.profiles(id),
  proof_text TEXT NOT NULL,
  status claim_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_one_approved ON public.claims (item_id) WHERE status = 'approved';

-- 5. claim_attempts
CREATE TABLE IF NOT EXISTS public.claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  matched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. secret_questions
CREATE TABLE IF NOT EXISTS public.secret_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hmac TEXT NOT NULL
);

-- 7. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id),
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  raised_by UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. badges
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  requirement INTEGER NOT NULL DEFAULT 1
);

-- 11. user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  badge_id UUID NOT NULL REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- 12. points_log
CREATE TABLE IF NOT EXISTS public.points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  item_id UUID REFERENCES public.items(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE, -- idempotent: prevents duplicate rewards
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. thank_you_notes
CREATE TABLE IF NOT EXISTS public.thank_you_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  from_user UUID NOT NULL REFERENCES public.profiles(id),
  to_user UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  target_type report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_reporter_target ON public.reports (reporter_id, target_type, target_id);

-- 15. office_settings
CREATE TABLE IF NOT EXISTS public.office_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name TEXT NOT NULL DEFAULT 'Campus Lost & Found Office',
  open_days TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  location_note TEXT DEFAULT 'Admin Building, Ground Floor'
);

-- 16. system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

INSERT INTO public.system_settings (key, value, description) VALUES
('item_expiration_days', '30', 'Days before items expire'),
('auto_confirm_days', '7', 'Days before auto-confirming returned items'),
('report_threshold', '3', 'Reports before auto-hiding an item'),
('daily_post_limit', '10', 'Maximum posts per user per day'),
('daily_claim_limit', '5', 'Maximum claims per user per day'),
('monthly_return_pair_limit', '2', 'Max point-earning returns per finder-owner pair per month'),
('match_score_threshold', '70', 'Minimum score for item matching notifications'),
('max_found_post_rewards_per_day', '3', 'Maximum point-earning found posts per day'),
('require_school_email', 'false', 'Require school email domain for registration (set false to allow any email for testing)'),
('school_email_domain', 'school.edu.ph', 'Allowed school email domain');

-- 17. admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. job_logs
CREATE TABLE IF NOT EXISTS public.job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status job_status NOT NULL DEFAULT 'running',
  error_message TEXT
);

-- 19. claim_lockout_overrides
CREATE TABLE IF NOT EXISTS public.claim_lockout_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);

--- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_items_feed ON public.items (status, type, deleted_at, is_hidden);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items (user_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category);
CREATE INDEX IF NOT EXISTS idx_items_location ON public.items (location);
CREATE INDEX IF NOT EXISTS idx_items_date_happened ON public.items (date_happened);
CREATE INDEX IF NOT EXISTS idx_items_expires_at ON public.items (expires_at) WHERE status IN ('open', 'claim_requested');

CREATE INDEX IF NOT EXISTS idx_claims_item_id ON public.claims (item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON public.claims (claimant_id);

CREATE INDEX IF NOT EXISTS idx_claim_attempts_item_user ON public.claim_attempts (item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_messages_claim_created ON public.messages (claim_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications (user_id, read, created_at);

CREATE INDEX IF NOT EXISTS idx_points_log_user_created ON public.points_log (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports (target_type, target_id);

--- TRIGGERS ---

-- TRIGGER: Create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_student_id TEXT;
  v_full_name TEXT;
  v_nickname TEXT;
  v_college TEXT;
BEGIN
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Student ' || SUBSTR(NEW.id::text, 1, 6));
  v_student_id := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'student_id'), ''), 'STUDENT-' || SUBSTR(NEW.id::text, 1, 8));
  v_nickname := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''), 'User' || SUBSTR(NEW.id::text, 1, 4));
  v_college := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'college'), ''), 'General');

  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status)
  VALUES (
    NEW.id,
    v_full_name,
    v_student_id,
    v_nickname,
    v_college,
    'student'::public.user_role,
    (CASE
      WHEN (SELECT value FROM public.system_settings WHERE key = 'require_school_email') = 'true'
        AND NEW.email LIKE '%@' || (SELECT value FROM public.system_settings WHERE key = 'school_email_domain')
      THEN 'approved'::public.approval_status
      WHEN (SELECT value FROM public.system_settings WHERE key = 'require_school_email') = 'false'
      THEN 'approved'::public.approval_status
      ELSE 'pending'::public.approval_status
    END)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    student_id = EXCLUDED.student_id,
    nickname = EXCLUDED.nickname,
    college = EXCLUDED.college;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TRIGGER: Prevent protected column updates on profiles
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Students cannot change these columns
  IF (SELECT role FROM public.profiles WHERE id = NEW.id) = 'student' THEN
    NEW.role := OLD.role;
    NEW.approval_status := OLD.approval_status;
    NEW.points := OLD.points;
    NEW.returns_count := OLD.returns_count;
    NEW.is_suspended := OLD.is_suspended;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- TRIGGER: Set requires_office_pickup based on category
CREATE OR REPLACE FUNCTION public.set_office_pickup()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.category IN ('Cash', 'Wallet', 'ID/Cards') THEN
    NEW.requires_office_pickup := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_office_pickup_trigger ON public.items;
CREATE TRIGGER set_office_pickup_trigger
  BEFORE INSERT OR UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_office_pickup();

-- TRIGGER: Set expires_at on item insert
CREATE OR REPLACE FUNCTION public.set_item_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  exp_days INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, 30) INTO exp_days
  FROM public.system_settings WHERE key = 'item_expiration_days';
  
  NEW.expires_at := NEW.created_at + (exp_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_item_expiration_trigger ON public.items;
CREATE TRIGGER set_item_expiration_trigger
  BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_item_expiration();

-- TRIGGER: Sync points from points_log
CREATE OR REPLACE FUNCTION public.sync_profile_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET points = (
    SELECT COALESCE(SUM(points), 0)
    FROM public.points_log
    WHERE user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_points_trigger ON public.points_log;
CREATE TRIGGER sync_points_trigger
  AFTER INSERT ON public.points_log
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_points();

-- TRIGGER: Enforce daily post limit (max 10 posts per day in Asia/Manila)
CREATE OR REPLACE FUNCTION public.enforce_daily_post_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_posts INTEGER;
  today_count INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, 10) INTO max_posts
  FROM public.system_settings WHERE key = 'daily_post_limit';

  SELECT COUNT(*) INTO today_count
  FROM public.items
  WHERE user_id = NEW.user_id
    AND created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila');

  IF today_count >= max_posts THEN
    RAISE EXCEPTION 'Daily post limit exceeded. You may only post % items per day.', max_posts;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_post_limit_trigger ON public.items;
CREATE TRIGGER enforce_daily_post_limit_trigger
  BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_post_limit();

-- TRIGGER: Enforce daily claim limit (max 5 claims per day in Asia/Manila)
CREATE OR REPLACE FUNCTION public.enforce_daily_claim_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_claims INTEGER;
  today_count INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, 5) INTO max_claims
  FROM public.system_settings WHERE key = 'daily_claim_limit';

  SELECT COUNT(*) INTO today_count
  FROM public.claims
  WHERE claimant_id = NEW.claimant_id
    AND created_at AT TIME ZONE 'Asia/Manila' >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila');

  IF today_count >= max_claims THEN
    RAISE EXCEPTION 'Daily claim limit exceeded. You may only submit % claims per day.', max_claims;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_claim_limit_trigger ON public.claims;
CREATE TRIGGER enforce_daily_claim_limit_trigger
  BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_claim_limit();

-- TRIGGER: Auto-hide item when valid report threshold is met (e.g. 3 reports)
CREATE OR REPLACE FUNCTION public.handle_report_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  threshold INTEGER;
  report_count INTEGER;
BEGIN
  IF NEW.target_type = 'item' THEN
    SELECT COALESCE(value::INTEGER, 3) INTO threshold
    FROM public.system_settings WHERE key = 'report_threshold';

    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM public.reports
    WHERE target_type = 'item' AND target_id = NEW.target_id;

    IF report_count >= threshold THEN
      UPDATE public.items
      SET is_hidden = true
      WHERE id = NEW.target_id;

      -- Create notification for admins
      INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
      SELECT p.id, 'auto_hide_reported_item', 'item', NEW.target_id,
             jsonb_build_object('reason', 'Exceeded report threshold', 'report_count', report_count)
      FROM public.profiles p
      WHERE p.role = 'admin'
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_report_threshold_trigger ON public.reports;
CREATE TRIGGER handle_report_threshold_trigger
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_threshold();

-- TRIGGER: On claim approval, automatically reject other pending claims and update item status to verified
CREATE OR REPLACE FUNCTION public.handle_claim_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Update item status to verified
    UPDATE public.items
    SET status = 'verified'
    WHERE id = NEW.item_id;

    -- Automatically reject all other pending claims for this item
    UPDATE public.claims
    SET status = 'auto_rejected'
    WHERE item_id = NEW.item_id
      AND id != NEW.id
      AND status = 'pending';

    -- Notify the approved claimant
    INSERT INTO public.notifications (user_id, type, body, item_id)
    VALUES (
      NEW.claimant_id,
      'claim_approved',
      'Your claim has been approved! Proceed with the handover process.',
      NEW.item_id
    );

    -- Notify auto-rejected claimants
    INSERT INTO public.notifications (user_id, type, body, item_id)
    SELECT claimant_id, 'claim_rejected',
           'Another claim has been verified for this item. Your claim was closed.',
           NEW.item_id
    FROM public.claims
    WHERE item_id = NEW.item_id AND id != NEW.id AND status = 'auto_rejected';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_claim_approval_trigger ON public.claims;
CREATE TRIGGER handle_claim_approval_trigger
  AFTER UPDATE OF status ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_claim_approval();

--- RLS POLICIES ---

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thank_you_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_lockout_overrides ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ITEMS POLICIES
CREATE POLICY items_select_active ON public.items FOR SELECT TO authenticated USING (
  (deleted_at IS NULL AND is_hidden = false)
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY items_insert_own ON public.items FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
      AND deleted_at IS NULL
  )
);
CREATE POLICY items_update_own ON public.items FOR UPDATE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ITEM_PRIVATE POLICIES
CREATE POLICY item_private_select ON public.item_private FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.items WHERE items.id = item_private.item_id AND items.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY item_private_insert ON public.item_private FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.items WHERE items.id = item_private.item_id AND items.user_id = auth.uid())
);
CREATE POLICY item_private_update ON public.item_private FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.items WHERE items.id = item_private.item_id AND items.user_id = auth.uid())
);

-- CLAIMS POLICIES
CREATE POLICY claims_select ON public.claims FOR SELECT TO authenticated USING (
  claimant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.items WHERE items.id = claims.item_id AND items.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY claims_insert ON public.claims FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = claimant_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
      AND deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.items WHERE items.id = claims.item_id AND items.user_id = auth.uid()
  )
);
CREATE POLICY claims_update_admin ON public.claims FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (SELECT 1 FROM public.items WHERE items.id = claims.item_id AND items.user_id = auth.uid())
);

-- CLAIM_ATTEMPTS POLICIES
-- Clients cannot directly INSERT match results; inserts are performed solely by trusted SECURITY DEFINER functions
CREATE POLICY claim_attempts_select_own ON public.claim_attempts FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- CLAIM_LOCKOUT_OVERRIDES POLICIES
CREATE POLICY claim_lockout_overrides_select ON public.claim_lockout_overrides FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY claim_lockout_overrides_admin_insert ON public.claim_lockout_overrides FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SECRET_QUESTIONS POLICIES
CREATE POLICY secret_questions_select ON public.secret_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.items WHERE items.id = secret_questions.item_id AND items.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY secret_questions_insert ON public.secret_questions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.items WHERE items.id = secret_questions.item_id AND items.user_id = auth.uid())
);

-- MESSAGES POLICIES
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.claims
    WHERE claims.id = messages.claim_id
      AND (
        claims.claimant_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.items WHERE items.id = claims.item_id AND items.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
  )
);
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
      AND deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.claims
    WHERE claims.id = messages.claim_id
      AND (
        claims.claimant_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.items WHERE items.id = claims.item_id AND items.user_id = auth.uid())
      )
  )
);

-- NOTIFICATIONS POLICIES
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DISPUTES POLICIES
CREATE POLICY disputes_select ON public.disputes FOR SELECT TO authenticated USING (
  raised_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY disputes_insert ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  raised_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
  )
);
CREATE POLICY disputes_update_admin ON public.disputes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- BADGES POLICIES
CREATE POLICY badges_select ON public.badges FOR SELECT TO authenticated USING (true);

-- USER_BADGES POLICIES
CREATE POLICY user_badges_select ON public.user_badges FOR SELECT TO authenticated USING (true);

-- POINTS_LOG POLICIES
CREATE POLICY points_log_select_own ON public.points_log FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- THANK_YOU_NOTES POLICIES
CREATE POLICY thank_you_notes_select ON public.thank_you_notes FOR SELECT TO authenticated USING (
  from_user = auth.uid()
  OR to_user = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY thank_you_notes_insert ON public.thank_you_notes FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid());

-- REPORTS POLICIES
CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated USING (
  reporter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated WITH CHECK (
  reporter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
  )
);

-- OFFICE_SETTINGS POLICIES
CREATE POLICY office_settings_select ON public.office_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY office_settings_update_admin ON public.office_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SYSTEM_SETTINGS POLICIES
CREATE POLICY system_settings_select ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY system_settings_update_admin ON public.system_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ADMIN_AUDIT_LOG POLICIES
CREATE POLICY audit_log_select_admin ON public.admin_audit_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY audit_log_insert_admin ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- JOB_LOGS POLICIES
CREATE POLICY job_logs_select_admin ON public.job_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


--- HELPER FUNCTIONS ---

-- Function to get public profile (hides private fields for non-owners, checks caller state)
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  college TEXT,
  points INTEGER,
  returns_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_suspended = true) THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nickname, p.college, p.points, p.returns_count, p.created_at
  FROM public.profiles p
  WHERE p.id = target_user_id AND p.deleted_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile TO authenticated;

-- Function to get secret question text only (no answer_hmac) for claimants
CREATE OR REPLACE FUNCTION public.get_item_questions(p_item_id UUID)
RETURNS TABLE (
  id UUID,
  question TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_suspended = true OR approval_status != 'approved')
  ) THEN
    RAISE EXCEPTION 'Account is unapproved or suspended';
  END IF;

  RETURN QUERY
  SELECT sq.id, sq.question
  FROM public.secret_questions sq
  WHERE sq.item_id = p_item_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_item_questions FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_item_questions TO authenticated;

-- Function to verify secret question answer or cash amount hash with 3-attempt lockout
CREATE OR REPLACE FUNCTION public.verify_claim_secret(
  p_item_id UUID,
  p_answer_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID;
  caller_status public.approval_status;
  caller_suspended BOOLEAN;
  item_poster_id UUID;
  failed_attempts INTEGER;
  is_match BOOLEAN := false;
  correct_hash TEXT;
  has_override BOOLEAN := false;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT approval_status, is_suspended INTO caller_status, caller_suspended
  FROM public.profiles WHERE id = caller_id AND deleted_at IS NULL;

  IF caller_status != 'approved' THEN
    RAISE EXCEPTION 'Only approved students may verify claims';
  END IF;

  IF caller_suspended = true THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  -- Block self-claim verification
  SELECT user_id INTO item_poster_id
  FROM public.items WHERE id = p_item_id;

  IF item_poster_id = caller_id THEN
    RAISE EXCEPTION 'You cannot verify or claim your own post';
  END IF;

  -- Check if admin override exists
  SELECT EXISTS(
    SELECT 1 FROM public.claim_lockout_overrides
    WHERE item_id = p_item_id AND user_id = caller_id
  ) INTO has_override;

  -- Check failed attempts count
  SELECT COUNT(*) INTO failed_attempts
  FROM public.claim_attempts
  WHERE item_id = p_item_id AND user_id = caller_id AND matched = false;

  IF failed_attempts >= 3 AND NOT has_override THEN
    RAISE EXCEPTION 'Maximum verification attempts (3) exceeded for this item. Verification is locked. Please contact the administrator.';
  END IF;

  -- Get correct hash from secret_questions or item_private
  SELECT answer_hmac INTO correct_hash
  FROM public.secret_questions WHERE item_id = p_item_id
  LIMIT 1;

  IF correct_hash IS NULL THEN
    SELECT amount_hmac INTO correct_hash
    FROM public.item_private WHERE item_id = p_item_id;
  END IF;

  IF correct_hash IS NOT NULL AND correct_hash = p_answer_hash THEN
    is_match := true;
  END IF;

  -- Log attempt securely (cannot be written directly by client)
  INSERT INTO public.claim_attempts (item_id, user_id, matched)
  VALUES (p_item_id, caller_id, is_match);

  -- Notify user if they reached the 3-attempt lockout threshold
  IF NOT is_match AND (failed_attempts + 1) >= 3 AND NOT has_override THEN
    INSERT INTO public.notifications (user_id, type, body, item_id)
    VALUES (
      caller_id,
      'claim_lockout',
      'You have reached 3 failed verification attempts for an item. Automated verification is locked. Contact the Lost & Found office for assistance.',
      p_item_id
    );
  END IF;

  RETURN is_match;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_claim_secret FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_claim_secret TO authenticated;

-- Function to safely delete/anonymize user's own account and personal data
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Anonymize profile personal information while preserving audit & transaction history
  UPDATE public.profiles
  SET
    full_name = 'Deleted User',
    student_id = 'DELETED_' || caller_id::text,
    nickname = 'Deleted',
    college = 'None',
    deleted_at = now()
  WHERE id = caller_id;

  -- Soft delete active items posted by this user
  UPDATE public.items
  SET deleted_at = now()
  WHERE user_id = caller_id AND status = 'open';

  -- Log action in audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (caller_id, 'user_account_deleted', 'user', caller_id, jsonb_build_object('self_deleted', true));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account TO authenticated;

--- SEED DATA ---
-- Seed badges
INSERT INTO public.badges (code, name, description, icon, requirement) VALUES
('first_find', 'First Find', 'Returned your first item', '🔍', 1),
('good_samaritan', 'Good Samaritan', 'Returned 5 items', '🤝', 5),
('campus_hero', 'Campus Hero', 'Returned 10 items', '🦸', 10),
('legend', 'Legend', 'Returned 25 items', '👑', 25),
('speedy', 'Speedy', 'Returned an item within 24 hours', '⚡', 1),
('honest_heart', 'Honest Heart', 'Successfully returned Cash or ID/Cards', '💖', 1);

-- Seed office settings
INSERT INTO public.office_settings (office_name, open_days, open_time, close_time, location_note)
VALUES ('Campus Lost & Found Office', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], '08:00', '17:00', 'Admin Building, Ground Floor');

--- ENABLE REALTIME ---
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

--- STORAGE CONFIGURATION ---
-- Create private bucket 'item-photos' (never public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-photos',
  'item-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: item-photos bucket
CREATE POLICY "item_photos_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'item-photos'
);

CREATE POLICY "item_photos_user_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_suspended = false
      AND deleted_at IS NULL
  )
);

CREATE POLICY "item_photos_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);


-- END OF 00001_initial_schema.sql

-- START OF 00002_return_and_jobs_rpc.sql
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

-- END OF 00002_return_and_jobs_rpc.sql

-- START OF 00003_leaderboard_rpc.sql
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

-- END OF 00003_leaderboard_rpc.sql

-- START OF 00004_admin_and_moderation_rpc.sql
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

-- END OF 00004_admin_and_moderation_rpc.sql


-- ==============================================================================
-- Seed Mock Auth Users (Populate raw_user_meta_data so handle_new_user() succeeds)
-- ==============================================================================
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"student_id":"ADMIN-2026","full_name":"Chief Administrator","nickname":"AdminChief","college":"Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'maria@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"student_id":"2023-10021","full_name":"Maria Santos","nickname":"MariaS","college":"College of Information and Computing Sciences"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'jc@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"student_id":"2022-10442","full_name":"Juan Carlos Reyes","nickname":"JC_Reyes","college":"College of Business and Accountancy"}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'alyssa@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"student_id":"2024-10115","full_name":"Alyssa Nicole Cruz","nickname":"AlyssaC","college":"College of Engineering"}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'mark@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"student_id":"2023-10993","full_name":"Mark Kenneth Dizon","nickname":"KenKen","college":"College of Arts and Sciences"}', now(), now())
ON CONFLICT (id) DO UPDATE SET
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  email = EXCLUDED.email;


-- START OF seed.sql
-- ==============================================================================
-- E-Sauli (Campus Lost & Found) - Realistic Sample Seed Data
-- ==============================================================================
-- Run this in the Supabase SQL Editor if you want instant test data for the
-- Home Feed, Leaderboard podium, Categories, Office Custody, and Profile screens.
-- ==============================================================================

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user1_id UUID := '00000000-0000-0000-0000-000000000002';
  v_user2_id UUID := '00000000-0000-0000-0000-000000000003';
  v_user3_id UUID := '00000000-0000-0000-0000-000000000004';
  v_user4_id UUID := '00000000-0000-0000-0000-000000000005';

  v_item1_id UUID := gen_random_uuid();
  v_item2_id UUID := gen_random_uuid();
  v_item3_id UUID := gen_random_uuid();
  v_item4_id UUID := gen_random_uuid();
  v_item5_id UUID := gen_random_uuid();
  v_item6_id UUID := gen_random_uuid();

  v_b_first_find UUID;
  v_b_good_samaritan UUID;
  v_b_campus_hero UUID;
  v_b_honest_heart UUID;
BEGIN
  -- 1. Get Badge IDs
  SELECT id INTO v_b_first_find FROM public.badges WHERE code = 'first_find';
  SELECT id INTO v_b_good_samaritan FROM public.badges WHERE code = 'good_samaritan';
  SELECT id INTO v_b_campus_hero FROM public.badges WHERE code = 'campus_hero';
  SELECT id INTO v_b_honest_heart FROM public.badges WHERE code = 'honest_heart';

  -- 2. Insert Profiles
  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status, points, returns_count, consent_accepted_at)
  VALUES
    (v_admin_id, 'Chief Administrator', 'ADMIN-2026', 'AdminChief', 'Admin', 'admin', 'approved', 500, 10, now()),
    (v_user1_id, 'Maria Santos', '2023-10021', 'MariaS', 'College of Information and Computing Sciences', 'student', 'approved', 245, 5, now()),
    (v_user2_id, 'Juan Carlos Reyes', '2022-10442', 'JC_Reyes', 'College of Business and Accountancy', 'student', 'approved', 180, 4, now()),
    (v_user3_id, 'Alyssa Nicole Cruz', '2024-10115', 'AlyssaC', 'College of Engineering', 'student', 'approved', 125, 3, now()),
    (v_user4_id, 'Mark Kenneth Dizon', '2023-10993', 'KenKen', 'College of Arts and Sciences', 'student', 'approved', 75, 2, now())
  ON CONFLICT (id) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    college = EXCLUDED.college,
    role = EXCLUDED.role,
    approval_status = EXCLUDED.approval_status;

  -- 3. Insert Points Log (source of truth for profiles.points)
  INSERT INTO public.points_log (user_id, points, reason, event_key, created_at)
  VALUES
    (v_user1_id, 50, 'Returned item: Scientific Calculator', 'seed_event_01', now() - interval '10 days'),
    (v_user1_id, 50, 'Returned item: Casio Watch', 'seed_event_02', now() - interval '8 days'),
    (v_user1_id, 50, 'Returned item: Blue Lanyard with ID', 'seed_event_03', now() - interval '5 days'),
    (v_user1_id, 50, 'Returned item: Flash Drive 64GB', 'seed_event_04', now() - interval '3 days'),
    (v_user1_id, 45, 'Bonus points and found item rewards', 'seed_event_05', now() - interval '1 day'),

    (v_user2_id, 50, 'Returned item: Black Leather Wallet', 'seed_event_06', now() - interval '12 days'),
    (v_user2_id, 50, 'Returned item: Umbrella', 'seed_event_07', now() - interval '6 days'),
    (v_user2_id, 50, 'Returned item: Spiral Notebooks', 'seed_event_08', now() - interval '4 days'),
    (v_user2_id, 30, 'Speedy return reward bonus', 'seed_event_09', now() - interval '2 days'),

    (v_user3_id, 50, 'Returned item: Eyeglasses with Case', 'seed_event_10', now() - interval '7 days'),
    (v_user3_id, 50, 'Returned item: Powerbank 10,000mAh', 'seed_event_11', now() - interval '3 days'),
    (v_user3_id, 25, 'Found item post rewards', 'seed_event_12', now() - interval '1 day')
  ON CONFLICT (event_key) DO NOTHING;

  -- 4. Award Badges
  IF v_b_first_find IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at)
    VALUES 
      (v_user1_id, v_b_first_find, now() - interval '10 days'),
      (v_user2_id, v_b_first_find, now() - interval '12 days'),
      (v_user3_id, v_b_first_find, now() - interval '7 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  IF v_b_good_samaritan IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at)
    VALUES (v_user1_id, v_b_good_samaritan, now() - interval '3 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  IF v_b_honest_heart IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at)
    VALUES (v_user2_id, v_b_honest_heart, now() - interval '12 days')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- 5. Insert Realistic Items
  -- Item 1: Found Calculator (Phone/Gadgets)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item1_id, v_user1_id, 'found',
    'Casio FX-991EX ClassWiz Calculator',
    'Naiwan sa Room 304 matapos ang Calculus class. May maliit na sticker ng pusa sa likod ng cover.',
    'Phone/Gadgets', 'Classrooms', CURRENT_DATE - 1, 'open', false, false, now() + interval '29 days'
  );

  -- Secret question for Item 1
  INSERT INTO public.secret_questions (item_id, question, answer_hmac)
  VALUES (v_item1_id, 'Anong kulay at hugis ng sticker sa likod ng calculator?', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');

  -- Item 2: Found Wallet (Sensitive - Auto Office Pickup)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item2_id, v_user2_id, 'found',
    'Brown Leather Bifold Wallet',
    'Naiwan sa mesa malapit sa counter ng University Cafeteria bandang tanghali. May kaunting barya at resibo sa loob.',
    'Wallet', 'Cafeteria', CURRENT_DATE, 'open', true, false, now() + interval '30 days'
  );

  -- Item 3: Lost AquaFlask (Bags)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item3_id, v_user3_id, 'lost',
    'AquaFlask 32oz Mustard Yellow',
    'Nawala sa bleachers ng University Gymnasium habang may PE basketball class kaninang umaga. May gasgas sa ilalim at may boot na black.',
    'Bags', 'Gym', CURRENT_DATE, 'open', false, false, now() + interval '30 days'
  );

  -- Item 4: Found Student ID & Cardholder (Sensitive - Auto Office Pickup)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item4_id, v_user4_id, 'found',
    'Student ID Card sa Blue Lanyard',
    'Napulot sa 2nd floor Library reading section. Nasa leather card holder na kulay asul. I-surrender sa Lost & Found Office.',
    'ID/Cards', 'Library', CURRENT_DATE - 1, 'open', true, false, now() + interval '29 days'
  );

  -- Item 5: Found Motorcycle Key (Keys)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item5_id, v_user1_id, 'found',
    'Susi ng Motor na may Doraemon Keychain',
    'Napulot sa bench sa tapat ng Admin Building entrance bandang 3:00 PM.',
    'Keys', 'Admin Building', CURRENT_DATE - 2, 'open', false, false, now() + interval '28 days'
  );

  -- Item 6: Lost Laptop Charger (Phone/Gadgets)
  INSERT INTO public.items (
    id, user_id, type, title, description, category, location, date_happened, status, requires_office_pickup, is_hidden, expires_at
  ) VALUES (
    v_item6_id, v_user2_id, 'lost',
    '65W Type-C Laptop Fast Charger (Black)',
    'Naiwan sa Computer Lab 2 sa gilid ng workstation 15. Kulay itim na may velcro cord strap.',
    'Phone/Gadgets', 'Classrooms', CURRENT_DATE - 3, 'open', false, false, now() + interval '27 days'
  );

  RAISE NOTICE 'Sample seed data inserted successfully!';
END $$;

-- END OF seed.sql
