import os
import re

base = r'C:\Users\Hp\LOST&FOUNDAPP\supabase'
f1 = os.path.join(base, 'migrations', '00001_initial_schema.sql')
f2 = os.path.join(base, 'migrations', '00002_return_and_jobs_rpc.sql')
f3 = os.path.join(base, 'migrations', '00003_leaderboard_rpc.sql')
f4 = os.path.join(base, 'migrations', '00004_admin_and_moderation_rpc.sql')
f_seed = os.path.join(base, 'seed.sql')

# Read migrations
with open(f1, 'r', encoding='utf-8', errors='ignore') as fp:
    sql1 = fp.read()
with open(f2, 'r', encoding='utf-8', errors='ignore') as fp:
    sql2 = fp.read()
with open(f3, 'r', encoding='utf-8', errors='ignore') as fp:
    sql3 = fp.read()
with open(f4, 'r', encoding='utf-8', errors='ignore') as fp:
    sql4 = fp.read()
with open(f_seed, 'r', encoding='utf-8', errors='ignore') as fp:
    sql_seed = fp.read()

# 1. Update handle_new_user to ensure student_id is never blank
fn_robust = """CREATE OR REPLACE FUNCTION public.handle_new_user()
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
$$;"""

sql1 = re.sub(r"CREATE OR REPLACE FUNCTION public\.handle_new_user\(\).*?END;\s*\$\$;", fn_robust, sql1, flags=re.DOTALL)

# 2. Update seed.sql profiles insert with ON CONFLICT DO UPDATE
old_profiles_insert = """  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status, points, returns_count, consent_accepted_at)
  VALUES
    (v_admin_id, 'Chief Administrator', 'ADMIN-2026', 'AdminChief', 'Admin', 'admin', 'approved', 500, 10, now()),
    (v_user1_id, 'Maria Santos', '2023-10021', 'MariaS', 'College of Information and Computing Sciences', 'student', 'approved', 245, 5, now()),
    (v_user2_id, 'Juan Carlos Reyes', '2022-10442', 'JC_Reyes', 'College of Business and Accountancy', 'student', 'approved', 180, 4, now()),
    (v_user3_id, 'Alyssa Nicole Cruz', '2024-10115', 'AlyssaC', 'College of Engineering', 'student', 'approved', 125, 3, now()),
    (v_user4_id, 'Mark Kenneth Dizon', '2023-10993', 'KenKen', 'College of Arts and Sciences', 'student', 'approved', 95, 2, now());"""

new_profiles_insert = """  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status, points, returns_count, consent_accepted_at)
  VALUES
    (v_admin_id, 'Chief Administrator', 'ADMIN-2026', 'AdminChief', 'Admin', 'admin', 'approved', 500, 10, now()),
    (v_user1_id, 'Maria Santos', '2023-10021', 'MariaS', 'College of Information and Computing Sciences', 'student', 'approved', 245, 5, now()),
    (v_user2_id, 'Juan Carlos Reyes', '2022-10442', 'JC_Reyes', 'College of Business and Accountancy', 'student', 'approved', 180, 4, now()),
    (v_user3_id, 'Alyssa Nicole Cruz', '2024-10115', 'AlyssaC', 'College of Engineering', 'student', 'approved', 125, 3, now()),
    (v_user4_id, 'Mark Kenneth Dizon', '2023-10993', 'KenKen', 'College of Arts and Sciences', 'student', 'approved', 95, 2, now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    student_id = EXCLUDED.student_id,
    nickname = EXCLUDED.nickname,
    college = EXCLUDED.college,
    role = EXCLUDED.role,
    approval_status = EXCLUDED.approval_status,
    points = EXCLUDED.points,
    returns_count = EXCLUDED.returns_count,
    consent_accepted_at = EXCLUDED.consent_accepted_at;"""

sql_seed = sql_seed.replace(old_profiles_insert.replace('\r\n', '\n'), new_profiles_insert.replace('\r\n', '\n'))
sql_seed = sql_seed.replace(old_profiles_insert, new_profiles_insert)

# 3. Rich Auth Users Insert
auth_seed = """
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
"""

# Combine all
combined_raw = f"""-- START OF 00001_initial_schema.sql
{sql1}
-- END OF 00001_initial_schema.sql

-- START OF 00002_return_and_jobs_rpc.sql
{sql2}
-- END OF 00002_return_and_jobs_rpc.sql

-- START OF 00003_leaderboard_rpc.sql
{sql3}
-- END OF 00003_leaderboard_rpc.sql

-- START OF 00004_admin_and_moderation_rpc.sql
{sql4}
-- END OF 00004_admin_and_moderation_rpc.sql

{auth_seed}

-- START OF seed.sql
{sql_seed}
-- END OF seed.sql
"""

# Apply Idempotent transformations
def safe_create_type(match):
    type_name = match.group(1)
    values = match.group(2)
    return f"""DO $$ BEGIN
  CREATE TYPE {type_name} AS ENUM ({values});
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;"""

sql = re.sub(r'CREATE TYPE (\w+) AS ENUM \(([^)]+)\);', safe_create_type, combined_raw)
sql = re.sub(r'CREATE TABLE (?!IF NOT EXISTS\s)(public\.\w+)', r'CREATE TABLE IF NOT EXISTS \1', sql)
sql = re.sub(r'CREATE UNIQUE INDEX (?!IF NOT EXISTS\s)', r'CREATE UNIQUE INDEX IF NOT EXISTS ', sql)
sql = re.sub(r'CREATE INDEX (?!IF NOT EXISTS\s)', r'CREATE INDEX IF NOT EXISTS ', sql)

def safe_create_trigger(match):
    trigger_name = match.group(1)
    table_name = match.group(2)
    full_stmt = match.group(0)
    return f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};\n{full_stmt}"

sql = re.sub(r'CREATE TRIGGER (\w+)\s+(?:BEFORE|AFTER)\s+.*?\s+ON\s+([a-zA-Z0-9_.]+)', safe_create_trigger, sql)

out_file = os.path.join(base, 'RUN_THIS_IN_SUPABASE.sql')
with open(out_file, 'w', encoding='utf-8') as fp:
    fp.write(sql)

print('Updated RUN_THIS_IN_SUPABASE.sql successfully!')
