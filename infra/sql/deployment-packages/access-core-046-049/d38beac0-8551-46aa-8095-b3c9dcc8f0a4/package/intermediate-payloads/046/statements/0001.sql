create table public.access_order_fulfillments (
  order_id uuid primary key
    references public.access_orders(id) on delete restrict,
  approved_payment_attempt_id uuid not null,
  expected_entries integer not null,
  issued_entries integer not null,
  issuance_status text not null,
  issuance_attempt_count integer not null default 0,
  issuance_last_attempt_at timestamptz null,
  issuance_next_attempt_at timestamptz null,
  issuance_last_error_code text null,
  issuance_last_error_at timestamptz null,
  issuance_review_status text not null default 'none',
  issuance_review_error_code text null,
  issuance_review_error_at timestamptz null,
  email_status text not null,
  email_generation integer not null default 1,
  email_next_attempt_at timestamptz null,
  email_sent_at timestamptz null,
  email_last_error_code text null,
  email_last_error_at timestamptz null,
  email_provider_message_id text null,
  reconcile_lease_token uuid null,
  reconcile_lease_expires_at timestamptz null,
  reconcile_lease_epoch bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_order_fulfillments_attempt_order_fk
    foreign key (approved_payment_attempt_id, order_id)
    references public.payment_attempts(id, order_id)
    on delete restrict,
  constraint access_order_fulfillments_counts_chk
    check (
      expected_entries >= 0
      and issued_entries >= 0
      and issuance_attempt_count >= 0
      and email_generation > 0
    ),
  constraint access_order_fulfillments_issuance_status_chk
    check (issuance_status in ('pending', 'partial', 'complete', 'manual_review')),
  constraint access_order_fulfillments_email_status_chk
    check (email_status in ('pending', 'processing', 'failed', 'sent', 'manual_review')),
  constraint access_order_fulfillments_attempt_clock_chk
    check (
      (issuance_attempt_count = 0 and issuance_last_attempt_at is null)
      or (issuance_attempt_count > 0 and issuance_last_attempt_at is not null)
    ),
  constraint access_order_fulfillments_issuance_error_pair_chk
    check (
      (issuance_last_error_code is null and issuance_last_error_at is null)
      or (
        issuance_last_error_code is not null
        and char_length(trim(issuance_last_error_code)) > 0
        and issuance_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_issuance_review_status_chk
    check (issuance_review_status in ('none', 'manual_review')),
  constraint access_order_fulfillments_issuance_review_error_chk
    check (
      (
        issuance_review_status = 'none'
        and issuance_review_error_code is null
        and issuance_review_error_at is null
      )
      or (
        issuance_review_status = 'manual_review'
        and issuance_review_error_code is not null
        and char_length(trim(issuance_review_error_code)) > 0
        and issuance_review_error_at is not null
      )
    ),
  constraint access_order_fulfillments_issuance_review_relation_chk
    check (
      issuance_review_status = 'none'
      or (
        issuance_review_status = 'manual_review'
        and issuance_status = 'complete'
      )
    ),
  constraint access_order_fulfillments_email_error_pair_chk
    check (
      (email_last_error_code is null and email_last_error_at is null)
      or (
        email_last_error_code is not null
        and char_length(trim(email_last_error_code)) > 0
        and email_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_lease_pair_chk
    check (
      (reconcile_lease_token is null and reconcile_lease_expires_at is null)
      or (
        reconcile_lease_token is not null
        and reconcile_lease_expires_at is not null
        and reconcile_lease_epoch > 0
      )
    ),
  constraint access_order_fulfillments_lease_epoch_chk
    check (reconcile_lease_epoch >= 0),
  constraint access_order_fulfillments_provider_message_chk
    check (
      email_provider_message_id is null
      or char_length(trim(email_provider_message_id)) > 0
    ),
  constraint access_order_fulfillments_issuance_state_chk
    check (
      (
        issuance_status = 'pending'
        and expected_entries > 0
        and issued_entries = 0
        and issuance_next_attempt_at is not null
      )
      or (
        issuance_status = 'partial'
        and expected_entries > 0
        and issued_entries > 0
        and issued_entries < expected_entries
        and issuance_next_attempt_at is not null
      )
      or (
        issuance_status = 'complete'
        and expected_entries > 0
        and issuance_next_attempt_at is null
        and issuance_last_error_code is null
        and issuance_last_error_at is null
        and (
          (
            issuance_review_status = 'none'
            and issued_entries = expected_entries
          )
          or issuance_review_status = 'manual_review'
        )
      )
      or (
        issuance_status = 'manual_review'
        and issuance_next_attempt_at is null
        and issuance_last_error_code is not null
        and issuance_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_email_state_chk
    check (
      (
        issuance_status <> 'complete'
        and email_status = 'pending'
        and email_next_attempt_at is null
        and email_sent_at is null
        and email_last_error_code is null
        and email_last_error_at is null
        and email_provider_message_id is null
      )
      or (
        issuance_status = 'complete'
        and (
          (
            email_status = 'pending'
            and email_next_attempt_at is not null
            and email_sent_at is null
            and email_last_error_code is null
            and email_last_error_at is null
            and email_provider_message_id is null
          )
          or (
            email_status = 'processing'
            and reconcile_lease_token is not null
            and reconcile_lease_expires_at is not null
            and email_next_attempt_at is null
            and email_sent_at is null
            and email_last_error_code is null
            and email_last_error_at is null
            and email_provider_message_id is null
          )
          or (
            email_status = 'failed'
            and email_next_attempt_at is not null
            and email_sent_at is null
            and email_last_error_code is not null
            and email_last_error_at is not null
            and email_provider_message_id is null
          )
          or (
            email_status = 'sent'
            and email_next_attempt_at is null
            and email_sent_at is not null
            and email_last_error_code is null
            and email_last_error_at is null
            and reconcile_lease_token is null
            and reconcile_lease_expires_at is null
          )
          or (
            email_status = 'manual_review'
            and email_next_attempt_at is null
            and email_sent_at is null
            and email_last_error_code is not null
            and email_last_error_at is not null
            and email_provider_message_id is null
            and reconcile_lease_token is null
            and reconcile_lease_expires_at is null
          )
        )
      )
    ),
  constraint access_order_fulfillments_timestamps_chk
    check (updated_at >= created_at)
);