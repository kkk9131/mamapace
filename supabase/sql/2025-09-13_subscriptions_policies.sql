-- RLS policies for subscriptions

begin;

-- Enable RLS
alter table public.user_subscriptions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.entitlements enable row level security;
alter table public.plan_entitlements enable row level security;

-- Plans readable by anyone (for pricing display); write via service_role only
drop policy if exists subscription_plans_select_all on public.subscription_plans;
create policy subscription_plans_select_all
on public.subscription_plans for select
to authenticated, anon
using (active = true);

drop policy if exists subscription_plans_write_service on public.subscription_plans;
create policy subscription_plans_write_service
on public.subscription_plans for all
to service_role
using (true) with check (true);

-- User subscriptions: owner can read their own row; writes are via service_role only
drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
create policy user_subscriptions_select_own
on public.user_subscriptions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_subscriptions_write_service on public.user_subscriptions;
create policy user_subscriptions_write_service
on public.user_subscriptions for all
to service_role
using (true) with check (true);

-- Entitlements readable; writes service_role only
drop policy if exists entitlements_select_all on public.entitlements;
create policy entitlements_select_all
on public.entitlements for select
to authenticated, anon
using (true);

drop policy if exists entitlements_write_service on public.entitlements;
create policy entitlements_write_service
on public.entitlements for all
to service_role
using (true) with check (true);

drop policy if exists plan_entitlements_select_all on public.plan_entitlements;
create policy plan_entitlements_select_all
on public.plan_entitlements for select
to authenticated, anon
using (true);

drop policy if exists plan_entitlements_write_service on public.plan_entitlements;
create policy plan_entitlements_write_service
on public.plan_entitlements for all
to service_role
using (true) with check (true);

commit;

