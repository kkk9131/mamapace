-- Update premium_monthly price to ¥500 (JPY)
begin;
update public.subscription_plans
set price_cents = 500
where code = 'premium_monthly';
commit;

