alter table public.access_order_fulfillments
  add constraint access_order_fulfillments_email_preclaim_terminal_marker_chk
  check (
    email_preclaim_terminal_request_hash is null
    or (
      email_preclaim_terminal_request_hash ~ '^[0-9a-f]{64}$'
      and issuance_status = 'complete'
      and issuance_review_status = 'none'
      and email_status = 'manual_review'
      and email_next_attempt_at is null
      and email_sent_at is null
      and (
        email_last_error_code = 'order_invalid'
        or email_last_error_code = 'order_items_invalid'
        or email_last_error_code = 'entries_not_found'
        or email_last_error_code = 'entries_invalid'
        or email_last_error_code = 'entry_count_mismatch'
        or email_last_error_code = 'entry_not_deliverable'
        or email_last_error_code = 'source_invalid'
        or email_last_error_code = 'invalid_recipient'
      )
      and email_last_error_at is not null
      and email_provider_message_id is null
      and reconcile_lease_token is null
      and reconcile_lease_expires_at is null
      and reconcile_lease_epoch > 0
      and email_generation > 0
    )
  );