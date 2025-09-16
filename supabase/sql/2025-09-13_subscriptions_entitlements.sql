-- Seed entitlements and map to premium plan
begin;

insert into public.entitlements (key, description) values
  ('ai_chat_unlimited', 'AIチャットほぼ無制限'),
  ('ai_comment_unlimited', 'AIコメントほぼ無制限'),
  ('private_room_create', '非公開ルーム作成')
on conflict (key) do nothing;

with p as (
  select id from public.subscription_plans where code = 'premium_monthly' limit 1
), e as (
  select id, key from public.entitlements where key in ('ai_chat_unlimited','ai_comment_unlimited','private_room_create')
)
insert into public.plan_entitlements (plan_id, entitlement_id)
select p.id, e.id
from p cross join e
on conflict do nothing;

commit;

