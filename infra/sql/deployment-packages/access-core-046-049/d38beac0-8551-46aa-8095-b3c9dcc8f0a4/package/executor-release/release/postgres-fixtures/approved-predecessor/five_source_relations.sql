CREATE TABLE public.access_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    access_ticket_type_id uuid NOT NULL,
    unit_index integer NOT NULL,
    checkin_token uuid DEFAULT gen_random_uuid() NOT NULL,
    attendee_name text NOT NULL,
    attendee_last_name text NOT NULL,
    attendee_email text NOT NULL,
    attendee_phone text NOT NULL,
    attendee_document text NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    checkin_status text DEFAULT 'unused'::text NOT NULL,
    access_date date NOT NULL,
    used_at timestamp with time zone,
    used_by uuid,
    voided_at timestamp with time zone,
    void_reason text,
    email_status text DEFAULT 'not_sent'::text NOT NULL,
    email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_entries_attendee_document_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM attendee_document)) > 0)),
    CONSTRAINT access_entries_attendee_email_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM attendee_email)) > 0)),
    CONSTRAINT access_entries_attendee_last_name_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM attendee_last_name)) > 0)),
    CONSTRAINT access_entries_attendee_name_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM attendee_name)) > 0)),
    CONSTRAINT access_entries_attendee_phone_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM attendee_phone)) > 0)),
    CONSTRAINT access_entries_checkin_status_chk CHECK ((checkin_status = ANY (ARRAY['unused'::text, 'used'::text]))),
    CONSTRAINT access_entries_checkin_used_at_chk CHECK ((((checkin_status = 'used'::text) AND (used_at IS NOT NULL)) OR ((checkin_status = 'unused'::text) AND (used_at IS NULL)))),
    CONSTRAINT access_entries_email_sent_at_chk CHECK (((email_status <> 'sent'::text) OR (email_sent_at IS NOT NULL))),
    CONSTRAINT access_entries_email_status_chk CHECK ((email_status = ANY (ARRAY['not_sent'::text, 'sent'::text, 'failed'::text]))),
    CONSTRAINT access_entries_status_chk CHECK ((status = ANY (ARRAY['issued'::text, 'voided'::text]))),
    CONSTRAINT access_entries_unit_index_positive_chk CHECK ((unit_index > 0)),
    CONSTRAINT access_entries_voided_at_chk CHECK ((((status = 'voided'::text) AND (voided_at IS NOT NULL)) OR ((status = 'issued'::text) AND (voided_at IS NULL)))),
    CONSTRAINT access_entries_voided_not_used_chk CHECK ((NOT ((status = 'voided'::text) AND (checkin_status = 'used'::text))))
);


--
-- Name: access_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    access_ticket_type_id uuid NOT NULL,
    name_snapshot text NOT NULL,
    payment_kind text NOT NULL,
    unit_price_gs bigint NOT NULL,
    currency text DEFAULT 'PYG'::text NOT NULL,
    quantity integer NOT NULL,
    entries_per_unit integer NOT NULL,
    subtotal_gs bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_order_items_currency_chk CHECK ((currency = 'PYG'::text)),
    CONSTRAINT access_order_items_entries_per_unit_positive_chk CHECK ((entries_per_unit > 0)),
    CONSTRAINT access_order_items_name_snapshot_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM name_snapshot)) > 0)),
    CONSTRAINT access_order_items_payment_kind_chk CHECK ((payment_kind = ANY (ARRAY['paid'::text, 'free_pass'::text]))),
    CONSTRAINT access_order_items_payment_kind_price_chk CHECK ((((payment_kind = 'free_pass'::text) AND (unit_price_gs = 0)) OR ((payment_kind = 'paid'::text) AND (unit_price_gs > 0)))),
    CONSTRAINT access_order_items_quantity_positive_chk CHECK ((quantity > 0)),
    CONSTRAINT access_order_items_subtotal_gs_chk CHECK ((subtotal_gs = (unit_price_gs * quantity))),
    CONSTRAINT access_order_items_unit_price_gs_non_negative_chk CHECK ((unit_price_gs >= 0))
);


--
-- Name: access_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_ref text DEFAULT ('acc_'::text || encode(public.gen_random_bytes(16), 'hex'::text)) NOT NULL,
    source_type text NOT NULL,
    local_id uuid,
    event_id uuid,
    access_date date NOT NULL,
    buyer_name text NOT NULL,
    buyer_last_name text NOT NULL,
    buyer_email text NOT NULL,
    buyer_phone text NOT NULL,
    buyer_document text NOT NULL,
    amount_gs bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'PYG'::text NOT NULL,
    payment_required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    expires_at timestamp with time zone,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    expired_at timestamp with time zone,
    manual_review_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_orders_amount_gs_non_negative_chk CHECK ((amount_gs >= 0)),
    CONSTRAINT access_orders_buyer_document_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM buyer_document)) > 0)),
    CONSTRAINT access_orders_buyer_email_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM buyer_email)) > 0)),
    CONSTRAINT access_orders_buyer_last_name_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM buyer_last_name)) > 0)),
    CONSTRAINT access_orders_buyer_name_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM buyer_name)) > 0)),
    CONSTRAINT access_orders_buyer_phone_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM buyer_phone)) > 0)),
    CONSTRAINT access_orders_currency_chk CHECK ((currency = 'PYG'::text)),
    CONSTRAINT access_orders_payment_required_amount_chk CHECK (((payment_required = true) OR (amount_gs = 0))),
    CONSTRAINT access_orders_public_ref_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM public_ref)) > 0)),
    CONSTRAINT access_orders_source_consistency_chk CHECK ((((source_type = 'local'::text) AND (local_id IS NOT NULL) AND (event_id IS NULL)) OR ((source_type = 'event'::text) AND (event_id IS NOT NULL) AND (local_id IS NULL)))),
    CONSTRAINT access_orders_source_type_chk CHECK ((source_type = ANY (ARRAY['local'::text, 'event'::text]))),
    CONSTRAINT access_orders_status_chk CHECK ((status = ANY (ARRAY['pending_payment'::text, 'paid'::text, 'cancelled'::text, 'expired'::text, 'manual_review'::text])))
);


--
-- Name: access_ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_ticket_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    local_id uuid,
    event_id uuid,
    name text NOT NULL,
    description text,
    price_gs bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'PYG'::text NOT NULL,
    payment_kind text NOT NULL,
    entries_per_unit integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_ticket_types_currency_chk CHECK ((currency = 'PYG'::text)),
    CONSTRAINT access_ticket_types_entries_per_unit_positive_chk CHECK ((entries_per_unit > 0)),
    CONSTRAINT access_ticket_types_name_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT access_ticket_types_payment_kind_chk CHECK ((payment_kind = ANY (ARRAY['paid'::text, 'free_pass'::text]))),
    CONSTRAINT access_ticket_types_payment_kind_price_chk CHECK ((((payment_kind = 'free_pass'::text) AND (price_gs = 0)) OR ((payment_kind = 'paid'::text) AND (price_gs > 0)))),
    CONSTRAINT access_ticket_types_price_gs_non_negative_chk CHECK ((price_gs >= 0)),
    CONSTRAINT access_ticket_types_source_consistency_chk CHECK ((((source_type = 'local'::text) AND (local_id IS NOT NULL) AND (event_id IS NULL)) OR ((source_type = 'event'::text) AND (event_id IS NOT NULL) AND (local_id IS NULL)))),
    CONSTRAINT access_ticket_types_source_type_chk CHECK ((source_type = ANY (ARRAY['local'::text, 'event'::text])))
);


--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    source_type text NOT NULL,
    local_id uuid,
    event_id uuid,
    access_date date NOT NULL,
    attempt_number integer NOT NULL,
    provider text NOT NULL,
    provider_operation text NOT NULL,
    provider_attempt_ref text,
    provider_transaction_id text,
    provider_status text,
    provider_response_code text,
    amount_gs bigint NOT NULL,
    currency text DEFAULT 'PYG'::text NOT NULL,
    provider_amount_text text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    request_payload jsonb,
    response_payload jsonb,
    callback_payload jsonb,
    last_error text,
    manual_review_reason text,
    initiated_at timestamp with time zone,
    provider_ready_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    rejected_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    expired_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_attempts_amount_gs_positive_chk CHECK ((amount_gs > 0)),
    CONSTRAINT payment_attempts_attempt_number_positive_chk CHECK ((attempt_number > 0)),
    CONSTRAINT payment_attempts_currency_chk CHECK ((currency = 'PYG'::text)),
    CONSTRAINT payment_attempts_expires_at_chk CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT payment_attempts_provider_amount_text_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM provider_amount_text)) > 0)),
    CONSTRAINT payment_attempts_provider_attempt_ref_non_empty_chk CHECK (((provider_attempt_ref IS NULL) OR (char_length(TRIM(BOTH FROM provider_attempt_ref)) > 0))),
    CONSTRAINT payment_attempts_provider_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM provider)) > 0)),
    CONSTRAINT payment_attempts_provider_operation_non_empty_chk CHECK ((char_length(TRIM(BOTH FROM provider_operation)) > 0)),
    CONSTRAINT payment_attempts_provider_response_code_non_empty_chk CHECK (((provider_response_code IS NULL) OR (char_length(TRIM(BOTH FROM provider_response_code)) > 0))),
    CONSTRAINT payment_attempts_provider_status_non_empty_chk CHECK (((provider_status IS NULL) OR (char_length(TRIM(BOTH FROM provider_status)) > 0))),
    CONSTRAINT payment_attempts_provider_transaction_id_non_empty_chk CHECK (((provider_transaction_id IS NULL) OR (char_length(TRIM(BOTH FROM provider_transaction_id)) > 0))),
    CONSTRAINT payment_attempts_source_consistency_chk CHECK ((((source_type = 'local'::text) AND (local_id IS NOT NULL) AND (event_id IS NULL)) OR ((source_type = 'event'::text) AND (event_id IS NOT NULL) AND (local_id IS NULL)))),
    CONSTRAINT payment_attempts_source_type_chk CHECK ((source_type = ANY (ARRAY['local'::text, 'event'::text]))),
    CONSTRAINT payment_attempts_status_chk CHECK ((status = ANY (ARRAY['created'::text, 'provider_ready'::text, 'pending_confirmation'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text, 'technical_error'::text, 'manual_review'::text])))
);


--
-- Name: access_entries access_entries_checkin_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_checkin_token_unique UNIQUE (checkin_token);


--
-- Name: access_entries access_entries_order_item_unit_index_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_order_item_unit_index_unique UNIQUE (order_item_id, unit_index);


--
-- Name: access_entries access_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_pkey PRIMARY KEY (id);


--
-- Name: access_order_items access_order_items_entry_alignment_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_entry_alignment_unique UNIQUE (id, order_id, access_ticket_type_id);


--
-- Name: access_order_items access_order_items_id_quantity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_id_quantity_unique UNIQUE (id, quantity);


--
-- Name: access_order_items access_order_items_order_ticket_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_order_ticket_type_unique UNIQUE (order_id, access_ticket_type_id);


--
-- Name: access_order_items access_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_pkey PRIMARY KEY (id);


--
-- Name: access_orders access_orders_id_access_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_id_access_date_unique UNIQUE (id, access_date);


--
-- Name: access_orders access_orders_id_amount_currency_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_id_amount_currency_unique UNIQUE (id, amount_gs, currency);


--
-- Name: access_orders access_orders_id_event_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_id_event_id_unique UNIQUE (id, event_id);


--
-- Name: access_orders access_orders_id_local_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_id_local_id_unique UNIQUE (id, local_id);


--
-- Name: access_orders access_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_pkey PRIMARY KEY (id);


--
-- Name: access_orders access_orders_public_ref_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_public_ref_unique UNIQUE (public_ref);


--
-- Name: access_ticket_types access_ticket_types_id_event_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_ticket_types
    ADD CONSTRAINT access_ticket_types_id_event_id_unique UNIQUE (id, event_id);


--
-- Name: access_ticket_types access_ticket_types_id_local_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_ticket_types
    ADD CONSTRAINT access_ticket_types_id_local_id_unique UNIQUE (id, local_id);


--
-- Name: access_ticket_types access_ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_ticket_types
    ADD CONSTRAINT access_ticket_types_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_id_order_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_id_order_id_unique UNIQUE (id, order_id);


--
-- Name: payment_attempts payment_attempts_order_attempt_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_attempt_number_unique UNIQUE (order_id, attempt_number);


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: idx_access_entries_access_date_status_checkin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_entries_access_date_status_checkin ON public.access_entries USING btree (access_date, status, checkin_status);


--
-- Name: idx_access_entries_lower_attendee_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_entries_lower_attendee_email ON public.access_entries USING btree (lower(TRIM(BOTH FROM attendee_email)));


--
-- Name: idx_access_entries_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_entries_order_id ON public.access_entries USING btree (order_id);


--
-- Name: idx_access_entries_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_entries_order_item_id ON public.access_entries USING btree (order_item_id);


--
-- Name: idx_access_entries_ticket_type_access_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_entries_ticket_type_access_date ON public.access_entries USING btree (access_ticket_type_id, access_date);


--
-- Name: idx_access_order_items_access_ticket_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_order_items_access_ticket_type_id ON public.access_order_items USING btree (access_ticket_type_id);


--
-- Name: idx_access_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_order_items_order_id ON public.access_order_items USING btree (order_id);


--
-- Name: idx_access_orders_event_access_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_orders_event_access_date_status ON public.access_orders USING btree (event_id, access_date, status) WHERE (source_type = 'event'::text);


--
-- Name: idx_access_orders_local_access_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_orders_local_access_date_status ON public.access_orders USING btree (local_id, access_date, status) WHERE (source_type = 'local'::text);


--
-- Name: idx_access_orders_lower_buyer_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_orders_lower_buyer_email ON public.access_orders USING btree (lower(TRIM(BOTH FROM buyer_email)));


--
-- Name: idx_access_orders_status_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_orders_status_expires_at ON public.access_orders USING btree (status, expires_at);


--
-- Name: idx_access_ticket_types_event_active_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_access_ticket_types_event_active_name_unique ON public.access_ticket_types USING btree (event_id, lower(TRIM(BOTH FROM name))) WHERE ((source_type = 'event'::text) AND (active = true));


--
-- Name: idx_access_ticket_types_event_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_ticket_types_event_active_sort ON public.access_ticket_types USING btree (event_id, active, sort_order) WHERE (source_type = 'event'::text);


--
-- Name: idx_access_ticket_types_local_active_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_access_ticket_types_local_active_name_unique ON public.access_ticket_types USING btree (local_id, lower(TRIM(BOTH FROM name))) WHERE ((source_type = 'local'::text) AND (active = true));


--
-- Name: idx_access_ticket_types_local_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_ticket_types_local_active_sort ON public.access_ticket_types USING btree (local_id, active, sort_order) WHERE (source_type = 'local'::text);


--
-- Name: idx_payment_attempts_blocking_provider_operation_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_attempts_blocking_provider_operation_unique ON public.payment_attempts USING btree (order_id, provider, provider_operation) WHERE (status = ANY (ARRAY['created'::text, 'provider_ready'::text, 'pending_confirmation'::text, 'approved'::text, 'manual_review'::text]));


--
-- Name: idx_payment_attempts_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_created_at_desc ON public.payment_attempts USING btree (created_at DESC);


--
-- Name: idx_payment_attempts_event_access_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_event_access_date_status ON public.payment_attempts USING btree (event_id, access_date, status) WHERE (source_type = 'event'::text);


--
-- Name: idx_payment_attempts_local_access_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_local_access_date_status ON public.payment_attempts USING btree (local_id, access_date, status) WHERE (source_type = 'local'::text);


--
-- Name: idx_payment_attempts_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_order_id ON public.payment_attempts USING btree (order_id);


--
-- Name: idx_payment_attempts_provider_attempt_ref_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_attempts_provider_attempt_ref_unique ON public.payment_attempts USING btree (provider, provider_operation, provider_attempt_ref) WHERE (provider_attempt_ref IS NOT NULL);


--
-- Name: idx_payment_attempts_provider_operation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_provider_operation_status ON public.payment_attempts USING btree (provider, provider_operation, status);


--
-- Name: idx_payment_attempts_provider_transaction_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_attempts_provider_transaction_unique ON public.payment_attempts USING btree (provider, provider_operation, provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);


--
-- Name: idx_payment_attempts_status_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_status_expires_at ON public.payment_attempts USING btree (status, expires_at);


--
-- Name: access_entries access_entries_order_access_date_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_order_access_date_alignment_fk FOREIGN KEY (order_id, access_date) REFERENCES public.access_orders(id, access_date) ON DELETE RESTRICT;


--
-- Name: access_entries access_entries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.access_orders(id) ON DELETE RESTRICT;


--
-- Name: access_entries access_entries_order_item_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_entries
    ADD CONSTRAINT access_entries_order_item_alignment_fk FOREIGN KEY (order_item_id, order_id, access_ticket_type_id) REFERENCES public.access_order_items(id, order_id, access_ticket_type_id) ON DELETE RESTRICT;


--
-- Name: access_order_items access_order_items_access_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_access_ticket_type_id_fkey FOREIGN KEY (access_ticket_type_id) REFERENCES public.access_ticket_types(id) ON DELETE RESTRICT;


--
-- Name: access_order_items access_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_order_items
    ADD CONSTRAINT access_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.access_orders(id) ON DELETE RESTRICT;


--
-- Name: access_orders access_orders_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: access_orders access_orders_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_orders
    ADD CONSTRAINT access_orders_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locals(id) ON DELETE RESTRICT;


--
-- Name: access_ticket_types access_ticket_types_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_ticket_types
    ADD CONSTRAINT access_ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: access_ticket_types access_ticket_types_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_ticket_types
    ADD CONSTRAINT access_ticket_types_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locals(id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locals(id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_access_date_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_access_date_alignment_fk FOREIGN KEY (order_id, access_date) REFERENCES public.access_orders(id, access_date) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_amount_currency_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_amount_currency_alignment_fk FOREIGN KEY (order_id, amount_gs, currency) REFERENCES public.access_orders(id, amount_gs, currency) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_event_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_event_alignment_fk FOREIGN KEY (order_id, event_id) REFERENCES public.access_orders(id, event_id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.access_orders(id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_local_alignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_local_alignment_fk FOREIGN KEY (order_id, local_id) REFERENCES public.access_orders(id, local_id) ON DELETE RESTRICT;


--
-- Name: access_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: access_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: access_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: access_ticket_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_ticket_types ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
