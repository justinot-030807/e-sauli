import os

base = r'C:\Users\Hp\LOST&FOUNDAPP\supabase'
f1 = os.path.join(base, 'migrations', '00001_initial_schema.sql')
f2 = os.path.join(base, 'migrations', '00002_return_and_jobs_rpc.sql')
f3 = os.path.join(base, 'migrations', '00003_leaderboard_rpc.sql')
f4 = os.path.join(base, 'migrations', '00004_admin_and_moderation_rpc.sql')
f_seed = os.path.join(base, 'seed.sql')

auth_seed = """
-- ==============================================================================
-- Seed Mock Auth Users to satisfy foreign keys
-- ==============================================================================
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'maria@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'jc@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'elena@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'mark@marsu.edu.ph', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
"""

out = os.path.join(base, 'RUN_THIS_IN_SUPABASE.sql')
with open(out, 'w', encoding='utf-8') as outfile:
    for f in [f1, f2, f3, f4]:
        outfile.write(f'-- START OF {os.path.basename(f)}\n')
        with open(f, 'r', encoding='utf-8', errors='ignore') as infile:
            outfile.write(infile.read())
        outfile.write(f'\n-- END OF {os.path.basename(f)}\n\n')
    
    outfile.write(auth_seed + '\n')
    
    outfile.write(f'-- START OF seed.sql\n')
    with open(f_seed, 'r', encoding='utf-8', errors='ignore') as infile:
        outfile.write(infile.read())
    outfile.write(f'\n-- END OF seed.sql\n')

print('Complete combined SQL generated successfully at:', out)
