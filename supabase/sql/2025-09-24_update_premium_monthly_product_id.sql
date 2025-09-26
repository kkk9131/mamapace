-- Update product_id for premium_monthly plan to new App Store identifier
begin;

update public.subscription_plans
set product_id = 'com.mamapace.premium.monthly2'
where code = 'premium_monthly';

commit;
