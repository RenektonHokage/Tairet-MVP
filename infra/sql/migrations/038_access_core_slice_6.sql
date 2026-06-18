begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_attempts'::regclass
      and conname = 'payment_attempts_id_order_id_unique'
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_id_order_id_unique
      unique (id, order_id);
  end if;
end $$;

create table if not exists public.access_checkout_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null,
  order_id uuid null references public.access_orders(id) on delete restrict,
  payment_attempt_id uuid null,
  response_payload jsonb null,
  error_payload jsonb null,
  last_error text null,
  locked_until timestamptz null,
  expires_at timestamptz not null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_checkout_idempotency_provider_operation_key_unique
    unique (provider, provider_operation, idempotency_key),
  constraint access_checkout_idempotency_payment_attempt_order_fk
    foreign key (payment_attempt_id, order_id)
    references public.payment_attempts(id, order_id)
    on delete restrict,
  constraint access_checkout_idempotency_provider_length_chk
    check (char_length(trim(provider)) between 1 and 64),
  constraint access_checkout_idempotency_provider_normalized_chk
    check (provider = lower(trim(provider))),
  constraint access_checkout_idempotency_provider_operation_length_chk
    check (char_length(trim(provider_operation)) between 1 and 64),
  constraint access_checkout_idempotency_provider_operation_normalized_chk
    check (provider_operation = lower(trim(provider_operation))),
  constraint access_checkout_idempotency_key_length_chk
    check (char_length(trim(idempotency_key)) between 8 and 128),
  constraint access_checkout_idempotency_key_trimmed_chk
    check (idempotency_key = trim(idempotency_key)),
  constraint access_checkout_idempotency_request_hash_chk
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint access_checkout_idempotency_status_chk
    check (status in ('processing', 'succeeded', 'failed', 'manual_review', 'expired')),
  constraint access_checkout_idempotency_expires_at_chk
    check (expires_at > created_at),
  constraint access_checkout_idempotency_locked_until_chk
    check (locked_until is null or locked_until > created_at),
  constraint access_checkout_idempotency_processing_lock_chk
    check (status <> 'processing' or locked_until is not null),
  constraint access_checkout_idempotency_completed_at_chk
    check (completed_at is null or completed_at >= created_at),
  constraint access_checkout_idempotency_failed_at_chk
    check (failed_at is null or failed_at >= created_at),
  constraint access_checkout_idempotency_last_error_length_chk
    check (last_error is null or char_length(last_error) <= 1000),
  constraint access_checkout_idempotency_order_attempt_pair_chk
    check (
      (order_id is null and payment_attempt_id is null)
      or
      (order_id is not null and payment_attempt_id is not null)
    )
);

create index if not exists idx_access_checkout_idempotency_status_locked_until
  on public.access_checkout_idempotency_keys(status, locked_until);

create index if not exists idx_access_checkout_idempotency_expires_at
  on public.access_checkout_idempotency_keys(expires_at);

create index if not exists idx_access_checkout_idempotency_order_id
  on public.access_checkout_idempotency_keys(order_id)
  where order_id is not null;

create index if not exists idx_access_checkout_idempotency_payment_attempt_id
  on public.access_checkout_idempotency_keys(payment_attempt_id)
  where payment_attempt_id is not null;

create index if not exists idx_access_checkout_idempotency_created_at_desc
  on public.access_checkout_idempotency_keys(created_at desc);

alter table public.access_checkout_idempotency_keys enable row level security;

revoke all privileges on table public.access_checkout_idempotency_keys from public;
revoke all privileges on table public.access_checkout_idempotency_keys from anon;
revoke all privileges on table public.access_checkout_idempotency_keys from authenticated;

grant select, insert, update, delete on table public.access_checkout_idempotency_keys to service_role;

create sequence if not exists public.bancard_shop_process_id_seq
  as bigint
  minvalue 1
  maxvalue 999999999
  start with 1
  increment by 1
  no cycle
  cache 1;

revoke all on sequence public.bancard_shop_process_id_seq from public;
revoke all on sequence public.bancard_shop_process_id_seq from anon;
revoke all on sequence public.bancard_shop_process_id_seq from authenticated;

grant usage, select on sequence public.bancard_shop_process_id_seq to service_role;

create or replace function public.next_bancard_shop_process_id()
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    to_char(now() at time zone 'America/Asuncion', 'YYMMDD')
    || lpad(nextval('public.bancard_shop_process_id_seq')::text, 9, '0');
$$;

revoke all on function public.next_bancard_shop_process_id() from public;
revoke all on function public.next_bancard_shop_process_id() from anon;
revoke all on function public.next_bancard_shop_process_id() from authenticated;
grant execute on function public.next_bancard_shop_process_id() to service_role;

commit;
