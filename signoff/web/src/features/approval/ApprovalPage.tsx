import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Button,
  Card,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  VerdictChip,
} from '@signoff/ui';
import type { ApiQueryError } from '../../app/queries';
import { resolveApprovalCall, useApprovalCard } from '../../app/queries';
import { parseAmountInput } from './amountParser';
import type { ApprovalOutcome, EditRequestPayload } from './types';
import { buildEditResolveRequest } from './types';

export const ApprovalPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();

  // Ensure no-referrer policy is active on the page
  useEffect(() => {
    let meta = document.querySelector('meta[name="referrer"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'referrer');
      meta.setAttribute('content', 'no-referrer');
      document.head.appendChild(meta);
    }
  }, []);

  const cardQuery = useApprovalCard(token);

  // Resolution state
  const [outcome, setOutcome] = useState<ApprovalOutcome | null>(null);
  const [outcomeMessage, setOutcomeMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Mode: 'view' | 'deny' | 'edit' | 'confirm_edit'
  const [actionStep, setActionStep] = useState<'view' | 'deny' | 'edit' | 'confirm_edit'>('view');

  // Form states
  const [denyReason, setDenyReason] = useState<string>('');
  const [editAmountRaw, setEditAmountRaw] = useState<string>('');
  const [editMessage, setEditMessage] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [stagedEditPayload, setStagedEditPayload] = useState<EditRequestPayload | null>(null);

  const card = cardQuery.data;

  // Check if token was already resolved in this session (e.g. on back navigation)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`resolved_approval_${token}`);
      if (stored && !outcome) {
        setOutcome('ALREADY_RESOLVED');
        setOutcomeMessage(`This approval request was already ${stored.toLowerCase()} in this session.`);
      }
    } catch {
      // ignore
    }
  }, [token, outcome]);

  // Determine initial outcome from card resolution and expiry
  useEffect(() => {
    if (card && !outcome) {
      if (card.resolution === 'APPROVE') {
        setOutcome('ALREADY_RESOLVED');
        setOutcomeMessage('This approval request has already been approved.');
      } else if (card.resolution === 'DENY') {
        setOutcome('ALREADY_RESOLVED');
        setOutcomeMessage('This approval request has already been denied.');
      } else if (card.resolution === 'EDIT') {
        setOutcome('ALREADY_RESOLVED');
        setOutcomeMessage('This approval request has already been resolved with edits.');
      } else if (card.resolution === 'EXPIRED' || new Date(card.expires_at).getTime() <= Date.now()) {
        setOutcome('EXPIRED');
        setOutcomeMessage('This approval link has expired.');
      }
    }
  }, [card, outcome]);

  // Handle Approve with double-tap protection
  const handleApprove = async () => {
    if (isSubmittingRef.current || isSubmitting || outcome) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await resolveApprovalCall(token, { action: 'APPROVE' });
      setOutcome('APPROVED');
      setOutcomeMessage('Action approved and scheduled for execution.');
      try {
        sessionStorage.setItem(`resolved_approval_${token}`, 'APPROVED');
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      handleResolveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deny with double-tap protection
  const handleDenySubmit = async () => {
    if (isSubmittingRef.current || isSubmitting || outcome) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await resolveApprovalCall(token, {
        action: 'DENY',
        ...(denyReason.trim() ? { reason: denyReason.trim() } : {}),
      });
      setOutcome('DENIED');
      setOutcomeMessage('Proposed action was denied. No changes were made.');
      try {
        sessionStorage.setItem(`resolved_approval_${token}`, 'DENIED');
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      handleResolveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit preparation and validation
  const handlePrepareEdit = () => {
    setEditError(null);
    let parsedMoney;

    if (editAmountRaw.trim()) {
      const parsed = parseAmountInput(editAmountRaw);
      if (!parsed.ok) {
        setEditError(parsed.error);
        return;
      }
      parsedMoney = parsed.money;
    }

    if (!parsedMoney && !editMessage.trim()) {
      setEditError('Please provide an edited amount or message.');
      return;
    }

    const payload: EditRequestPayload = parsedMoney
      ? (editMessage.trim()
          ? { amount: parsedMoney, message: editMessage.trim() }
          : { amount: parsedMoney })
      : { message: editMessage.trim() };

    // Money-moving actions or editing amount require confirmation step
    const isMoneyMoving =
      parsedMoney !== undefined ||
      card?.action_type === 'MAKE_OFFER' ||
      card?.action_type === 'ACCEPT_CLAIM';

    if (isMoneyMoving) {
      setStagedEditPayload(payload);
      setActionStep('confirm_edit');
    } else {
      void executeEdit(payload);
    }
  };

  const executeEdit = async (payload: EditRequestPayload) => {
    if (isSubmittingRef.current || isSubmitting || outcome) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const body = buildEditResolveRequest(payload);
      await resolveApprovalCall(token, body);
      setOutcome('APPROVED');
      setOutcomeMessage('Edited action approved and submitted for execution.');
      try {
        sessionStorage.setItem(`resolved_approval_${token}`, 'APPROVED');
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      handleResolveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveError = (err: unknown) => {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('stale') || msg.includes('conflict')) {
        setOutcome('STALE');
        setOutcomeMessage('The dispute state changed since this approval was generated.');
        return;
      }
      if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection')) {
        setOutcome('OUTCOME_UNKNOWN');
        setOutcomeMessage('Network error occurred during submit. Checking outcome status...');
        return;
      }
    }
    setOutcome('OUTCOME_UNKNOWN');
    setOutcomeMessage('An unexpected error occurred. Outcome is unknown.');
  };

  // Render Loading
  if (cardQuery.isPending) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <Card testId="approval-loading-card">
          <div role="status" aria-label="Loading approval details" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="28px" width="60%" />
            <Skeleton height="80px" />
            <Skeleton height="40px" />
          </div>
        </Card>
      </div>
    );
  }

  // Render Invalid Link / 404
  if (cardQuery.isError) {
    const error = cardQuery.error as ApiQueryError;
    const isInvalid =
      error.message?.toLowerCase().includes('invalid') ||
      error.message?.toLowerCase().includes('not found') ||
      error.correlationId === 'mock-invalid-token';

    if (isInvalid) {
      return (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
          <EmptyState
            testId="outcome-invalid-link"
            title="Invalid approval link"
            description="This approval link does not exist or has already expired. Tokens are single-use."
            action={
              <Link
                to="/"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                Go to Signoff Home
              </Link>
            }
          />
        </div>
      );
    }

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <ErrorState
          testId="approval-error-state"
          message={error.message}
          correlationId={error.correlationId}
          onRetry={() => void cardQuery.refetch()}
        />
      </div>
    );
  }

  // Render Resolved / Distinct Outcome Screens
  if (outcome) {
    const outcomeTitles: Record<ApprovalOutcome, string> = {
      APPROVED: 'Approval confirmed',
      DENIED: 'Action denied',
      EXPIRED: 'Approval expired',
      STALE: 'Dispute state conflict',
      ALREADY_RESOLVED: 'Already resolved',
      INVALID_LINK: 'Invalid approval link',
      OUTCOME_UNKNOWN: 'Outcome unknown',
      PENDING: 'Pending',
    };

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <Card testId={`outcome-${outcome.toLowerCase().replace(/_/g, '-')}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '12px 0' }}>
            <h2 style={{ fontSize: '20px', margin: 0, color: outcome === 'APPROVED' ? '#166534' : outcome === 'DENIED' ? '#991b1b' : '#0f172a' }}>
              {outcomeTitles[outcome]}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
              {outcomeMessage}
            </p>

            {outcome === 'OUTCOME_UNKNOWN' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
                <Button
                  variant="primary"
                  testId="refetch-status-button"
                  onClick={async () => {
                    const res = await cardQuery.refetch();
                    if (res.data?.resolution && res.data.resolution !== 'PENDING') {
                      setOutcome('ALREADY_RESOLVED');
                      setOutcomeMessage(`Verified: Action was recorded as ${res.data.resolution}.`);
                    } else {
                      setOutcomeMessage('Could not verify status. Please check your merchant dashboard.');
                    }
                  }}
                >
                  Verify status
                </Button>
              </div>
            )}

            <div style={{ marginTop: '12px' }}>
              <Link
                to="/"
                style={{
                  color: '#0284c7',
                  fontSize: '14px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Return to dashboard
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div
      style={{
        maxWidth: '480px',
        minWidth: '320px',
        margin: '0 auto',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <header>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#d97706',
            backgroundColor: '#fef3c7',
            padding: '2px 8px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Approval required
        </span>
        <h1
          data-testid="approval-title"
          style={{ fontSize: '20px', margin: '8px 0 4px 0', color: '#0f172a' }}
        >
          Review proposed action
        </h1>
        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Time remaining:</span>
          <Deadline dueAt={card.expires_at} />
        </div>
      </header>

      {/* Gate reason and rule */}
      <Card testId="approval-gate-reason-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <VerdictChip verdict={card.verdict} testId="approval-verdict-chip" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Rule {card.rule_id}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
            {card.reason}
          </p>
        </div>
      </Card>

      {/* Proposed Action */}
      <Card title="Proposed action" testId="approval-action-card">
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 12px', fontSize: '14px' }}>
          <dt style={{ color: '#64748b' }}>Action</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }} data-testid="proposed-action-type">
            {card.action_type.replace(/_/g, ' ')}
          </dd>
          {Boolean(
            card.action_payload &&
              typeof card.action_payload === 'object' &&
              'amount' in card.action_payload &&
              card.action_payload.amount
          ) ? (
            <>
              <dt style={{ color: '#64748b' }}>Proposed amount</dt>
              <dd style={{ margin: 0 }} data-testid="proposed-amount">
                <Money money={card.action_payload.amount as Parameters<typeof Money>[0]['money']} />
              </dd>
            </>
          ) : null}
          {Boolean(
            card.action_payload &&
              typeof card.action_payload === 'object' &&
              'message' in card.action_payload &&
              card.action_payload.message
          ) ? (
            <>
              <dt style={{ color: '#64748b' }}>Message</dt>
              <dd style={{ margin: 0, color: '#334155' }} data-testid="proposed-message">
                {String(card.action_payload.message)}
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      {/* Dispute Summary */}
      <Card title="Dispute details" testId="approval-dispute-card">
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 12px', fontSize: '14px' }}>
          <dt style={{ color: '#64748b' }}>Dispute ID</dt>
          <dd style={{ margin: 0, fontWeight: 500 }} data-testid="approval-dispute-id">
            {card.dispute.id}
          </dd>
          <dt style={{ color: '#64748b' }}>Dispute amount</dt>
          <dd style={{ margin: 0 }}>
            <Money money={card.dispute.amount} testId="approval-dispute-amount" />
          </dd>
          <dt style={{ color: '#64748b' }}>Reason</dt>
          <dd style={{ margin: 0, color: '#334155' }}>
            {card.dispute.reason.replace(/_/g, ' ')}
          </dd>
          {card.dispute.buyer_message && (
            <>
              <dt style={{ color: '#64748b' }}>Buyer message</dt>
              <dd style={{ margin: 0, color: '#1e293b', fontStyle: 'italic' }} data-testid="approval-buyer-message">
                &ldquo;{card.dispute.buyer_message}&rdquo;
              </dd>
            </>
          )}
        </dl>
      </Card>

      {/* Evidence Panel */}
      <Card title="Evidence" testId="approval-evidence-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>Fulfillment dossier:</span>
            <span
              data-testid="approval-evidence-badge"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Verified
            </span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.4 }}>
            Order tracking events, shipment verification, and merchant transaction history are attached to this dispute dossier.
          </p>
        </div>
      </Card>

      {/* Action Decision Form */}
      {actionStep === 'view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            variant="primary"
            testId="approval-approve-button"
            disabled={isSubmitting}
            onClick={handleApprove}
            style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
          >
            {isSubmitting ? 'Approving...' : 'Approve action'}
          </Button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Button
              variant="secondary"
              testId="approval-edit-button"
              disabled={isSubmitting}
              onClick={() => {
                if (card.action_payload?.amount && typeof card.action_payload.amount === 'object' && 'value' in card.action_payload.amount) {
                  setEditAmountRaw(String(card.action_payload.amount.value));
                }
                if (card.action_payload?.message) {
                  setEditMessage(String(card.action_payload.message));
                }
                setActionStep('edit');
              }}
              style={{ minHeight: '44px' }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              testId="approval-deny-button"
              disabled={isSubmitting}
              onClick={() => setActionStep('deny')}
              style={{ minHeight: '44px' }}
            >
              Deny
            </Button>
          </div>
        </div>
      )}

      {/* Deny step */}
      {actionStep === 'deny' && (
        <Card title="Confirm denial" testId="approval-deny-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleDenySubmit();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
              Are you sure you want to deny this proposed action? The agent will take no further action on this dispute.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="deny-reason" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Denial reason (optional)
              </label>
              <textarea
                id="deny-reason"
                data-testid="deny-reason-input"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Reason for audit record"
                rows={3}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <Button
                variant="danger"
                testId="confirm-deny-button"
                disabled={isSubmitting}
                type="submit"
                style={{ flex: 1, minHeight: '44px' }}
              >
                {isSubmitting ? 'Denying...' : 'Confirm denial'}
              </Button>
              <Button
                variant="secondary"
                testId="cancel-deny-button"
                disabled={isSubmitting}
                type="button"
                onClick={() => setActionStep('view')}
                style={{ minHeight: '44px' }}
              >
                Back
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Edit step */}
      {actionStep === 'edit' && (
        <Card title="Edit proposed action" testId="approval-edit-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePrepareEdit();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-amount" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Offer amount ($ USD)
              </label>
              <input
                id="edit-amount"
                data-testid="edit-amount-input"
                type="text"
                inputMode="decimal"
                value={editAmountRaw}
                onChange={(e) => setEditAmountRaw(e.target.value)}
                placeholder="e.g. 25.00"
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-message" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Message to buyer (optional)
              </label>
              <textarea
                id="edit-message"
                data-testid="edit-message-input"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                placeholder="Optional explanation to the buyer"
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {editError && (
              <div
                data-testid="edit-error-banner"
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <Button
                variant="primary"
                testId="submit-edit-button"
                type="submit"
                style={{ flex: 1, minHeight: '44px' }}
              >
                Continue
              </Button>
              <Button
                variant="secondary"
                testId="cancel-edit-button"
                type="button"
                onClick={() => setActionStep('view')}
                style={{ minHeight: '44px' }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Confirmation step for money-moving action */}
      {actionStep === 'confirm_edit' && stagedEditPayload && (
        <Card title="Confirm money-moving action" testId="approval-confirm-edit-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
              Please confirm the following change to this dispute:
            </p>

            <dl
              style={{
                margin: 0,
                backgroundColor: '#f8fafc',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                gap: '8px 12px',
                fontSize: '14px',
              }}
            >
              {stagedEditPayload.amount && (
                <>
                  <dt style={{ color: '#64748b' }}>New offer amount</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }} data-testid="confirmed-amount">
                    ${stagedEditPayload.amount.value} {stagedEditPayload.amount.currency_code}
                  </dd>
                </>
              )}
              {stagedEditPayload.message && (
                <>
                  <dt style={{ color: '#64748b' }}>Message</dt>
                  <dd style={{ margin: 0, color: '#334155' }}>
                    {stagedEditPayload.message}
                  </dd>
                </>
              )}
            </dl>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <Button
                variant="primary"
                testId="confirm-and-submit-edit-button"
                disabled={isSubmitting}
                onClick={() => void executeEdit(stagedEditPayload)}
                style={{ flex: 1, minHeight: '44px' }}
              >
                {isSubmitting ? 'Submitting...' : 'Yes, submit offer'}
              </Button>
              <Button
                variant="secondary"
                testId="back-to-edit-button"
                disabled={isSubmitting}
                onClick={() => setActionStep('edit')}
                style={{ minHeight: '44px' }}
              >
                Back
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
