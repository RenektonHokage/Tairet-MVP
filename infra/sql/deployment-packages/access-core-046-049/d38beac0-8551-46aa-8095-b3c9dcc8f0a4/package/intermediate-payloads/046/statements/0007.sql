create table public.access_email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.access_order_fulfillments(order_id) on delete cascade,
  generation integer not null,
  trigger_type text not null,
  status text not null,
  idempotency_key text not null,
  idempotency_expires_at timestamptz not null,
  provider text not null,
  entry_ids uuid[] not null,
  entry_count integer not null,
  entry_snapshot_hash text not null,
  request_payload_hash text not null,
  template_version text not null,
  provider_message_id text null,
  error_code text null,
  requested_by_auth_user_id uuid null,
  provider_call_count integer not null default 1,
  last_provider_call_at timestamptz not null,
  started_at timestamptz not null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint access_email_delivery_attempts_generation_chk
    check (generation > 0),
  constraint access_email_delivery_attempts_call_count_chk
    check (provider_call_count > 0),
  constraint access_email_delivery_attempts_trigger_type_chk
    check (trigger_type in ('automatic', 'manual')),
  constraint access_email_delivery_attempts_status_chk
    check (status in ('processing', 'accepted', 'failed', 'ambiguous')),
  constraint access_email_delivery_attempts_key_non_empty_chk
    check (char_length(trim(idempotency_key)) > 0),
  constraint access_email_delivery_attempts_provider_non_empty_chk
    check (char_length(trim(provider)) > 0),
  constraint access_email_delivery_attempts_entry_count_chk
    check (
      entry_count > 0
      and cardinality(entry_ids) = entry_count
      and array_ndims(entry_ids) = 1
      and array_position(entry_ids, null) is null
    ),
  constraint access_email_delivery_attempts_snapshot_hash_chk
    check (entry_snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint access_email_delivery_attempts_request_hash_chk
    check (request_payload_hash ~ '^[0-9a-f]{64}$'),
  constraint access_email_delivery_attempts_template_version_chk
    check (
      char_length(trim(template_version)) > 0
      and template_version = trim(template_version)
    ),
  constraint access_email_delivery_attempts_window_chk
    check (idempotency_expires_at > started_at),
  constraint access_email_delivery_attempts_actor_chk
    check (
      (trigger_type = 'automatic' and requested_by_auth_user_id is null)
      or (trigger_type = 'manual' and requested_by_auth_user_id is not null)
    ),
  constraint access_email_delivery_attempts_state_chk
    check (
      (
        status = 'processing'
        and provider_message_id is null
        and error_code is null
        and finished_at is null
      )
      or (
        status = 'accepted'
        and provider_message_id is not null
        and char_length(trim(provider_message_id)) > 0
        and error_code is null
        and finished_at is not null
      )
      or (
        status = 'failed'
        and provider_message_id is null
        and error_code is not null
        and char_length(trim(error_code)) > 0
        and finished_at is not null
      )
      or (
        status = 'ambiguous'
        and provider_message_id is null
        and error_code is not null
        and char_length(trim(error_code)) > 0
        and finished_at is null
      )
    )
);