-- Update plan price to standard monthly after promo (display in-app)
begin;
update public.subscription_plans
set price_cents = 980
where code = 'premium_monthly';
commit;

