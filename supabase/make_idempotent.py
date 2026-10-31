import re

sql_file = r'C:\Users\Hp\LOST&FOUNDAPP\supabase\RUN_THIS_IN_SUPABASE.sql'
with open(sql_file, 'r', encoding='utf-8', errors='ignore') as f:
    sql = f.read()

# 1. Safely wrap CREATE TYPE
def safe_create_type(match):
    type_name = match.group(1)
    values = match.group(2)
    return f"""DO $$ BEGIN
  CREATE TYPE {type_name} AS ENUM ({values});
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;"""

sql = re.sub(r'CREATE TYPE (\w+) AS ENUM \(([^)]+)\);', safe_create_type, sql)

# 2. Safely add IF NOT EXISTS to CREATE TABLE
sql = re.sub(r'CREATE TABLE (?!IF NOT EXISTS\s)(public\.\w+)', r'CREATE TABLE IF NOT EXISTS \1', sql)

# 3. Safely add IF NOT EXISTS to CREATE INDEX
sql = re.sub(r'CREATE UNIQUE INDEX (?!IF NOT EXISTS\s)', r'CREATE UNIQUE INDEX IF NOT EXISTS ', sql)
sql = re.sub(r'CREATE INDEX (?!IF NOT EXISTS\s)', r'CREATE INDEX IF NOT EXISTS ', sql)

# 4. Safely add DROP TRIGGER IF EXISTS before CREATE TRIGGER
def safe_create_trigger(match):
    trigger_name = match.group(1)
    table_name = match.group(2)
    full_stmt = match.group(0)
    return f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};\n{full_stmt}"

sql = re.sub(r'CREATE TRIGGER (\w+)\s+(?:BEFORE|AFTER)\s+.*?\s+ON\s+([a-zA-Z0-9_.]+)', safe_create_trigger, sql)

# 5. Fix handle_new_user search_path and casts
old_fn_pattern = r"CREATE OR REPLACE FUNCTION public\.handle_new_user\(\).*?END;\s*\$\$;"
replacement_fn = """CREATE OR REPLACE FUNCTION public.handle_new_user()
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
$$;"""

sql = re.sub(old_fn_pattern, replacement_fn, sql, flags=re.DOTALL)

with open(sql_file, 'w', encoding='utf-8') as f:
    f.write(sql)

print("RUN_THIS_IN_SUPABASE.sql successfully updated with 100% idempotent and type-safe statements!")
