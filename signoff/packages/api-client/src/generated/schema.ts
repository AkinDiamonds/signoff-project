export interface paths {
    "/api/approvals/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get merchant approval card
         * @description Retrieves approval card data for a valid, unexpired, and unresolved token. Returns uniform 404 otherwise.
         */
        get: operations["get_approval_card_api_approvals__token__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/{token}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve merchant approval
         * @description Resolves an approval card with approve, deny, or edit. Atomic and enforces waiver rules and dispute freshness.
         */
        post: operations["post_resolve_approval_api_approvals__token__resolve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Session Status */
        get: operations["session_status_api_auth_session_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/charter": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get active or historical charter
         * @description Retrieves active charter, seeds default v1 if uninitialized, or returns a specific version.
         */
        get: operations["get_charter_api_charter_get"];
        /**
         * Update charter with optimistic concurrency control
         * @description Creates a new immutable version based on base_version. Returns 409 conflict if stale.
         */
        put: operations["put_charter_api_charter_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/charter/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get complete charter version history
         * @description Returns all charter versions ordered newest first.
         */
        get: operations["list_charter_history_api_charter_history_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/claim/{dispute_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Claim Dispute
         * @description Claim a pooled dispute for judge evaluation, enqueuing a RUN_AGENT job.
         */
        post: operations["claim_dispute_api_demo_claim__dispute_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/pool": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Pool
         * @description Return pooled disputes for demo judge flow, or scenario counts in legacy stub mode.
         */
        get: operations["get_pool_api_demo_pool_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset
         * @description Hide this session's disputes and issue a fresh session.
         */
        post: operations["reset_api_demo_reset_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/scenarios/{scenario_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Scenario
         * @description Claim a pooled transaction, create the dispute, and tag it to the session.
         */
        post: operations["create_scenario_api_demo_scenarios__scenario_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List and filter disputes
         * @description Returns a paginated list of disputes filtered by status, reason, or due-date. Due-date sorting puts nulls last.
         */
        get: operations["list_disputes_api_disputes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/disputes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get dispute details
         * @description Returns full dispute details, snapshot payload, latest verdict, and linked order code.
         */
        get: operations["get_dispute_by_id_api_disputes__id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/disputes/{id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get dispute gate decisions
         * @description Returns decisions recorded for a dispute with cursor pagination.
         */
        get: operations["get_dispute_decisions_api_disputes__id__decisions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/disputes/{id}/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get dispute timeline events
         * @description Returns strictly ordered timeline events by sequence number with cursor pagination.
         */
        get: operations["get_dispute_timeline_api_disputes__id__timeline_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Check Connections */
        post: operations["check_connections_api_integrations_check_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Status */
        get: operations["get_status_api_integrations_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kpis": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get aggregated dispute operations KPIs
         * @description Returns metrics for open disputes, dollars at risk, recovered, conceded, auto-resolution share, and estimated hours saved with explicit assumption values.
         */
        get: operations["get_kpis_api_kpis_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/llm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask the read-only dashboard assistant
         * @description Proxies one chat turn to the configured LLM. The key stays server-side, the model is fixed by configuration, client model overrides are ignored, and no mutating tool exists.
         */
        post: operations["ask_assistant_api_llm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/llm/studio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask the Studio native AI assistant
         * @description Accepts AG Studio's AgLlmRequest wire format (input / instructions / tools / responseFormat). Converts the input to a flat message list, prepends the Studio system instruction (four-question limit), and proxies to the configured LLM. The LLM key never leaves the server. Studio page-layout tools are allowed in addition to the read-only dashboard data tools; PayPal-shaped mutations are not.
         */
        post: operations["ask_studio_assistant_api_llm_studio_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Catalog
         * @description List all available products in the storefront catalog.
         */
        get: operations["list_catalog_api_shop_catalog_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/catalog/{sku}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Product Detail
         * @description Retrieve details for a single catalog item.
         */
        get: operations["get_product_detail_api_shop_catalog__sku__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Order
         * @description Create a new storefront order, computing total on the server.
         */
        post: operations["create_order_api_shop_orders_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order By Code
         * @description Retrieve order details for buyers, requiring order code and email.
         */
        get: operations["get_order_by_code_api_shop_orders__order_code__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}/capture": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Capture Order
         * @description Capture payment for an order and schedule mock tracking.
         */
        post: operations["capture_order_api_shop_orders__order_code__capture_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}/dispute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order Dispute Status
         * @description Check dispute eligibility and retrieve any active dispute for an order.
         */
        get: operations["get_order_dispute_status_api_shop_orders__order_code__dispute_get"];
        put?: never;
        /**
         * Create Buyer Dispute
         * @description Create a new PayPal dispute for a storefront order as the buyer.
         */
        post: operations["create_buyer_dispute_api_shop_orders__order_code__dispute_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}/dispute/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send Buyer Dispute Message
         * @description Send a buyer reply message on an active dispute (Scenario D).
         */
        post: operations["send_buyer_dispute_message_api_shop_orders__order_code__dispute_messages_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}/dispute/offer-response": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Respond To Merchant Offer
         * @description Buyer accepts or declines a merchant settlement offer (Scenario C / S9).
         */
        post: operations["respond_to_merchant_offer_api_shop_orders__order_code__dispute_offer_response_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shop/orders/{order_code}/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reconcile
         * @description Reconcile an order found at PayPal but missing local capture status.
         */
        post: operations["reconcile_api_shop_orders__order_code__reconcile_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Api Status
         * @description Service status, queue metrics, and operating environment flags.
         */
        get: operations["api_status_api_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/store/orders/by-transaction/{transaction_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order By Transaction
         * @description Retrieve an order by PayPal transaction ID.
         */
        get: operations["get_order_by_transaction_api_store_orders_by_transaction__transaction_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/store/orders/{order_code}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order Messages
         * @description Retrieve buyer messages for an order from dispute records, or empty list if none.
         */
        get: operations["get_order_messages_api_store_orders__order_code__messages_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/store/orders/{order_code}/shipments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order Shipments
         * @description Retrieve shipment tracking events for an order ordered by event_time.
         */
        get: operations["get_order_shipments_api_store_orders__order_code__shipments_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/store/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Policies
         * @description Return static merchant policies.
         */
        get: operations["get_policies_api_store_policies_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Healthz
         * @description Liveness check without database dependency.
         */
        get: operations["healthz_healthz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readyz
         * @description Readiness check verifying database connectivity.
         */
        get: operations["readyz_readyz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/paypal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * PayPal Webhook Event Ingestion
         * @description Safely ingests and verifies incoming PayPal webhook notifications, deduplicating events and enqueuing sync jobs transactionally.
         */
        post: operations["paypal_webhook_receiver_webhooks_paypal_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * ActionType
         * @description Proposed action type for PayPal disputes.
         * @enum {string}
         */
        ActionType: "PROVIDE_EVIDENCE" | "SEND_MESSAGE" | "MAKE_OFFER" | "ACCEPT_CLAIM" | "ESCALATE" | "APPEAL";
        /**
         * ApprovalCardResponse
         * @description Merchant approval card details returned by GET /api/approvals/{token}.
         */
        ApprovalCardResponse: {
            /** Action Payload */
            action_payload: {
                [key: string]: unknown;
            };
            action_type: components["schemas"]["ActionType"];
            /** Created At */
            created_at: string;
            /** Decision Id */
            decision_id: string;
            dispute: components["schemas"]["DisputeCardSummary"];
            /** Dispute Id */
            dispute_id: string;
            /** Expires At */
            expires_at: string;
            /** Id */
            id: string;
            /** Notes */
            notes?: string | null;
            /** Payload Hash */
            payload_hash: string;
            /** Reason */
            reason: string;
            resolution: components["schemas"]["ApprovalResolution"];
            /** Resolved At */
            resolved_at?: string | null;
            /** Rule Id */
            rule_id: string;
            /** Token Hash */
            token_hash: string;
            verdict: components["schemas"]["Verdict"];
        };
        /** ApprovalRequestedTimelineEvent */
        ApprovalRequestedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default APPROVAL_REQUESTED
             * @constant
             */
            kind: "APPROVAL_REQUESTED";
            /** Sequence Number */
            sequence_number: number;
            /** Token Hash */
            token_hash: string;
        };
        /**
         * ApprovalResolution
         * @description Approval card resolution status.
         * @enum {string}
         */
        ApprovalResolution: "PENDING" | "APPROVE" | "DENY" | "EDIT" | "EXPIRED";
        /** ApprovalResolvedTimelineEvent */
        ApprovalResolvedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default APPROVAL_RESOLVED
             * @constant
             */
            kind: "APPROVAL_RESOLVED";
            /** Resolution */
            resolution: string;
            /** Sequence Number */
            sequence_number: number;
        };
        /**
         * ApproveResolveRequest
         * @description Approve the proposed action through executor waiver rules.
         */
        ApproveResolveRequest: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "APPROVE";
            /**
             * Notes
             * @description Optional merchant audit notes
             */
            notes?: string | null;
        };
        /** AssistantMessage */
        AssistantMessage: {
            /** Content */
            content: string;
            /**
             * Role
             * @enum {string}
             */
            role: "user" | "assistant" | "system";
        };
        /** AssistantRequest */
        AssistantRequest: {
            /** Messages */
            messages: components["schemas"]["AssistantMessage"][];
            /** Model */
            model?: string | null;
            /** Tools */
            tools?: components["schemas"]["AssistantTool"][] | null;
        };
        /** AssistantResponse */
        AssistantResponse: {
            /** Answer */
            answer: string;
            /**
             * Cached
             * @default false
             */
            cached: boolean;
            /** Model */
            model: string;
        };
        /** AssistantTool */
        AssistantTool: {
            /** Description */
            description?: string | null;
            /** Name */
            name: string;
        };
        /**
         * BuyerDisputeDetailResponse
         * @description Complete buyer-facing dispute status and history.
         */
        BuyerDisputeDetailResponse: {
            amount: components["schemas"]["Money-Output"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Id */
            id: string;
            /** Messages */
            messages: components["schemas"]["DisputeMessageResponse"][];
            offer?: components["schemas"]["DisputeOfferResponse"] | null;
            /** Order Code */
            order_code: string;
            /** Reason */
            reason: string;
            /** Seller Response Due Date */
            seller_response_due_date?: string | null;
            /** Status */
            status: string;
            /** Transaction Id */
            transaction_id: string;
        };
        /**
         * CaptureOrderRequest
         * @description Optional payload for order capture.
         */
        CaptureOrderRequest: {
            /** Paypal Order Id */
            paypal_order_id?: string | null;
        };
        /**
         * CaptureOrderResponse
         * @description Result of order capture.
         */
        CaptureOrderResponse: {
            /** Carrier */
            carrier?: string | null;
            /** Order Code */
            order_code: string;
            /** Paypal Transaction Id */
            paypal_transaction_id: string;
            /** Status */
            status: string;
            /** Tracking Number */
            tracking_number?: string | null;
        };
        /**
         * CharterResponse
         * @description Full versioned charter response shape.
         */
        CharterResponse: {
            auto_accept_max: components["schemas"]["MoneyLimit-Output"];
            auto_act_max_dispute_amount: components["schemas"]["MoneyLimit-Output"];
            auto_offer_max: components["schemas"]["MoneyLimit-Output"];
            /**
             * Auto Provide Evidence
             * @default true
             */
            auto_provide_evidence: boolean;
            /**
             * Auto Send Message
             * @default true
             */
            auto_send_message: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Never Auto Actions */
            never_auto_actions?: components["schemas"]["ActionType"][];
            /** Never Auto Reasons */
            never_auto_reasons?: components["schemas"]["DisputeReason"][];
            /**
             * Repeat Disputer Threshold
             * @default 2
             */
            repeat_disputer_threshold: number;
            /** Version */
            version: number;
        };
        /** ClaimDisputeResponse */
        ClaimDisputeResponse: {
            /** Dispute Id */
            dispute_id: string;
            /** Status */
            status: string;
        };
        /**
         * CreateDisputeRequest
         * @description Buyer dispute filing payload.
         */
        CreateDisputeRequest: {
            amount: components["schemas"]["Money-Input"];
            /** Customer Email */
            customer_email: string;
            /** Message */
            message: string;
            reason: components["schemas"]["SupportedDisputeReason"];
        };
        /**
         * CreateOrderRequest
         * @description Buyer order creation request.
         */
        CreateOrderRequest: {
            /** Customer Email */
            customer_email: string;
            /** Demo Session Id */
            demo_session_id?: string | null;
            /** Items */
            items: components["schemas"]["OrderItemRequest"][];
        };
        /**
         * CreateOrderResponse
         * @description Result of order creation.
         */
        CreateOrderResponse: {
            amount: components["schemas"]["Money-Output"];
            /** Order Code */
            order_code: string;
            /** Paypal Order Id */
            paypal_order_id: string;
            /** Status */
            status: string;
        };
        /** DecisionItem */
        DecisionItem: {
            /** Action Hash */
            action_hash: string;
            /** Action Payload */
            action_payload?: {
                [key: string]: unknown;
            } | null;
            /** Action Type */
            action_type: string;
            /** Also Triggered */
            also_triggered?: string[];
            /** Charter Version */
            charter_version: number;
            /** Created At */
            created_at: string;
            /** Dispute Fingerprint */
            dispute_fingerprint: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /** Reason */
            reason: string;
            /** Rule Id */
            rule_id: string;
            /** Verdict */
            verdict: string;
        };
        /** DecisionsResponse */
        DecisionsResponse: {
            /** Items */
            items: components["schemas"]["DecisionItem"][];
            /** Next Cursor */
            next_cursor?: string | null;
        };
        /** DemoPoolDisputeItem */
        DemoPoolDisputeItem: {
            amount: components["schemas"]["Money-Output"];
            /** Claimed At */
            claimed_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Latest Rule Id */
            latest_rule_id?: string | null;
            /** Latest Verdict */
            latest_verdict?: string | null;
            /** Reason */
            reason: string;
            /** Scenario Label */
            scenario_label?: string | null;
            /** Seller Response Due Date */
            seller_response_due_date?: string | null;
            /** State */
            state: string;
        };
        /**
         * DenyResolveRequest
         * @description Deny the proposed action, recording decision and taking no further action.
         */
        DenyResolveRequest: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "DENY";
            /**
             * Notes
             * @description Optional merchant audit notes
             */
            notes?: string | null;
            /**
             * Reason
             * @description Merchant reason for denial
             */
            reason?: string | null;
        };
        /**
         * DisputeCardSummary
         * @description Dispute context snapshot for human review card.
         */
        DisputeCardSummary: {
            amount: components["schemas"]["EditMoneySchema"];
            /** Buyer Message */
            buyer_message?: string | null;
            /** Id */
            id: string;
            /** Reason */
            reason: string;
            /** Seller Response Due Date */
            seller_response_due_date?: string | null;
            /** Status */
            status: string;
        };
        /**
         * DisputeDetailResponse
         * @description Complete dispute details including raw snapshot.
         */
        DisputeDetailResponse: {
            amount: components["schemas"]["Money-Output"];
            /** Approval Url */
            approval_url?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Id */
            id: string;
            /** Latest Rule Id */
            latest_rule_id?: string | null;
            latest_verdict?: components["schemas"]["Verdict"] | null;
            /** Order Code */
            order_code?: string | null;
            reason: components["schemas"]["DisputeReason"];
            /** Seller Response Due Date */
            seller_response_due_date?: string | null;
            /** Snapshot */
            snapshot: {
                [key: string]: unknown;
            };
            /** State Fingerprint */
            state_fingerprint: string;
            status: components["schemas"]["DisputeStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * DisputeListItem
         * @description Dispute item for dashboard list and grids.
         */
        DisputeListItem: {
            amount: components["schemas"]["Money-Output"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Id */
            id: string;
            /** Latest Rule Id */
            latest_rule_id?: string | null;
            latest_verdict?: components["schemas"]["Verdict"] | null;
            /** Order Code */
            order_code?: string | null;
            reason: components["schemas"]["DisputeReason"];
            /** Seller Response Due Date */
            seller_response_due_date?: string | null;
            /** State Fingerprint */
            state_fingerprint: string;
            status: components["schemas"]["DisputeStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * DisputeMessageResponse
         * @description Dispute communication message.
         */
        DisputeMessageResponse: {
            /** Content */
            content: string;
            /** Posted By */
            posted_by: string;
            /**
             * Time Posted
             * Format: date-time
             */
            time_posted: string;
        };
        /**
         * DisputeOfferResponse
         * @description Merchant offer details.
         */
        DisputeOfferResponse: {
            amount: components["schemas"]["Money-Output"];
            /** Note */
            note?: string | null;
            /** Offer Type */
            offer_type: string;
            /** Status */
            status?: string | null;
        };
        /**
         * DisputeReason
         * @description PayPal dispute reason categories.
         * @enum {string}
         */
        DisputeReason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" | "UNAUTHORISED" | "CREDIT_NOT_PROCESSED" | "DUPLICATE_TRANSACTION" | "INCORRECT_AMOUNT" | "PAYMENT_BY_OTHER_MEANS" | "CANCELED_RECURRING_BILLING" | "PROBLEM_WITH_REMITTANCE" | "OTHER";
        /**
         * DisputeStatus
         * @description Denormalized PayPal dispute status.
         * @enum {string}
         */
        DisputeStatus: "WAITING_FOR_SELLER_RESPONSE" | "WAITING_FOR_BUYER_RESPONSE" | "UNDER_REVIEW" | "RESOLVED" | "OPEN" | "OTHER";
        /** DisputeSyncedTimelineEvent */
        DisputeSyncedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default DISPUTE_SYNCED
             * @constant
             */
            kind: "DISPUTE_SYNCED";
            /** Sequence Number */
            sequence_number: number;
            /** Status */
            status: string;
        };
        /**
         * DisputesResponse
         * @description Paginated dispute list response.
         */
        DisputesResponse: {
            /** Items */
            items: components["schemas"]["DisputeListItem"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total Count */
            total_count?: number | null;
        };
        /**
         * EditMoneySchema
         * @description Money amount submitted on an approval edit.
         *
         *     Unlike the LLM-facing schema in ``agent.app.agent.schemas``, this one keeps the
         *     raw decimal string and does not enforce a positive value. Approving a human edit
         *     is a domain decision, so the service validates positivity, precision and the
         *     disputed-amount ceiling and reports each violation as a 422 ``EditValidationError``.
         */
        EditMoneySchema: {
            /**
             * Currency Code
             * @description 3-letter ISO currency code
             * @default USD
             */
            currency_code: string;
            /**
             * Value
             * @description Decimal string representation of the amount, e.g. '25.00'
             */
            value: string;
        };
        /**
         * EditResolveRequest
         * @description Edit amount and/or message and re-run gate evaluation.
         */
        EditResolveRequest: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "EDIT";
            /** @description Edited monetary amount */
            amount?: components["schemas"]["EditMoneySchema"] | null;
            /**
             * Message
             * @description Edited message content
             */
            message?: string | null;
            /**
             * Notes
             * @description Optional merchant audit notes
             */
            notes?: string | null;
        };
        /** ErrorDetail */
        ErrorDetail: {
            /** Code */
            code: string;
            /** Correlation Id */
            correlation_id: string;
            /** Fields */
            fields?: components["schemas"]["FieldError"][];
            /** Message */
            message: string;
        };
        /** ErrorEnvelope */
        ErrorEnvelope: {
            error: components["schemas"]["ErrorDetail"];
        };
        /** EvidenceBuiltTimelineEvent */
        EvidenceBuiltTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Evidence Strength */
            evidence_strength: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default EVIDENCE_BUILT
             * @constant
             */
            kind: "EVIDENCE_BUILT";
            /** Sequence Number */
            sequence_number: number;
        };
        /** ExecutionConfirmedTimelineEvent */
        ExecutionConfirmedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** External Id */
            external_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default EXECUTION_CONFIRMED
             * @constant
             */
            kind: "EXECUTION_CONFIRMED";
            /** Sequence Number */
            sequence_number: number;
        };
        /** ExecutionFailedTimelineEvent */
        ExecutionFailedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Error Message */
            error_message: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default EXECUTION_FAILED
             * @constant
             */
            kind: "EXECUTION_FAILED";
            /** Sequence Number */
            sequence_number: number;
        };
        /** ExecutionIntendedTimelineEvent */
        ExecutionIntendedTimelineEvent: {
            /** Action Type */
            action_type: string;
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default EXECUTION_INTENDED
             * @constant
             */
            kind: "EXECUTION_INTENDED";
            /** Sequence Number */
            sequence_number: number;
        };
        /** ExecutionSentTimelineEvent */
        ExecutionSentTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default EXECUTION_SENT
             * @constant
             */
            kind: "EXECUTION_SENT";
            /** Payload */
            payload?: {
                [key: string]: unknown;
            };
            /** Sequence Number */
            sequence_number: number;
        };
        /** FieldError */
        FieldError: {
            /** Message */
            message: string;
            /** Path */
            path: string;
        };
        /** GateDecidedTimelineEvent */
        GateDecidedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default GATE_DECIDED
             * @constant
             */
            kind: "GATE_DECIDED";
            /** Rule Id */
            rule_id: string;
            /** Sequence Number */
            sequence_number: number;
            /** Verdict */
            verdict: string;
        };
        /** InjectionFlaggedTimelineEvent */
        InjectionFlaggedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default INJECTION_FLAGGED
             * @constant
             */
            kind: "INJECTION_FLAGGED";
            /** Rule Id */
            rule_id: string;
            /** Sequence Number */
            sequence_number: number;
        };
        /** IntegrationStatus */
        IntegrationStatus: {
            llm: components["schemas"]["ReadinessItem"];
            /** Merchant Id */
            merchant_id: string | null;
            paypal: components["schemas"]["ReadinessItem"];
            paypal_environment: components["schemas"]["PayPalEnv"];
            store: components["schemas"]["ReadinessItem"];
            webhook: components["schemas"]["ReadinessItem"];
            /** Webhook Url */
            webhook_url: string;
            worker: components["schemas"]["ReadinessItem"];
        };
        /**
         * KpiResponse
         * @description Aggregated operational metrics for dispute management.
         */
        KpiResponse: {
            /**
             * Assumed Minutes Per Dispute
             * @description Assumption value of minutes saved per dispute
             * @default 20
             */
            assumed_minutes_per_dispute: number;
            /**
             * Auto Resolved Disputes
             * @description Count of closed disputes resolved without human approval
             */
            auto_resolved_disputes: number;
            /**
             * Closed Disputes
             * @description Total count of closed disputes
             */
            closed_disputes: number;
            /**
             * Conceded
             * @description Sum of amounts refunded or conceded on USD disputes
             */
            conceded: string;
            /**
             * Dollars At Risk
             * @description Sum of amounts on open USD disputes formatted as a decimal string
             */
            dollars_at_risk: string;
            /**
             * Estimated Hours Saved
             * @description Estimated operational hours saved (null when closed disputes is 0)
             */
            estimated_hours_saved?: number | null;
            /**
             * Non Usd Open Disputes
             * @description Total count of open disputes in non-USD currencies
             * @default 0
             */
            non_usd_open_disputes: number;
            /**
             * Open Disputes
             * @description Count of open disputes (waiting for seller response or pending human approval)
             */
            open_disputes: number;
            /**
             * Other Currency Open Disputes
             * @description Breakdown of open disputes in non-USD currencies
             */
            other_currency_open_disputes?: {
                [key: string]: number;
            };
            /**
             * Recovered
             * @description Sum of amounts on USD disputes resolved in merchant's favor
             */
            recovered: string;
            /**
             * Share Auto Resolved
             * @description Proportion of closed disputes auto-resolved (null when closed disputes is 0)
             */
            share_auto_resolved?: number | null;
        };
        /** LoginRequest */
        LoginRequest: {
            /** Email */
            email: string;
            /**
             * Password
             * Format: password
             */
            password: string;
        };
        /**
         * Money
         * @description Monetary amount with ISO currency code per build-plan/contracts.md.
         *
         *     Amounts must arrive as strings and become Decimal. JSON floats are rejected;
         *     zero or negative amounts are invalid; currency must be three uppercase letters.
         */
        "Money-Input": {
            /** Currency Code */
            currency_code: string;
            /** Value */
            value: number | string;
        };
        /**
         * Money
         * @description Monetary amount with ISO currency code per build-plan/contracts.md.
         *
         *     Amounts must arrive as strings and become Decimal. JSON floats are rejected;
         *     zero or negative amounts are invalid; currency must be three uppercase letters.
         */
        "Money-Output": {
            /** Currency Code */
            currency_code: string;
            /** Value */
            value: string;
        };
        /**
         * MoneyLimit
         * @description Monetary limit enforcing fixed-precision Decimal and merchant currency.
         */
        "MoneyLimit-Input": {
            /** Currency Code */
            currency_code: string;
            /** Value */
            value: number | string;
        };
        /**
         * MoneyLimit
         * @description Monetary limit enforcing fixed-precision Decimal and merchant currency.
         */
        "MoneyLimit-Output": {
            /** Currency Code */
            currency_code: string;
            /** Value */
            value: string;
        };
        /** NoActionTimelineEvent */
        NoActionTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default NO_ACTION
             * @constant
             */
            kind: "NO_ACTION";
            /** Reason */
            reason: string;
            /** Sequence Number */
            sequence_number: number;
        };
        /**
         * OfferAction
         * @description Allowed buyer actions on a merchant offer.
         * @enum {string}
         */
        OfferAction: "ACCEPT" | "DENY";
        /**
         * OfferResponseRequest
         * @description Buyer offer acceptance or rejection payload.
         */
        OfferResponseRequest: {
            action: components["schemas"]["OfferAction"];
            /** Customer Email */
            customer_email: string;
        };
        /**
         * OrderDetailResponse
         * @description Order status and tracking view for buyers.
         */
        OrderDetailResponse: {
            amount: components["schemas"]["Money-Output"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Customer Email */
            customer_email: string;
            /** Items */
            items: components["schemas"]["OrderItemResponse"][];
            /** Order Code */
            order_code: string;
            /** Status */
            status: string;
            /** Tracking Events */
            tracking_events: components["schemas"]["TrackingEventResponse"][];
        };
        /**
         * OrderDisputeStatusResponse
         * @description Dispute availability status for a customer order.
         */
        OrderDisputeStatusResponse: {
            dispute?: components["schemas"]["BuyerDisputeDetailResponse"] | null;
            /** Dispute Eligible */
            dispute_eligible: boolean;
            /** Dispute Exists */
            dispute_exists: boolean;
            /** Ineligibility Reason */
            ineligibility_reason?: string | null;
            /** Order Code */
            order_code: string;
        };
        /**
         * OrderItemRequest
         * @description Item specification in an order creation request.
         *
         *     Price field is intentionally excluded: the server computes prices from the catalog.
         *     Quantity is strictly bounded between 1 and 5.
         */
        OrderItemRequest: {
            /** Quantity */
            quantity: number;
            /** Sku */
            sku: string;
        };
        /**
         * OrderItemResponse
         * @description Line item in an order.
         */
        OrderItemResponse: {
            /** Name */
            name: string;
            /** Quantity */
            quantity: number;
            /** Sku */
            sku: string;
            /** Unit Price */
            unit_price: string;
        };
        /**
         * PayPalEnv
         * @enum {string}
         */
        PayPalEnv: "sandbox" | "stub";
        /** PlanProposedTimelineEvent */
        PlanProposedTimelineEvent: {
            /** Action Type */
            action_type: string;
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default PLAN_PROPOSED
             * @constant
             */
            kind: "PLAN_PROPOSED";
            /** Sequence Number */
            sequence_number: number;
        };
        /**
         * PoolResponse
         * @description Pool availability, globally and per scenario.
         */
        PoolResponse: {
            /** Available */
            available: number;
            /** By Scenario */
            by_scenario?: {
                [key: string]: components["schemas"]["PoolScenario"];
            };
            /** Claimed */
            claimed: number;
            /** Total */
            total: number;
        };
        /** PoolScenario */
        PoolScenario: {
            /** Available */
            available: number;
            /** Claimed */
            claimed: number;
            /** Total */
            total: number;
        };
        /**
         * ProductItem
         * @description Catalog product returned to the client.
         */
        ProductItem: {
            /** Description */
            description: string;
            /** Name */
            name: string;
            price: components["schemas"]["Money-Output"];
            /** Sku */
            sku: string;
        };
        /** ReadinessItem */
        ReadinessItem: {
            /** Checked At */
            checked_at?: string | null;
            /** Detail */
            detail: string;
            /**
             * State
             * @enum {string}
             */
            state: "configured" | "missing" | "unknown" | "verified" | "failed" | "stale";
        };
        /**
         * ResetResponse
         * @description New session issued after hiding the previous session's disputes.
         */
        ResetResponse: {
            /** Hidden Disputes */
            hidden_disputes: number;
            /** Session Id */
            session_id: string;
        };
        /**
         * ResolveResponse
         * @description Outcome of resolving an approval card.
         */
        ResolveResponse: {
            /** Approval Id */
            approval_id: string;
            /** Decision Id */
            decision_id?: string | null;
            /** Dispute Id */
            dispute_id: string;
            /**
             * Executed
             * @default false
             */
            executed: boolean;
            /** Resolution */
            resolution: string;
            /**
             * Status
             * @default resolved
             */
            status: string;
        };
        /** RunFailedTimelineEvent */
        RunFailedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Error */
            error: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default RUN_FAILED
             * @constant
             */
            kind: "RUN_FAILED";
            /** Sequence Number */
            sequence_number: number;
        };
        /** RunStartedTimelineEvent */
        RunStartedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default RUN_STARTED
             * @constant
             */
            kind: "RUN_STARTED";
            /** Run Id */
            run_id: string;
            /** Sequence Number */
            sequence_number: number;
        };
        /**
         * ScenarioCreated
         * @description A scenario dispute created from a pooled transaction.
         */
        ScenarioCreated: {
            /** Dispute Id */
            dispute_id: string;
            /** Reason */
            reason: string;
            /**
             * Scenario Id
             * @enum {string}
             */
            scenario_id: "A" | "B" | "C" | "D" | "E";
            /** Session Id */
            session_id: string;
            /** Transaction Id */
            transaction_id: string;
        };
        /**
         * SendBuyerMessageRequest
         * @description Buyer reply message payload.
         */
        SendBuyerMessageRequest: {
            /** Customer Email */
            customer_email: string;
            /** Message */
            message: string;
        };
        /** SessionView */
        SessionView: {
            /** Authenticated */
            authenticated: boolean;
            /** Configured */
            configured: boolean;
            /** Csrf Token */
            csrf_token?: string | null;
            /** Email */
            email?: string | null;
            /** Expires At */
            expires_at?: string | null;
            /** Required */
            required: boolean;
        };
        /**
         * ShipmentResponse
         * @description Tracking and delivery milestone event.
         */
        ShipmentResponse: {
            /** Carrier */
            carrier: string;
            /**
             * Event Time
             * Format: date-time
             */
            event_time: string;
            /** Payload */
            payload?: {
                [key: string]: unknown;
            } | null;
            /** Status */
            status: string;
            /** Tracking Number */
            tracking_number: string;
        };
        /**
         * StoreMessageResponse
         * @description Buyer dispute message.
         */
        StoreMessageResponse: {
            /** Content */
            content: string;
            /** Posted By */
            posted_by: string;
            /**
             * Time Posted
             * Format: date-time
             */
            time_posted: string;
        };
        /**
         * StoreOrderResponse
         * @description Store customer order details.
         */
        StoreOrderResponse: {
            /** Amount */
            amount: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Currency */
            currency: string;
            /** Customer Email */
            customer_email: string;
            /** Items */
            items: unknown[];
            /** Order Code */
            order_code: string;
            /** Status */
            status: string;
        };
        /**
         * StorePoliciesResponse
         * @description Static merchant store policies.
         */
        StorePoliciesResponse: {
            /**
             * Cancellation Policy
             * @default Orders may be cancelled before shipment tracking is generated.
             */
            cancellation_policy: string;
            /**
             * Refund Window Days
             * @default 30
             */
            refund_window_days: number;
            /**
             * Return Policy
             * @default Items must be returned in original condition within 30 days of delivery.
             */
            return_policy: string;
            /**
             * Return Window Days
             * @default 30
             */
            return_window_days: number;
            /**
             * Shipping Policy
             * @default Orders are shipped within 1-2 business days via standard tracked carriers.
             */
            shipping_policy: string;
        };
        /**
         * StudioRequest
         * @description Wire body posted by studioLlmAdapter.ts.
         *
         *     Fields map 1-to-1 to AgLlmRequest: input, instructions, tools, responseFormat.
         *     We pass instructions through to the provider after prepending our own system
         *     prompt. The responseFormat and tool schemas are validated but not forwarded to
         *     the underlying provider (which only understands a flat message list).
         */
        StudioRequest: {
            /** Context */
            context?: {
                [key: string]: unknown;
            } | null;
            /** Input */
            input?: unknown[];
            /** Instructions */
            instructions?: string | null;
            /** Responseformat */
            responseFormat?: {
                [key: string]: unknown;
            } | null;
            /** Tools */
            tools?: components["schemas"]["StudioTool"][] | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * StudioTool
         * @description Minimal projection of AgAiToolSchema — only name is needed for the allowlist check.
         */
        StudioTool: {
            /** Name */
            name: string;
        } & {
            [key: string]: unknown;
        };
        /**
         * SupportedDisputeReason
         * @description Dispute reasons supported by the Signoff dispute agent.
         * @enum {string}
         */
        SupportedDisputeReason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
        /** TimelineResponse */
        TimelineResponse: {
            /** Items */
            items: (components["schemas"]["WebhookReceivedTimelineEvent"] | components["schemas"]["DisputeSyncedTimelineEvent"] | components["schemas"]["RunStartedTimelineEvent"] | components["schemas"]["EvidenceBuiltTimelineEvent"] | components["schemas"]["PlanProposedTimelineEvent"] | components["schemas"]["GateDecidedTimelineEvent"] | components["schemas"]["ApprovalRequestedTimelineEvent"] | components["schemas"]["ApprovalResolvedTimelineEvent"] | components["schemas"]["ExecutionIntendedTimelineEvent"] | components["schemas"]["ExecutionSentTimelineEvent"] | components["schemas"]["ExecutionConfirmedTimelineEvent"] | components["schemas"]["ExecutionFailedTimelineEvent"] | components["schemas"]["InjectionFlaggedTimelineEvent"] | components["schemas"]["NoActionTimelineEvent"] | components["schemas"]["RunFailedTimelineEvent"] | components["schemas"]["UnknownTimelineEvent"])[];
            /** Next Cursor */
            next_cursor?: string | null;
        };
        /**
         * TrackingEventResponse
         * @description Tracking milestone for an order.
         */
        TrackingEventResponse: {
            /** Carrier */
            carrier: string;
            /**
             * Event Time
             * Format: date-time
             */
            event_time: string;
            /** Status */
            status: string;
            /** Tracking Number */
            tracking_number: string;
        };
        /** UnknownTimelineEvent */
        UnknownTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /** Kind */
            kind: string;
            /** Payload */
            payload?: {
                [key: string]: unknown;
            };
            /** Sequence Number */
            sequence_number: number;
        };
        /**
         * UpdateCharterRequest
         * @description Charter update request requiring the base version for optimistic concurrency.
         */
        UpdateCharterRequest: {
            auto_accept_max: components["schemas"]["MoneyLimit-Input"];
            auto_act_max_dispute_amount: components["schemas"]["MoneyLimit-Input"];
            auto_offer_max: components["schemas"]["MoneyLimit-Input"];
            /**
             * Auto Provide Evidence
             * @default true
             */
            auto_provide_evidence: boolean;
            /**
             * Auto Send Message
             * @default true
             */
            auto_send_message: boolean;
            /**
             * Base Version
             * @description The charter version this update is based on
             */
            base_version: number;
            /** Never Auto Actions */
            never_auto_actions?: components["schemas"]["ActionType"][];
            /** Never Auto Reasons */
            never_auto_reasons?: components["schemas"]["DisputeReason"][];
            /**
             * Repeat Disputer Threshold
             * @default 2
             */
            repeat_disputer_threshold: number;
        };
        /**
         * Verdict
         * @description Gate decision verdict.
         * @enum {string}
         */
        Verdict: "ALLOW" | "NEEDS_APPROVAL" | "DENY";
        /** WebhookReceivedTimelineEvent */
        WebhookReceivedTimelineEvent: {
            /** Created At */
            created_at: string;
            /** Dispute Id */
            dispute_id: string;
            /** Id */
            id: string;
            /**
             * Is Truncated
             * @default false
             */
            is_truncated: boolean;
            /**
             * Kind
             * @default WEBHOOK_RECEIVED
             * @constant
             */
            kind: "WEBHOOK_RECEIVED";
            /** Payload */
            payload?: {
                [key: string]: unknown;
            };
            /** Sequence Number */
            sequence_number: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    get_approval_card_api_approvals__token__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Random approval token from merchant notification */
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApprovalCardResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    post_resolve_approval_api_approvals__token__resolve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Random approval token from merchant notification */
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApproveResolveRequest"] | components["schemas"]["DenyResolveRequest"] | components["schemas"]["EditResolveRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResolveResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    login_api_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionView"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    logout_api_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    session_status_api_auth_session_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionView"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_charter_api_charter_get: {
        parameters: {
            query?: {
                /** @description Specific charter version to retrieve */
                version?: number | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharterResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    put_charter_api_charter_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCharterRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharterResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_charter_history_api_charter_history_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharterResponse"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    claim_dispute_api_demo_claim__dispute_id__post: {
        parameters: {
            query?: never;
            header?: {
                "X-Demo-Token"?: string | null;
            };
            path: {
                dispute_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimDisputeResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_pool_api_demo_pool_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PoolResponse"] | components["schemas"]["DemoPoolDisputeItem"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    reset_api_demo_reset_post: {
        parameters: {
            query?: never;
            header?: {
                "X-Demo-Session"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    create_scenario_api_demo_scenarios__scenario_id__post: {
        parameters: {
            query?: never;
            header?: {
                "X-Demo-Session"?: string | null;
                "Idempotency-Key"?: string | null;
            };
            path: {
                scenario_id: "A" | "B" | "C" | "D" | "E";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioCreated"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_disputes_api_disputes_get: {
        parameters: {
            query?: {
                /** @description Filter by status */
                status?: components["schemas"]["DisputeStatus"] | null;
                /** @description Filter by reason */
                reason?: components["schemas"]["DisputeReason"] | null;
                /** @description Filter disputes due before this timestamp */
                "due-before"?: string | null;
                /** @description Page size limit */
                limit?: number;
                /** @description Pagination cursor */
                cursor?: string | null;
                /** @description Field to sort by */
                sort_by?: string;
                /** @description Sort direction (asc or desc) */
                sort_direction?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputesResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_dispute_by_id_api_disputes__id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputeDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_dispute_decisions_api_disputes__id__decisions_get: {
        parameters: {
            query?: {
                /** @description Page limit */
                limit?: number;
                /** @description Cursor opaque string */
                cursor?: string | null;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DecisionsResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_dispute_timeline_api_disputes__id__timeline_get: {
        parameters: {
            query?: {
                /** @description Page limit */
                limit?: number;
                /** @description Opaque pagination cursor */
                cursor?: string | null;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimelineResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    check_connections_api_integrations_check_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationStatus"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_status_api_integrations_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationStatus"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_kpis_api_kpis_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KpiResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    ask_assistant_api_llm_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssistantRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    ask_studio_assistant_api_llm_studio_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_catalog_api_shop_catalog_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductItem"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_product_detail_api_shop_catalog__sku__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sku: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductItem"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    create_order_api_shop_orders_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOrderRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrderResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_order_by_code_api_shop_orders__order_code__get: {
        parameters: {
            query: {
                /** @description Customer email for verification */
                email: string;
            };
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    capture_order_api_shop_orders__order_code__capture_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["CaptureOrderRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaptureOrderResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_order_dispute_status_api_shop_orders__order_code__dispute_get: {
        parameters: {
            query: {
                /** @description Customer email for verification */
                email: string;
            };
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderDisputeStatusResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    create_buyer_dispute_api_shop_orders__order_code__dispute_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateDisputeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuyerDisputeDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    send_buyer_dispute_message_api_shop_orders__order_code__dispute_messages_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendBuyerMessageRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuyerDisputeDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    respond_to_merchant_offer_api_shop_orders__order_code__dispute_offer_response_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OfferResponseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuyerDisputeDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    reconcile_api_shop_orders__order_code__reconcile_post: {
        parameters: {
            query: {
                /** @description Customer email for verification */
                email: string;
            };
            header?: never;
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderDetailResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    api_status_api_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_order_by_transaction_api_store_orders_by_transaction__transaction_id__get: {
        parameters: {
            query?: never;
            header?: {
                "X-Store-Key"?: string | null;
            };
            path: {
                transaction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StoreOrderResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_order_messages_api_store_orders__order_code__messages_get: {
        parameters: {
            query?: never;
            header?: {
                "X-Store-Key"?: string | null;
            };
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StoreMessageResponse"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_order_shipments_api_store_orders__order_code__shipments_get: {
        parameters: {
            query?: never;
            header?: {
                "X-Store-Key"?: string | null;
            };
            path: {
                order_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShipmentResponse"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_policies_api_store_policies_get: {
        parameters: {
            query?: never;
            header?: {
                "X-Store-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorePoliciesResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    healthz_healthz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    readyz_readyz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    paypal_webhook_receiver_webhooks_paypal_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request not permitted */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict or Stale Data */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Rate Limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable or Frozen */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
}
