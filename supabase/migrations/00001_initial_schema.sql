-- TIMEZONE: Asia/Manila (All daily/monthly/office-hours logic uses Asia/Manila)

--- EXTENSIONS ---
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--- CUSTOM TYPES ---
CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE item_type AS ENUM ('lost', 'found');
CREATE TYPE item_status AS ENUM ('open', 'claim_requested', 'verified', 'released', 'returned', 'expired');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'auto_rejected');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved');
CREATE TYPE report_target_type AS ENUM ('item', 'message', 'user');
CREATE TYPE report_reason AS ENUM ('spam', 'fake', 'inappropriate', 'scam');
CREATE TYPE job_status AS ENUM ('running', 'success', 'failed');

--- TABLES ---

-- 1. profiles
CREATE TABLE public.profiles (
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

CREATE UNIQUE INDEX idx_profiles_student_id ON public.profiles (lower(trim(student_id))) WHERE deleted_at IS NULL;

-- 2. items
CREATE TABLE public.items (
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
CREATE TABLE public.item_private (
  item_id UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  amount_hmac TEXT,
  private_details TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. claims
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  claimant_id UUID NOT NULL REFERENCES public.profiles(id),
  proof_text TEXT NOT NULL,
  status claim_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_claims_one_approved ON public.claims (item_id) WHERE status = 'approved';

-- 5. claim_attempts
CREATE TABLE public.claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  matched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. secret_questions
CREATE TABLE public.secret_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hmac TEXT NOT NULL
);

-- 7. messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id),
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  raised_by UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  requirement INTEGER NOT NULL DEFAULT 1
);

-- 11. user_badges
CREATE TABLE public.user_badges (
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  badge_id UUID NOT NULL REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- 12. points_log
CREATE TABLE public.points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  item_id UUID REFERENCES public.items(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE, -- idempotent: prevents duplicate rewards
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. thank_you_notes
CREATE TABLE public.thank_you_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id),
  from_user UUID NOT NULL REFERENCES public.profiles(id),
  to_user UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  target_type report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_reports_reporter_target ON public.reports (reporter_id, target_type, target_id);

-- 15. office_settings
CREATE TABLE public.office_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name TEXT NOT NULL DEFAULT 'Campus Lost & Found Office',
  open_days TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  location_note TEXT DEFAULT 'Admin Building, Ground Floor'
);

-- 16. system_settings
CREATE TABLE public.system_settings (
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
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. job_logs
CREATE TABLE public.job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status job_status NOT NULL DEFAULT 'running',
  error_message TEXT
);

-- 19. claim_lockout_overrides
CREATE TABLE public.claim_lockout_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);

--- INDEXES ---
CREATE INDEX idx_items_feed ON public.items (status, type, deleted_at, is_hidden);
CREATE INDEX idx_items_user_id ON public.items (user_id);
CREATE INDEX idx_items_category ON public.items (category);
CREATE INDEX idx_items_location ON public.items (location);
CREATE INDEX idx_items_date_happened ON public.items (date_happened);
CREATE INDEX idx_items_expires_at ON public.items (expires_at) WHERE status IN ('open', 'claim_requested');

CREATE INDEX idx_claims_item_id ON public.claims (item_id);
CREATE INDEX idx_claims_claimant_id ON public.claims (claimant_id);

CREATE INDEX idx_claim_attempts_item_user ON public.claim_attempts (item_id, user_id);

CREATE INDEX idx_messages_claim_created ON public.messages (claim_id, created_at);

CREATE INDEX idx_notifications_user_read_created ON public.notifications (user_id, read, created_at);

CREATE INDEX idx_points_log_user_created ON public.points_log (user_id, created_at);

CREATE INDEX idx_reports_target ON public.reports (target_type, target_id);

--- TRIGGERS ---

-- TRIGGER: Create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'college', ''),
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

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

