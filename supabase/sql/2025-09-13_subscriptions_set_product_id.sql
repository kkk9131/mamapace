-- Set product_id for premium_monthly plan
begin;

update public.subscription_plans
set product_id = 'com.mamapace.premium.monthly'
where code = 'premium_monthly';

commit;

