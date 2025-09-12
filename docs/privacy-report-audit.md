# Report Audit Logging – Privacy and Retention

This document describes what data we collect for report audit events, how we protect user privacy, and how long we retain the data.

## Data Collected

Each report submission creates an audit entry in `public.report_events` with:
- `reporter_id` (UUID): reporter user id
- `target_type` (`user|post|message`)
- `target_id` (UUID)
- `reason_code` (text, optional)
- `metadata` (jsonb):
  - `ip_hash`: SHA-256 hash of the source IP
  - `ua_hash`: SHA-256 hash of the User-Agent
- `created_at` (timestamptz)

Notes:
- We never store raw IP or raw User-Agent; only hashes are persisted to minimize PII.
- Hashes are non-reversible and used only for coarse deduplication/abuse detection.

## Retention Policy

- Default retention is 90 days.
- A helper function is provided to delete old events:
  ```sql
  select public.cleanup_report_events(90);
  ```
- Schedule daily execution via Supabase Scheduler or pg_cron (e.g., 03:00 UTC).

## Security and Access

- Row Level Security (RLS) ensures users can only read their own events.
- Admins/Moderators should access aggregated views via service role if needed.

## Operational Guidance

- Monitor rate-limited (429) and duplicate (409) responses from the `submit-report` Edge Function.
- Keep Supabase Advisors enabled to validate RLS and index coverage.

## Change Log

- 2025-09-12: Introduced `report_events` table + RLS + indexes.
- 2025-09-13: Added hashed UA/IP in audit metadata and 90-day cleanup function.
