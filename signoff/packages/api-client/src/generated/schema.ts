export interface paths {
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
        /**
         * DisputeReason
         * @description PayPal dispute reason categories.
         * @enum {string}
         */
        DisputeReason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" | "UNAUTHORISED" | "CREDIT_NOT_PROCESSED" | "DUPLICATE_TRANSACTION" | "INCORRECT_AMOUNT" | "PAYMENT_BY_OTHER_MEANS" | "CANCELED_RECURRING_BILLING" | "PROBLEM_WITH_REMITTANCE" | "OTHER";
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
        /** TimelineResponse */
        TimelineResponse: {
            /** Items */
            items: (components["schemas"]["WebhookReceivedTimelineEvent"] | components["schemas"]["DisputeSyncedTimelineEvent"] | components["schemas"]["RunStartedTimelineEvent"] | components["schemas"]["EvidenceBuiltTimelineEvent"] | components["schemas"]["PlanProposedTimelineEvent"] | components["schemas"]["GateDecidedTimelineEvent"] | components["schemas"]["ApprovalRequestedTimelineEvent"] | components["schemas"]["ApprovalResolvedTimelineEvent"] | components["schemas"]["ExecutionIntendedTimelineEvent"] | components["schemas"]["ExecutionSentTimelineEvent"] | components["schemas"]["ExecutionConfirmedTimelineEvent"] | components["schemas"]["ExecutionFailedTimelineEvent"] | components["schemas"]["InjectionFlaggedTimelineEvent"] | components["schemas"]["NoActionTimelineEvent"] | components["schemas"]["RunFailedTimelineEvent"] | components["schemas"]["UnknownTimelineEvent"])[];
            /** Next Cursor */
            next_cursor?: string | null;
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
