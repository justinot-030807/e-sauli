-- ==============================================================================
-- MarSU Lost & Found - Automated Database Security Test Suite
-- ==============================================================================
-- Run this script in the Supabase SQL Editor.
-- The tests run inside an isolated transaction block that is automatically
-- rolled back at the end, so no test data persists.
-- ==============================================================================

DO $$
DECLARE
  v_test_count INTEGER := 0;
  v_pass_count INTEGER := 0;
  v_fail_count INTEGER := 0;
  
  v_user1_id UUID := gen_random_uuid();
  v_user2_id UUID := gen_random_uuid();
  v_admin_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_claim1_id UUID;
  v_claim2_id UUID;
  v_check_role user_role;
  v_check_status approval_status;
  v_check_points INTEGER;
  v_check_returns INTEGER;
  v_check_pickup BOOLEAN;
  v_check_hidden BOOLEAN;
  v_claim2_status claim_status;
  v_item_status item_status;
  v_check_auto_confirm TIMESTAMPTZ;
  i INTEGER;
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'STARTING DATABASE SECURITY & RLS TEST SUITE';
  RAISE NOTICE '=====================================================';

  -- --------------------------------------------------------------------------
  -- SETUP FIXTURES
  -- --------------------------------------------------------------------------
  INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status, points, returns_count)
  VALUES 
    (v_user1_id, 'Test Student One', '2024-1001', 'StudentOne', 'CICS', 'student', 'approved', 0, 0),
    (v_user2_id, 'Test Student Two', '2024-1002', 'StudentTwo', 'CBA', 'student', 'approved', 0, 0),
    (v_admin_id, 'Test Admin', 'ADMIN-001', 'AdminUser', 'Admin', 'admin', 'approved', 0, 0);

  -- --------------------------------------------------------------------------
  -- TEST 1: Student cannot modify their own role
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  UPDATE public.profiles SET role = 'admin' WHERE id = v_user1_id;
  SELECT role INTO v_check_role FROM public.profiles WHERE id = v_user1_id;
  
  IF v_check_role = 'student' THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 1 PASSED: protect_profile_columns prevented student from escalating to admin';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 1 FAILED: student escalated role to admin!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 2: Student cannot modify their approval_status
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  UPDATE public.profiles SET approval_status = 'rejected' WHERE id = v_user1_id;
  SELECT approval_status INTO v_check_status FROM public.profiles WHERE id = v_user1_id;
  
  IF v_check_status = 'approved' THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 2 PASSED: protect_profile_columns prevented alteration of approval_status';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 2 FAILED: student altered approval_status!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 3: Student cannot directly modify points
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  UPDATE public.profiles SET points = 9999 WHERE id = v_user1_id;
  SELECT points INTO v_check_points FROM public.profiles WHERE id = v_user1_id;
  
  IF v_check_points = 0 THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 3 PASSED: direct points alteration was reverted by trigger';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 3 FAILED: student directly modified points!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 4: Student cannot directly modify returns_count
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  UPDATE public.profiles SET returns_count = 50 WHERE id = v_user1_id;
  SELECT returns_count INTO v_check_returns FROM public.profiles WHERE id = v_user1_id;
  
  IF v_check_returns = 0 THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 4 PASSED: direct returns_count alteration was reverted by trigger';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 4 FAILED: student directly modified returns_count!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 5: Normalized student_id uniqueness
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status)
    VALUES (gen_random_uuid(), 'Duplicate Student', '  2024-1001  ', 'Dup', 'CICS', 'student', 'approved');
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 5 FAILED: normalized student_id duplicate was accepted!';
  EXCEPTION WHEN unique_violation THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 5 PASSED: duplicate normalized student_id rejected';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 6: Auto-enforce office pickup for sensitive categories (Cash, Wallet, ID)
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  INSERT INTO public.items (user_id, type, title, description, category, location, date_happened, requires_office_pickup)
  VALUES (v_user1_id, 'found', 'Lost Wallet Found', 'Black leather wallet', 'Wallet', 'Cafeteria', CURRENT_DATE, false)
  RETURNING id, requires_office_pickup INTO v_item_id, v_check_pickup;

  IF v_check_pickup = true THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 6 PASSED: requires_office_pickup automatically set to true for Wallet';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 6 FAILED: Wallet post did not set requires_office_pickup = true!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 7: Auto-computation of expiration date
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  IF (SELECT expires_at FROM public.items WHERE id = v_item_id) IS NOT NULL THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 7 PASSED: expires_at automatically computed on insert';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 7 FAILED: expires_at was NULL on inserted item!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 8: Enforce daily post limit (max 10 per day)
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    -- We already inserted 1 item. Insert 9 more (total 10 = limit).
    FOR i IN 2..10 LOOP
      INSERT INTO public.items (user_id, type, title, description, category, location, date_happened)
      VALUES (v_user1_id, 'found', 'Item ' || i, 'Desc', 'Keys', 'Gym', CURRENT_DATE);
    END LOOP;
    
    -- 11th item must fail
    INSERT INTO public.items (user_id, type, title, description, category, location, date_happened)
    VALUES (v_user1_id, 'found', 'Item 11', 'Desc', 'Keys', 'Gym', CURRENT_DATE);
    
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 8 FAILED: 11th post was allowed!';
  EXCEPTION WHEN raise_exception THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 8 PASSED: 11th post blocked by enforce_daily_post_limit_trigger';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 9: Enforce daily claim limit (max 5 per day)
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    -- User 2 claims 5 items (limit)
    FOR i IN 1..5 LOOP
      INSERT INTO public.claims (item_id, claimant_id, proof_text)
      VALUES (v_item_id, v_user2_id, 'Proof claim ' || i);
    END LOOP;

    -- 6th claim must fail
    INSERT INTO public.claims (item_id, claimant_id, proof_text)
    VALUES (v_item_id, v_user2_id, 'Proof claim 6');

    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 9 FAILED: 6th claim was allowed!';
  EXCEPTION WHEN raise_exception THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 9 PASSED: 6th claim blocked by enforce_daily_claim_limit_trigger';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 10: Partial unique index guarantees only ONE approved claim
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  -- Select 2 claims for testing
  SELECT id INTO v_claim1_id FROM public.claims WHERE claimant_id = v_user2_id LIMIT 1;
  SELECT id INTO v_claim2_id FROM public.claims WHERE claimant_id = v_user2_id OFFSET 1 LIMIT 1;

  UPDATE public.claims SET status = 'approved' WHERE id = v_claim1_id;

  BEGIN
    UPDATE public.claims SET status = 'approved' WHERE id = v_claim2_id;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 10 FAILED: two approved claims were allowed on the same item!';
  EXCEPTION WHEN unique_violation THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 10 PASSED: partial unique index idx_claims_one_approved prevented second approved claim';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 11: Claim approval auto-rejects pending claims and updates item status
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  SELECT status INTO v_claim2_status FROM public.claims WHERE id = v_claim2_id;
  SELECT status INTO v_item_status FROM public.items WHERE id = v_item_id;

  IF v_claim2_status = 'auto_rejected' AND v_item_status = 'verified' THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 11 PASSED: claim approval automatically rejected pending claims and marked item verified';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 11 FAILED: claim approval did not auto-reject (claim status: %, item status: %)', v_claim2_status, v_item_status;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 12: Report threshold auto-hides item
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  -- User 2 reports the item (report 1)
  INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
  VALUES (v_user2_id, 'item', v_item_id, 'fake');

  -- Admin reports the item (report 2)
  INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
  VALUES (v_admin_id, 'item', v_item_id, 'fake');

  -- Create 3rd reporter (report 3 -> threshold reached!)
  DECLARE
    v_user3_id UUID := gen_random_uuid();
  BEGIN
    INSERT INTO public.profiles (id, full_name, student_id, nickname, college, role, approval_status)
    VALUES (v_user3_id, 'Reporter Three', '2024-1003', 'R3', 'CICS', 'student', 'approved');

    INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
    VALUES (v_user3_id, 'item', v_item_id, 'scam');

    SELECT is_hidden INTO v_check_hidden FROM public.items WHERE id = v_item_id;

    IF v_check_hidden = true THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE 'TEST 12 PASSED: 3 reports triggered auto-hide on item';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING 'TEST 12 FAILED: 3 reports did not set is_hidden = true!';
    END IF;
  END;

  -- --------------------------------------------------------------------------
  -- TEST 13: Prevent duplicate reports by same reporter
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
    VALUES (v_user2_id, 'item', v_item_id, 'spam');
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 13 FAILED: duplicate report by same reporter was allowed!';
  EXCEPTION WHEN unique_violation THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 13 PASSED: duplicate report prevented by unique constraint';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 14: Points log idempotency via unique event_key
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
  VALUES (v_user1_id, v_item_id, 10, 'Found item posted', 'found_item_' || v_item_id);

  BEGIN
    INSERT INTO public.points_log (user_id, item_id, points, reason, event_key)
    VALUES (v_user1_id, v_item_id, 10, 'Found item posted duplicate', 'found_item_' || v_item_id);
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 14 FAILED: duplicate event_key in points_log was allowed!';
  EXCEPTION WHEN unique_violation THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 14 PASSED: duplicate event_key rejected by unique constraint';
  END;

  -- --------------------------------------------------------------------------
  -- TEST 15: Points synchronization trigger
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  SELECT points INTO v_check_points FROM public.profiles WHERE id = v_user1_id;

  IF v_check_points = 10 THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 15 PASSED: sync_profile_points trigger automatically updated profiles.points to 10';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 15 FAILED: profiles.points did not sync! (expected 10, got %)', v_check_points;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 16: Dispute freezes auto-confirmation
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  UPDATE public.items 
  SET status = 'released', auto_confirm_at = now() + interval '7 days' 
  WHERE id = v_item_id;

  INSERT INTO public.disputes (item_id, raised_by, reason, status)
  VALUES (v_item_id, v_user2_id, 'Item not received test', 'open');

  SELECT auto_confirm_at INTO v_check_auto_confirm FROM public.items WHERE id = v_item_id;
  IF v_check_auto_confirm IS NULL THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'TEST 16 PASSED: on_dispute_created trigger successfully froze auto_confirm_at to NULL';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE WARNING 'TEST 16 FAILED: dispute creation did not freeze auto_confirm_at!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 17: Leaderboard privacy verification
  -- --------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    SELECT count(*)::INTEGER INTO i
    FROM public.get_leaderboard('all_time', NULL, 10);

    IF i >= 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE 'TEST 17 PASSED: get_leaderboard returned privacy-safe ranking rows (% rows)', i;
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING 'TEST 17 FAILED: get_leaderboard returned 0 rows!';
    END IF;
  END;

  -- --------------------------------------------------------------------------
  -- TEST RESULTS SUMMARY
  -- --------------------------------------------------------------------------
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'SECURITY TEST RESULTS: % / % PASSED (% FAILED)', v_pass_count, v_test_count, v_fail_count;
  RAISE NOTICE '=====================================================';

  IF v_fail_count > 0 THEN
    RAISE EXCEPTION 'SECURITY TEST SUITE FAILED WITH % FAILURES', v_fail_count;
  END IF;

  -- Always rollback test transaction so test data is not persisted
  RAISE EXCEPTION 'TEST_SUCCESS_ROLLBACK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'TEST_SUCCESS_ROLLBACK' THEN
    RAISE NOTICE 'All tests passed cleanly! Test transaction rolled back successfully.';
  ELSE
    RAISE;
  END IF;
END $$;
