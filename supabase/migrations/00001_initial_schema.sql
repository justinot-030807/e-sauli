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
  office_name TEXT NOT NULL DEFAULT 'MarSU Lost & Found Office',
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
('require_school_email', 'true', 'Require school email domain for registration'),
('school_email_domain', 'marsu.edu.ph', 'Allowed school email domain');

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
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'college', ''),
    'student',
    CASE
      WHEN (SELECT value FROM public.system_settings WHERE key = 'require_school_email') = 'true'
        AND NEW.email LIKE '%@' || (SELECT value FROM public.system_settings WHERE key = 'school_email_domain')
      THEN 'approved'
      ELSE 'pending'
    END
  );
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
CREATE POLICY claim_attempts_select_own ON public.claim_attempts FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY claim_attempts_insert ON public.claim_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

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

-- Function to get public profile (hides private fields for non-owners)
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  college TEXT,
  points INTEGER,
  returns_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT p.id, p.nickname, p.college, p.points, p.returns_count, p.created_at
  FROM public.profiles p
  WHERE p.id = target_user_id AND p.deleted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile TO authenticated;

-- Function to get secret question text only (no answer_hmac) for claimants
CREATE OR REPLACE FUNCTION public.get_item_questions(p_item_id UUID)
RETURNS TABLE (
  id UUID,
  question TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT sq.id, sq.question
  FROM public.secret_questions sq
  WHERE sq.item_id = p_item_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_item_questions FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_item_questions TO authenticated;

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
VALUES ('MarSU Lost & Found Office', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], '08:00', '17:00', 'Admin Building, Ground Floor');

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

