-- ==============================================================================
-- FINAL AUTH, LEADERBOARD PERMISSIONS, AND PROFILES FIX
-- ==============================================================================

-- 1. Grant execute on public functions (fixes 'permission denied for function get_leaderboard')
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 2. Grant permissions on schema tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- 3. Confirm all auth users & set valid login password ('password123')
UPDATE auth.users
SET 
  instance_id = '00000000-0000-0000-0000-000000000000',
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  encrypted_password = crypt('password123', gen_salt('bf')),
  aud = 'authenticated',
  role = 'authenticated';

-- 4. Ensure auth identities exist for email login
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT 
  id,
  id,
  json_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
ON CONFLICT DO NOTHING;

-- 5. Auto-approve all user profiles and accept consent
UPDATE public.profiles
SET 
  approval_status = 'approved',
  consent_accepted_at = COALESCE(consent_accepted_at, now());

-- 6. Allow anon read access to public feed, leaderboard, and settings
DROP POLICY IF EXISTS "anon_view_open_items" ON public.items;
CREATE POLICY "anon_view_open_items" ON public.items 
  FOR SELECT TO anon 
  USING (is_hidden = false AND deleted_at IS NULL);

DROP POLICY IF EXISTS "anon_view_profiles" ON public.profiles;
CREATE POLICY "anon_view_profiles" ON public.profiles 
  FOR SELECT TO anon 
  USING (is_suspended = false AND deleted_at IS NULL);

DROP POLICY IF EXISTS "anon_view_points_log" ON public.points_log;
CREATE POLICY "anon_view_points_log" ON public.points_log 
  FOR SELECT TO anon 
  USING (true);

DROP POLICY IF EXISTS "anon_view_settings" ON public.system_settings;
CREATE POLICY "anon_view_settings" ON public.system_settings 
  FOR SELECT TO anon 
  USING (true);
