# MarSU Lost & Found ("E-Sauli")

A secure, mobile-first Lost & Found application for **Marinduque State University (MarSU)** featuring server-enforced claims, cryptographic cash/wallet verification, real-time notifications, gamified points and badges, and a comprehensive admin moderation system.

---

## Tech Stack

- **Frontend**: Expo SDK 52, React Native, TypeScript, Expo Router (file-based navigation)
- **Backend**: Supabase (PostgreSQL 15+, Row Level Security, Storage, Realtime, Edge Functions)
- **Deployment**: Web/PWA via Vercel, Android APK via EAS Build

---

## System Configuration & Setup Guide

### 1. Supabase Project Creation
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to the Philippines (e.g., `Singapore - ap-southeast-1`).
3. Note your **Project URL** and **Anon Public Key** from **Project Settings → API**.

### 2. SQL Migrations
Execute the migration files sequentially in the Supabase SQL Editor:
1. `supabase/migrations/00001_initial_schema.sql` — 18 core tables, security constraints, basic triggers, RLS policies, and system settings.
2. `supabase/migrations/00002_return_and_jobs_rpc.sql` — Return confirmation, office handover, auto-confirm cron, dispute auto-freeze, 30-day expiration, and points calculation.
3. `supabase/migrations/00003_leaderboard_rpc.sql` — Privacy-preserving leaderboard ranking RPC with college filters and podium rankings.
4. `supabase/migrations/00004_admin_and_moderation_rpc.sql` — Admin approval, suspension, content moderation, dispute resolution, controlled point reversals, and lockout overrides.

### 3. Auth Configuration
1. Go to **Authentication → Providers → Email**.
2. Enable the **Email provider**.
3. Enable **Confirm email** (ensures unverified users cannot bypass registration).
4. Set **Site URL** to `http://localhost:8081` (for local Expo web) or your deployed production domain.
5. Add Redirect URLs:
   - `marsu-lf://` (for deep linking on Android/iOS)
   - `http://localhost:8081` (local development)

### 4. Email Verification & Custom SMTP
The Supabase default email service is rate-limited to 2–3 emails/hour. For production:
1. Sign up for a free SMTP provider such as [Resend](https://resend.com) (3,000 emails/month free) or [Brevo](https://brevo.com) (300 emails/day free).
2. Go to **Project Settings → Authentication → SMTP Settings** in Supabase.
3. Configure your custom SMTP credentials and sender address (e.g., `noreply@marsu.edu.ph`).

### 5. School Domain Configuration
The registration flow uses the `system_settings` table:
- `require_school_email` (default: `true`): When true, only emails matching `@marsu.edu.ph` can register.
- `school_email_domain` (default: `marsu.edu.ph`): Configured school domain.

Domain restrictions are strictly validated server-side by database trigger `enforce_school_email_domain()`.

### 6. Fallback Mode
If `require_school_email` is set to `false`:
- Users may register with personal email providers (Gmail, Outlook, Yahoo).
- Required profile fields: `student_id`, `full_name`, `nickname`, `college`.
- The user account starts in `approval_status = 'pending'`.
- The student cannot post items, submit claims, or send chat messages until approved by an administrator in the Admin Panel.

### 7. First Admin SQL Setup
For security, the client application can **never** grant admin privileges. Grant the first administrator account via the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin', approval_status = 'approved'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@marsu.edu.ph');
```

### 8. Storage Configuration
1. Go to **Storage** in the Supabase Dashboard.
2. Verify the `item-photos` bucket is created and set to **Private** (`public = false`).
3. Images are uploaded with client-side compression (max 1280px, ~200KB target, GPS/EXIF metadata stripped).
4. Category policy blocks photo uploads for Cash, Wallet, and ID cards.
5. Images are accessed solely via short-lived signed URLs.

### 9. Edge Functions
The project provides two server-side Supabase Edge Functions:
1. `supabase/functions/verify-cash-amount` — Server-side HMAC comparison for Cash and Wallet claims with 3-attempt lockout enforcement.
2. `supabase/functions/scheduled-jobs` — Background automation for 30-day auto-expiration, 7-day auto-confirmation, 60-day storage photo cleanup via Storage API, and Day 5 return reminders.

Deploy using Supabase CLI:
```bash
supabase functions deploy verify-cash-amount
supabase functions deploy scheduled-jobs
```

Set server-side secrets:
```bash
supabase secrets set ITEM_HMAC_SECRET="your_secure_random_hmac_secret_key"
```

### 10. Scheduled Jobs
Set up recurring cron triggers or call the `scheduled-jobs` Edge Function:
- **Auto-Expiration (30 Days)**: Archives lost posts and flags unreturned found items for office custody.
- **Auto-Confirmation (7 Days)**: Marks released items as returned after 7 days if unconfirmed, awarding finder points (+50).
- **Photo Cleanup (60 Days)**: Permanently purges photos of resolved items from the Storage bucket.
- **Return Reminder (Day 5)**: Alerts owners 2 days before auto-confirmation takes effect.

### 11. Install Dependencies
```bash
npm install
```

### 12. Start Development
```bash
npx expo start
```

### 13. Expo Go QR Scanning
1. Install **Expo Go** from Google Play Store or Apple App Store.
2. Scan the terminal QR code using Expo Go (Android) or the default Camera app (iOS).
3. The app will launch with fast-refresh enabled.

### 14. Web Export
Export the static single-page web bundle:
```bash
npx expo export -p web
```
Assets are generated in the `dist/` directory.

### 15. Vercel Deployment
1. Push repository to GitHub.
2. Import project in [Vercel](https://vercel.com).
3. Set Framework Preset to **Other**.
4. Set Build Command: `npx expo export -p web`
5. Set Output Directory: `dist`
6. Configure environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

### 16. `/app` Configuration
For multi-app hosting or subpath deployments where the app resides under `/app`, [`vercel.json`](file:///c:/Users/Hp/LOST&FOUNDAPP/vercel.json) includes SPA rewrite rules mapping `/app/(.*)` and `/(.*)` directly to `/index.html` to guarantee proper Expo Router deep-linking resolution without 404 routing errors.

### 17. EAS Android APK
Build a standalone installable Android APK without local Android Studio or native toolchains:
```bash
# Preview build (outputs direct .apk file)
npx eas-cli build --platform android --profile preview

# Production build (outputs Google Play Store .aab bundle)
npx eas-cli build --platform android --profile production
```
Configured in [`eas.json`](file:///c:/Users/Hp/LOST&FOUNDAPP/eas.json).

### 18. Environment Variables
Create `.env` based on `.env.example`:

```bash
# Client Variables (Bundled into app)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-Only Variables (Supabase Edge Function Secrets - NEVER expose in client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ITEM_HMAC_SECRET=your-random-hmac-secret-string
```

### 19. Security Testing (`SECURITY_TEST.md`)
Run the 18-assertion automated security test suite:
1. Open the Supabase SQL Editor.
2. Paste and run [`supabase/tests/security_tests.sql`](file:///c:/Users/Hp/LOST&FOUNDAPP/supabase/tests/security_tests.sql).
3. The test runs within an isolated rollback transaction, testing role protection, RLS enforcement, points immutability, dispute auto-freezing, leaderboard privacy, and admin point reversals.

See [`SECURITY_TEST.md`](file:///c:/Users/Hp/LOST&FOUNDAPP/SECURITY_TEST.md) for full case coverage.

### 20. Optional: Expo Push Notifications
In-app notifications powered by Supabase Realtime serve as the primary notification pipeline. Expo Push Notifications are fully optional and the application remains 100% functional without push credentials.

### 21. Free-Tier Keep-Alive
Supabase free-tier projects pause after 7 days of inactivity. The repository includes [`.github/workflows/keep-alive.yml`](file:///c:/Users/Hp/LOST&FOUNDAPP/.github/workflows/keep-alive.yml), which automatically executes a lightweight REST ping every 3 days using GitHub Actions secrets (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

---

## Design System Tokens

| Token | Value | Description |
|---|---|---|
| Primary | `#7a1f2b` | MarSU Maroon |
| Accent | `#e3b23c` | MarSU Gold |
| Background (Light) | `#f8f3f2` | Light Warm Gray |
| Background (Dark) | `#1a0d0f` | Deep Maroon Dark |
| Card / Surface | `#ffffff` | Clean Card Surface |
| Border | `#e0d5d5` | Subtle Outline |

---

## Development Phases Status

- [x] **Phase 1**: Database schema, Auth, Profiles, RLS, Storage policies, Auth screens (`2f2b78b`)
- [x] **Phase 2**: Rate limiting, Auto-reject, 3-strike lockout, Account deletion, Security test suite (`0b31803`)
- [x] **Phase 3**: Items feed, Category/Location filters, Privacy masking, Deterministic matching (`104f118`)
- [x] **Phase 4**: Claims, Secret questions, HMAC verification, Realtime chat, Notifications tab (`b5d73a1`)
- [x] **Phase 5**: Return flow, Office handover, Auto-confirm, Disputes, Expiration, Points, Badges (`92217a4`)
- [x] **Phase 6**: Leaderboard with privacy masks, Profile statistics, Mga Post Ko, Achievements (`eb4e4aa`)
- [x] **Phase 7**: Admin dashboard, Moderation, Dispute resolutions, Point reversals, Audit logs (`29111aa`)
- [x] **Phase 8**: Final security audit, Performance verification, EAS/Vercel deployment configs, Documentation
