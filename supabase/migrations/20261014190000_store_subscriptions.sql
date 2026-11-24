drop index if exists public.idx_profiles_stripe_customer_id;
alter table public.profiles drop column if exists stripe_customer_id;

alter table public.user_entitlements
  add column if not exists billing_provider text,
  add column if not exists store_product_id text,
  add column if not exists subscription_expires_at timestamptz;