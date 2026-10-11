# MarSU Lost & Found

A Lost & Found application for Marinduque State University (MarSU) with secure claims, real-time notifications, gamified achievements, and admin moderation.

## Tech Stack

- **Frontend**: Expo, React Native, TypeScript, Expo Router
- **Backend**: Supabase (Auth, PostgreSQL, RLS, Storage, Realtime, Edge Functions)
- **Deployment**: Web/PWA via Vercel, Android APK via EAS Build

## Setup Guide

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings → API

### 2. Run SQL Migration

1. Open the Supabase SQL Editor
2. Copy the contents of `supabase/migrations/00001_initial_schema.sql`
3. Execute the entire file
4. Verify: all tables, RLS policies, triggers, and seed data should be created

### 3. Configure Auth

1. Go to Authentication → Settings
2. Enable **Email provider**
3. Enable **Confirm email** (email verification)
4. Set Site URL to your app's URL (e.g., `http://localhost:8081` for development)
5. Add redirect URLs:
   - `marsu-lf://` (for native app deep linking)
   - `http://localhost:8081` (for web development)

### 4. Email Verification

The default Supabase email service is heavily rate-limited (2-3 emails/hour).

**For production**, set up free custom SMTP:
- [Resend](https://resend.com) — 3,000 emails/month free
- [Brevo](https://brevo.com) — 300 emails/day free

Configure in Supabase Dashboard → Settings → Auth → SMTP Settings.

### 5. School Domain Configuration

The system uses `system_settings` table for configuration:

| Key | Default | Description |
|-----|---------|-------------|
| `require_school_email` | `true` | Require school email for registration |
| `school_email_domain` | `marsu.edu.ph` | Allowed email domain |

**If `require_school_email` = `true`**: Only `@marsu.edu.ph` emails auto-approve.
**If `require_school_email` = `false`**: Any email can register, but users start as `pending` and require admin approval.

### 6. Fallback Mode

When school email is not required:
- Users must provide `student_id`, `full_name`, `nickname`, and `college`
- `approval_status` starts as `pending`
- Users cannot post, claim, or chat until approved by admin

### 7. First Admin Setup

Run this SQL in the Supabase SQL Editor after your first admin registers:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@marsu.edu.ph');
```

> ⚠️ Admin roles can ONLY be granted via direct database access. The client cannot grant admin roles.

### 8. Storage Configuration

1. Go to Storage in Supabase Dashboard
2. Create a **private** bucket named `item-photos`
3. Do NOT enable public access
4. Photos are served via short-lived signed URLs

### 9. Edge Functions

Edge Functions handle:
- HMAC generation/comparison for cash amounts
- Photo cleanup for returned/expired items
- Scheduled jobs (auto-confirm, auto-expire)

Deploy with:
```bash
supabase functions deploy
```

### 10. Scheduled Jobs

Set up cron jobs for:
- **Auto-expiration**: Expire items after 30 days
- **Auto-confirm**: Auto-confirm returned items after 7 days
- **Photo cleanup**: Delete photos for returned/expired items after 60 days
- **Reward validation**: Validate found-post rewards (reject if deleted within 7 days)
- **Notification reminders**: Remind owners at day 5 of return

### 11. Install Dependencies

```bash
npm install
```

### 12. Start Development

```bash
npx expo start
```

### 13. Expo Go QR Scanning

1. Install Expo Go on your phone
2. Scan the QR code shown in the terminal
3. The app will load on your device

### 14. Web Export

```bash
npx expo export -p web
```

### 15. Vercel Deployment

1. Push to GitHub
2. Import in Vercel
3. Set build command: `npx expo export -p web`
4. Set output directory: `dist`
5. Configure to serve under `/app` path if needed

### 16. EAS Android APK

```bash
npx eas-cli build --platform android --profile preview
```

### 17. Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

**Client-side** (exposed in app bundle):
- `EXPO_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon key

**Server-only** (Supabase Edge Function secrets):
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (NEVER in client)
- `ITEM_HMAC_SECRET` — HMAC secret for cash verification (NEVER in client)

### 18. Security Testing

See `SECURITY_TEST.md` for the complete security test checklist.

### 19. Optional: Expo Push Notifications

Push notifications are **optional**. The app works fully with Supabase Realtime in-app notifications. Push can be added later without breaking functionality.

### 20. Keep-Alive

An optional GitHub Actions workflow is provided to keep the Supabase free-tier project active. See `.github/workflows/keep-alive.yml`.

## Design

| Token | Value |
|-------|-------|
| Primary | `#7a1f2b` |
| Accent | `#e3b23c` |
| Light Background | `#f8f3f2` |
| Dark Background | `#1a0d0f` |

## Development Phases

1. ✅ Database, Auth, Profiles, RLS, Storage Security
2. Security Tests (initial)
3. Post Item, Feed, Search, Filters, Item Details
4. Claims, Secret Questions, Private Verification, Chat, Realtime Notifications
5. Return Flow, Office Handover, Auto-Confirm, Disputes, Expiration, Points, Badges
6. Leaderboard, Profile, Achievements
7. Reports, Admin Dashboard, Moderation, Anti-Abuse, Audit Logs, Scheduled Jobs
8. Final Security Audit, Performance, Mobile/Web/Deployment Testing
