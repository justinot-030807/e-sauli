import os

schema_file = r'C:\Users\Hp\LOST&FOUNDAPP\supabase\migrations\00001_initial_schema.sql'
with open(schema_file, 'r', encoding='utf-8', errors='ignore') as f:
    sql = f.read()

old_fn = """CREATE OR REPLACE FUNCTION public.handle_new_user()
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
      WHEN (SELECT value FROM public.system_settings WHERE key = 'require_school_email') = 'false'
      THEN 'approved'
      ELSE 'pending'
    END
  );
  RETURN NEW;
END;
$$;"""

# Replace with properly cast version
new_fn = """CREATE OR REPLACE FUNCTION public.handle_new_user()
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

sql = sql.replace(old_fn.replace('\r\n', '\n'), new_fn.replace('\r\n', '\n'))
sql = sql.replace(old_fn, new_fn)

with open(schema_file, 'w', encoding='utf-8') as f:
    f.write(sql)
print("Updated 00001_initial_schema.sql")

# Also let's re-run build_combined_sql.py
os.system(r'python "C:\Users\Hp\LOST&FOUNDAPP\supabase\build_combined_sql.py"')
