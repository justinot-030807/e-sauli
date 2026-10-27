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
