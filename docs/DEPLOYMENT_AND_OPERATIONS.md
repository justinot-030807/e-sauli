# MarSU Lost & Found - Deployment & Operations Guide

## Overview

This guide provides operational guidelines, deployment procedures, and capstone defense references for the **MarSU Lost & Found ("E-Sauli")** mobile application.

---

## 1. Web & PWA Deployment (Vercel)

The app is built as a single-page progressive web application using Expo:

```bash
# 1. Export static web bundle
npx expo export -p web

# The generated assets are placed in the `dist` directory.
```

### Vercel Setup:
1. Connect repository in Vercel dashboard.
2. Build Command: `npx expo export -p web`
3. Output Directory: `dist`
4. Routing is configured in `vercel.json` with SPA catch-all rewrites to support Expo Router client-side routes.

---

## 2. Android APK Deployment (EAS Build)

The project includes an `eas.json` configuration configured for standalone APK generation without local Android Studio requirements:

```bash
# Preview build (standalone APK for direct installation on Android devices):
npx eas-cli build --platform android --profile preview

# Production bundle (AAB for Google Play Store):
npx eas-cli build --platform android --profile production
```

---

## 3. Supabase Edge Functions Deployment

Deploy the two server-side Edge Functions:

```bash
# 1. Cash amount HMAC verification
# Replaces the legacy verifier on deployments that already host it.
supabase functions deploy verify-cash-amount

# 2. Automated background jobs & storage photo cleanup
supabase functions deploy scheduled-jobs
```

### Environment Secrets Configuration:
Set the required secrets in Supabase Dashboard (Settings → Edge Functions → Secrets) or via Supabase CLI:

```bash

```

---

## 4. Automated Scheduled Jobs & Free-Tier Keep-Alive

### In-Database Scheduled Jobs:
1. **30-Day Auto-Expiration:** Open items older than 30 days are expired and flagged for office inventory.
2. **7-Day Auto-Confirmation:** Released items unconfirmed after 7 days are automatically marked as `returned`, awarding finder points while protecting against uncooperative claimants.
3. **60-Day Photo Cleanup:** Photos for items in `returned` or `expired` status older than 60 days are physically deleted from Supabase Storage (`item-photos` bucket).

### GitHub Actions Keep-Alive:
Free Supabase projects automatically pause after 7 days of inactivity. The repository includes [`.github/workflows/keep-alive.yml`](file:///c:/Users/Hp/LOST&FOUNDAPP/.github/workflows/keep-alive.yml) which runs every 3 days to ping the REST endpoint and prevent project pausing.

---

## 5. Security & Verification Summary

All sensitive operations are strictly enforced at the database level:
- **18 Core Security Assertions:** Automated test suite in [`supabase/tests/security_tests.sql`](file:///c:/Users/Hp/LOST&FOUNDAPP/supabase/tests/security_tests.sql).
- **Zero Client Trust:** Points, roles, verification statuses, and rate-limits cannot be modified via client-side operations.
- **Tamper-Proof Audit Trail:** `admin_audit_log` allows only `SELECT` and `INSERT` policies; updates and deletes are permanently rejected.
- **Privacy First:** Full names and student IDs are withheld from public queries, leaderboard rankings, and notifications.


Apply all numbered migrations before updating the app. Deploy both Edge Functions in the same release. For Cron, store the service-role credential in Vault and POST a JSON body of `{"job":"all"}` to `scheduled-jobs`. The admin dashboard uses the current administrator's session. Cash ownership checks take place in person at the Lost & Found office.
