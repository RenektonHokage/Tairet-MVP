begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_orders'::regclass
      and conname = 'access_orders_id_amount_currency_unique'
  ) then
    alter table public.access_orders
      add constraint access_orders_id_amount_currency_unique
      unique (id, amount_gs, currency);
  end if;
end $$;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.access_orders(id) on delete restrict,
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  access_date date not null,
  attempt_number integer not null,
  provider text not null,
  provider_operation text not null,
  provider_attempt_ref text null,
  provider_transaction_id text null,
  provider_status text null,
  provider_response_code text null,
  amount_gs bigint not null,
  currency text not null default 'PYG',
  provider_amount_text text not null,
  status text not null default 'created',
  request_payload jsonb null,
  response_payload jsonb null,
  callback_payload jsonb null,
  last_error text null,
  manual_review_reason text null,
  initiated_at timestamptz null,
  provider_ready_at timestamptz null,
  confirmed_at timestamptz null,
  rejected_at timestamptz null,
  cancelled_at timestamptz null,
  expired_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_order_attempt_number_unique
    unique (order_id, attempt_number),
  constraint payment_attempts_order_access_date_alignment_fk
    foreign key (order_id, access_date)
    references public.access_orders(id, access_date)
    on delete restrict,
  constraint payment_attempts_order_local_alignment_fk
    foreign key (order_id, local_id)
    references public.access_orders(id, local_id)
    on delete restrict,
  constraint payment_attempts_order_event_alignment_fk
    foreign key (order_id, event_id)
    references public.access_orders(id, event_id)
    on delete restrict,
  constraint payment_attempts_order_amount_currency_alignment_fk
    foreign key (order_id, amount_gs, currency)
    references public.access_orders(id, amount_gs, currency)
    on delete restrict,
  constraint payment_attempts_source_type_chk
    check (source_type in ('local', 'event')),
  constraint payment_attempts_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint payment_attempts_attempt_number_positive_chk
    check (attempt_number > 0),
  constraint payment_attempts_provider_non_empty_chk
    check (char_length(trim(provider)) > 0),
  constraint payment_attempts_provider_operation_non_empty_chk
    check (char_length(trim(provider_operation)) > 0),
  constraint payment_attempts_provider_attempt_ref_non_empty_chk
    check (provider_attempt_ref is null or char_length(trim(provider_attempt_ref)) > 0),
  constraint payment_attempts_provider_transaction_id_non_empty_chk
    check (provider_transaction_id is null or char_length(trim(provider_transaction_id)) > 0),
  constraint payment_attempts_provider_status_non_empty_chk
    check (provider_status is null or char_length(trim(provider_status)) > 0),
  constraint payment_attempts_provider_response_code_non_empty_chk
    check (provider_response_code is null or char_length(trim(provider_response_code)) > 0),
  constraint payment_attempts_amount_gs_positive_chk
    check (amount_gs > 0),
  constraint payment_attempts_currency_chk
    check (currency = 'PYG'),
  constraint payment_attempts_provider_amount_text_non_empty_chk
    check (char_length(trim(provider_amount_text)) > 0),
  constraint payment_attempts_status_chk
    check (
      status in (
        'created',
        'provider_ready',
        'pending_confirmation',
        'approved',
        'rejected',
        'cancelled',
        'expired',
        'technical_error',
        'manual_review'
      )
    ),
  constraint payment_attempts_expires_at_chk
    check (
      expires_at is null
      or expires_at > created_at
    )
);

create unique index if not exists idx_payment_attempts_provider_attempt_ref_unique
  on public.payment_attempts(provider, provider_operation, provider_attempt_ref)
  where provider_attempt_ref is not null;

create unique index if not exists idx_payment_attempts_provider_transaction_unique
  on public.payment_attempts(provider, provider_operation, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index if not exists idx_payment_attempts_blocking_provider_operation_unique
  on public.payment_attempts(order_id, provider, provider_operation)
  where status in ('created', 'provider_ready', 'pending_confirmation', 'approved', 'manual_review');

create index if not exists idx_payment_attempts_order_id
  on public.payment_attempts(order_id);

create index if not exists idx_payment_attempts_provider_operation_status
  on public.payment_attempts(provider, provider_operation, status);

create index if not exists idx_payment_attempts_status_expires_at
  on public.payment_attempts(status, expires_at);

create index if not exists idx_payment_attempts_created_at_desc
  on public.payment_attempts(created_at desc);

create index if not exists idx_payment_attempts_local_access_date_status
  on public.payment_attempts(local_id, access_date, status)
  where source_type = 'local';

create index if not exists idx_payment_attempts_event_access_date_status
  on public.payment_attempts(event_id, access_date, status)
  where source_type = 'event';

alter table public.payment_attempts enable row level security;

revoke all privileges on table public.payment_attempts from anon;
revoke all privileges on table public.payment_attempts from authenticated;

grant select, insert, update, delete on table public.payment_attempts to service_role;

commit;
