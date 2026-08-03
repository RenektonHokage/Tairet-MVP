comment on column
  public.access_order_fulfillments.email_preclaim_terminal_request_hash is
  'Provenance marker for a terminal pre-claim email failure. Contains the SHA-256 of the canonical request, never the plaintext lease token, and does not represent a provider delivery attempt. Any future reopen or generation change must clear this marker.';