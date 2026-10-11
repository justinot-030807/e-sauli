# MarSU Lost & Found - Security Test Plan (`SECURITY_TEST.md`)

This checklist defines the verification criteria across every security domain required by the MarSU Lost & Found specification.

### Running Automated Security Tests
To execute the automated database test suite:
1. Open the Supabase SQL Editor.
2. Paste and run the contents of [`supabase/tests/security_tests.sql`](file:///c:/Users/Hp/LOST&FOUNDAPP/supabase/tests/security_tests.sql).
3. The script verifies all 15 core database rules (rate limiting, column protection, auto-rejection, report threshold auto-hide, normalized student uniqueness, points synchronization) in an isolated transaction that automatically rolls back.

---

## 1. Authentication (`AUTH`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| AUTH-01 | Unverified user login attempt | Redirected to `verify-email` screen; blocked from protected routes | Supabase Auth email confirmation |
| AUTH-02 | Unapproved user creates item post | Database rejects INSERT into `items` | RLS policy `items_insert_own` |
| AUTH-03 | Unapproved user submits claim | Database rejects INSERT into `claims` | RLS policy `claims_insert` |
| AUTH-04 | Unapproved user sends chat message | Database rejects INSERT into `messages` | RLS policy `messages_insert` |
| AUTH-05 | Suspended user attempts post/claim/chat | Database rejects all actions with RLS violation | RLS policies checking `is_suspended = false` |

---

## 2. Roles & Permissions (`ROLE`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| ROLE-01 | Student attempts direct UPDATE to `role = 'admin'` | Database reverts `role` to previous value | Trigger `protect_profile_columns_trigger` |
| ROLE-02 | Student attempts to change `approval_status` | Database reverts `approval_status` | Trigger `protect_profile_columns_trigger` |
| ROLE-03 | Student attempts client-callable admin RPC | Server returns unauthorized / permission denied | SECURITY DEFINER search_path + role check |

---

## 3. Profile Data Privacy (`PROFILE`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| PROF-01 | User queries another user's `full_name` or `student_id` | Private fields are withheld; only public fields visible via `get_public_profile()` | Database function `get_public_profile()` |
| PROF-02 | User attempts to UPDATE another user's profile | Database rejects UPDATE | RLS policy `profiles_update_own` (`auth.uid() = id`) |
| PROF-03 | Duplicate `student_id` registration (different casing/spacing) | Database rejects insert due to normalized unique index | Unique index `idx_profiles_student_id` (`lower(trim(student_id))`) |
| PROF-04 | User inspects leaderboard query results | Only nickname, college, points, and returns_count are visible; full name, student ID, and email are never exposed | Database function `get_leaderboard()` |

---

## 4. Points & Gamification Integrity (`POINTS`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| PTS-01 | Student attempts to directly UPDATE `profiles.points` | Value is reverted to sum of `points_log` | Trigger `protect_profile_columns_trigger` |
| PTS-02 | Student attempts direct INSERT into `points_log` | Database rejects INSERT | RLS policy (no INSERT policy for authenticated) |
| PTS-03 | Student attempts direct DELETE from `points_log` | Database rejects DELETE | RLS policy (no DELETE policy) |
| PTS-04 | Duplicate reward event with same `event_key` | Database rejects duplicate insert | UNIQUE constraint on `points_log.event_key` |
| PTS-05 | Student attempts direct INSERT into `user_badges` | Database rejects INSERT | RLS policy (read-only for clients) |
| PTS-06 | Student attempts direct UPDATE to `returns_count` | Value is reverted | Trigger `protect_profile_columns_trigger` |

---

## 5. Item Integrity (`ITEMS`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| ITEM-01 | User attempts to UPDATE another user's item | Database rejects UPDATE | RLS policy `items_update_own` |
| ITEM-02 | User attempts to claim their own posted item | Database rejects claim INSERT | RLS policy `claims_insert` (`NOT EXISTS user_id = auth.uid()`) |
| ITEM-03 | Sensitive category item (Cash, Wallet, ID/Cards) created | `requires_office_pickup` automatically set to `true` | Trigger `set_office_pickup_trigger` |
| ITEM-04 | New item created without `expires_at` | `expires_at` automatically computed to +30 days | Trigger `set_item_expiration_trigger` |

---

## 6. Private Data & Cryptography (`PRIVATE DATA`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| PRIV-01 | Claimant attempts to query `item_private` table | RLS returns 0 rows (DENY) | RLS policy `item_private_select` |
| PRIV-02 | Claimant attempts to read `amount_hmac` | Denied; claimant cannot read `item_private` | RLS policy `item_private_select` |
| PRIV-03 | Claimant attempts to read `secret_questions.answer_hmac` | Denied; claimant uses `get_item_questions()` which returns only question text | Function `get_item_questions()` |
| PRIV-04 | Direct HTTP access to photo in `item-photos` bucket | HTTP 403 Forbidden | Private bucket (`public = false`) |

---

## 7. Claim System & Concurrency (`CLAIMS`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| CLM-01 | Two claims approved simultaneously for same item | Only one succeeds; second violates unique partial index | Partial unique index `idx_claims_one_approved` |
| CLM-02 | Claimant fails cash amount check > 3 times | Locked from further automated attempts | Verification logic + `claim_attempts` count check |
| CLM-03 | User exceeds daily post limit (10 posts) | Rejection on 11th post | Database rate-limiting check |
| CLM-04 | User exceeds daily claim limit (5 claims) | Rejection on 6th claim | Database rate-limiting check |

---

## 8. Realtime Chat Security (`CHAT`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| CHAT-01 | User queries messages for a claim they don't own | RLS returns 0 rows | RLS policy `messages_select` |
| CHAT-02 | User attempts to send message to an unrelated claim | Database rejects INSERT | RLS policy `messages_insert` |
| CHAT-03 | Suspended user attempts to send message | Database rejects INSERT | RLS policy `messages_insert` |

---

## 9. Admin Security (`ADMIN`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| ADM-01 | Student attempts access to `admin_audit_log` | RLS returns 0 rows | RLS policy `audit_log_select_admin` |
| ADM-02 | Admin attempts UPDATE or DELETE on `admin_audit_log` | Database rejects operation (immutable audit log) | RLS denies UPDATE/DELETE |
| ADM-03 | Admin point reversal | Offsetting negative record created in `points_log` with audit log | Server-side reversal function |

---

## 10. Storage Security (`STORAGE`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| STG-01 | User attempts photo upload for Cash / Wallet / ID | Client service and storage policy reject upload | `services/storage.ts` + category rules |
| STG-02 | User attempts upload exceeding 5MB | Client pre-check and bucket configuration reject upload | `file_size_limit = 5242880` on bucket |
| STG-03 | User attempts upload with invalid MIME type | Rejected by bucket configuration | `allowed_mime_types` array |
| STG-04 | User uploads to another user's folder | RLS rejects insert | Policy `item_photos_user_upload` checks `folder = auth.uid()` |

---

## 11. Reports & Anti-Abuse (`REPORTS`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| REP-01 | User attempts duplicate report on same target | Rejection on duplicate | Unique index `idx_reports_reporter_target` |
| REP-02 | Item receives 3 distinct reports | Item automatically hidden (`is_hidden = true`) | System setting `report_threshold` + trigger/job |

---

## 12. Scheduled Jobs (`SCHEDULED JOBS`)

| ID | Test Case | Expected Result | Enforced By |
|---|---|---|---|
| JOB-01 | Items older than 30 days | Status set to `expired`, moved to office records | Auto-expiration job + `job_logs` |
| JOB-02 | Released items unconfirmed after 7 days | Auto-confirmed as `returned`, points awarded to finder | Auto-confirm job + `job_logs` |
| JOB-03 | Expired/returned photos older than 60 days | Photos deleted via Storage API | Photo cleanup job + `job_logs` |
| JOB-04 | Finder-owner pairs exceed 2 returns in month | 3rd return yields 0 points, flagged for admin review | `monthly_return_pair_limit` logic |
