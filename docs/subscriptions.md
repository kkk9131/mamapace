# Subscriptions (IAP) – Plan & Skeleton

Decisions
- Store billing (IAP)
- Plan: premium_monthly / プレミアム（月額）
- Billing: monthly, JPY, no free trial
- Price: ¥500/month

What’s included in this commit
- SQL schema and RLS policies (`supabase/sql/2025-09-13_subscriptions_*.sql`)
- Edge Function skeleton (`supabase/functions/iap/index.ts`)
- Client scaffolding: service, context, hook, screens (Paywall, Manage)
- Navigation + Settings entries

How to proceed
1) Create products in App Store Connect and Google Play Console (monthly plan)
2) Set product IDs and price in both stores
3) Update DB:
   - `subscription_plans.product_id`（ストアの Product ID）
   - `price_cents` は標準価格（¥500）を反映
4) Configure Supabase env vars:
   - `SUPABASE_SERVICE_ROLE_KEY` (Edge Function)
   - Apple: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
   - Google: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME`
5) Implement real verification in `supabase/functions/iap/index.ts`
6) Wire `react-native-iap` on client for purchase/restore and send receipts

Eligibility & Entitlements
- Eligibility: Only users with maternal_verified badge can subscribe
  - Enforced in Paywall UI and in Edge Function `/iap/verify`
- Entitlements seeded: `ai_chat_unlimited`, `ai_comment_unlimited`, `private_room_create`
  - Map controlled in DB (`plan_entitlements`)

Notes
- Entitlements tables exist for future feature gating; use `hasEntitlement()`
- Notifications endpoints (Apple/Google) are placeholders; enable later
- No free trial: set `subscription_plans.trial_days = 0` to ensure server logic marks new purchases as `active` immediately.
