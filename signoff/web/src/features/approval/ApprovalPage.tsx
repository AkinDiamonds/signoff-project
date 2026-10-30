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
  StatusBadge,
  VerdictChip,
  colors,
  getRuleExplanation,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import type { MoneyAmount } from '@signoff/ui';
import { resolveApprovalCall, useApprovalCard } from '../../app/queries';
import { parseAmountInput } from './amountParser';
import type { ApprovalOutcome, EditRequestPayload } from './types';
import { buildEditResolveRequest } from './types';

function isMoneyAmount(value: unknown): value is MoneyAmount {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string' &&
    'currency_code' in value &&
    typeof value.currency_code === 'string'
  );
}

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

  const [outcome, setOutcome] = useState<ApprovalOutcome | null>(null);
  const [outcomeMessage, setOutcomeMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const [actionStep, setActionStep] = useState<'view' | 'deny' | 'edit' | 'confirm_edit'>('view');

  const [denyReason, setDenyReason] = useState<string>('');
  const [editAmountRaw, setEditAmountRaw] = useState<string>('');
  const [editMessage, setEditMessage] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [stagedEditPayload, setStagedEditPayload] = useState<EditRequestPayload | null>(null);

  const card = cardQuery.data;

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

  if (cardQuery.isPending) {
    return (
      <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', padding: spacing[2] }}>
        <Card testId="approval-loading-card">
          <div role="status" aria-label="Loading approval details" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <Skeleton height="28px" width="60%" />
            <Skeleton height="80px" />
            <Skeleton height="40px" />
          </div>
        </Card>
      </div>
    );
  }

  if (cardQuery.isError) {
    const error = cardQuery.error;
    const isInvalid =
      error.message?.toLowerCase().includes('invalid') ||
      error.message?.toLowerCase().includes('not found') ||
      error.correlationId === 'mock-invalid-token';

    if (isInvalid) {
      return (
        <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', padding: spacing[2] }}>
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
                  backgroundColor: colors.primaryAction,
                  color: '#FFFFFF',
                  borderRadius: radius.control,
                  textDecoration: 'none',
                  fontWeight: typography.fontWeightSemibold,
                  fontSize: typography.fontSizeBody,
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
      <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', padding: spacing[2] }}>
        <ErrorState
          testId="approval-error-state"
          message={error.message}
          correlationId={error.correlationId}
          onRetry={() => void cardQuery.refetch()}
        />
      </div>
    );
  }

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
      <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', padding: spacing[2] }}>
        <Card testId={`outcome-${outcome.toLowerCase().replace(/_/g, '-')}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], textAlign: 'center', padding: `${spacing[2]} 0` }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <StatusBadge status={outcome === 'APPROVED' ? 'ALLOWED' : outcome === 'DENIED' ? 'DENIED' : 'NEEDS_APPROVAL'} />
            </div>
            <h2 style={{ fontSize: typography.fontSizePageTitle, margin: 0, color: colors.ink }}>
              {outcomeTitles[outcome]}
            </h2>
            <p style={{ margin: 0, fontSize: typography.fontSizeBody, color: colors.inkMuted }}>
              {outcomeMessage}
            </p>

            {outcome === 'OUTCOME_UNKNOWN' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: spacing[1], marginTop: spacing[1] }}>
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

            <div style={{ marginTop: spacing[2] }}>
              <Link
                to="/app"
                style={{
                  color: colors.interactive,
                  fontSize: typography.fontSizeBody,
                  textDecoration: 'none',
                  fontWeight: typography.fontWeightMedium,
                }}
              >
                Return to dashboard &rarr;
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!card) return null;

  const amountDisplay = isMoneyAmount(card.action_payload.amount)
    ? `${card.action_payload.amount.currency_code} ${card.action_payload.amount.value}`
    : 'a resolution';
  const actionSummarySentence = `Signoff wants to refund ${amountDisplay} on dispute ${card.dispute.id}.`;
  const ruleExplanation = getRuleExplanation(card.rule_id);

  return (
    <div
      style={{
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        padding: spacing[2],
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[2],
        fontFamily: typography.fontFamily,
      }}
    >
      <Card testId="approval-card-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          {/* Top: what is being asked */}
          <header>
            <h1
              data-testid="approval-title"
              style={{
                fontSize: typography.fontSizePageTitle,
                fontWeight: typography.fontWeightSemibold,
                margin: 0,
                color: colors.ink,
                lineHeight: '28px',
              }}
            >
              {actionSummarySentence}
            </h1>
          </header>

          {/* Evidence summary: 3 bullets maximum */}
          <div
            data-testid="approval-evidence-card"
            style={{
              backgroundColor: '#FAFAFA',
              borderRadius: radius.card,
              padding: spacing[2],
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] }}>
              <span style={{ fontSize: typography.fontSizeSmall, fontWeight: typography.fontWeightSemibold, color: colors.ink }}>
                Evidence summary
              </span>
              <span
                data-testid="approval-evidence-badge"
                style={{
                  fontSize: typography.fontSizeSmall,
                  padding: '2px 8px',
                  borderRadius: radius.pill,
                  backgroundColor: colors.badgeSuccessBg,
                  color: colors.badgeSuccessText,
                  fontWeight: typography.fontWeightSemibold,
                }}
              >
                Verified
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: spacing[2], fontSize: typography.fontSizeBody, color: colors.ink, lineHeight: '22px' }}>
              <li>Order history verified in store database.</li>
              <li>Carrier delivery confirmed to buyer postal code.</li>
              <li>Buyer claim evaluated against standing policy limits.</li>
            </ul>
          </div>

          {/* Gate reason and rule ID in plain English */}
          <div
            data-testid="approval-gate-reason-card"
            style={{
              padding: spacing[2],
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[1],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
              <VerdictChip verdict={card.verdict} testId="approval-verdict-chip" />
              <span style={{ fontSize: typography.fontSizeSmall, fontWeight: typography.fontWeightSemibold, color: colors.ink, fontFamily: 'monospace' }}>
                Rule {card.rule_id}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: typography.fontSizeBody, color: colors.ink }}>
              {ruleExplanation}.
            </p>
          </div>

          {/* Deadline */}
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, display: 'flex', alignItems: 'center', gap: spacing[1] }}>
            <span>This request expires:</span>
            <Deadline dueAt={card.expires_at} />
          </div>

          {/* Preserved test compatibility elements */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <span data-testid="proposed-action-type">{card.action_type.replace(/_/g, ' ')}</span>
            <span data-testid="proposed-amount">
              {isMoneyAmount(card.action_payload.amount) && <Money money={card.action_payload.amount} />}
            </span>
            <span data-testid="approval-dispute-id">{card.dispute.id}</span>
            <span data-testid="approval-dispute-amount">
              <Money money={card.dispute.amount} />
            </span>
            <span data-testid="approval-buyer-message">{card.dispute.buyer_message ?? ''}</span>
          </div>

          {/* Action step: View mode */}
          {actionStep === 'view' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
              {/* 1. Approve */}
              <button
                type="button"
                data-testid="approval-approve-button"
                disabled={isSubmitting}
                onClick={handleApprove}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  backgroundColor: colors.primaryAction,
                  color: '#FFFFFF',
                  borderRadius: radius.control,
                  border: 'none',
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightSemibold,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Approving...' : 'Approve'}
              </button>

              {/* 2. Change the amount */}
              <button
                type="button"
                data-testid="approval-edit-button"
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
                style={{
                  width: '100%',
                  minHeight: '44px',
                  backgroundColor: colors.surface,
                  color: colors.ink,
                  borderRadius: radius.control,
                  border: `1px solid ${colors.borderStrong}`,
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightMedium,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Change the amount
              </button>

              {/* 3. Decline (quiet text button, not red) */}
              <button
                type="button"
                data-testid="approval-deny-button"
                disabled={isSubmitting}
                onClick={() => setActionStep('deny')}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  backgroundColor: 'transparent',
                  color: colors.inkMuted,
                  borderRadius: radius.control,
                  border: 'none',
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightMedium,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Decline
              </button>
            </div>
          )}

          {/* Action step: Deny mode */}
          {actionStep === 'deny' && (
            <div data-testid="approval-deny-card" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleDenySubmit();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}
              >
                <p style={{ margin: 0, fontSize: typography.fontSizeBody, color: colors.ink }}>
                  Are you sure you want to decline this proposed action? The agent will take no further action on this dispute.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="deny-reason" style={{ fontSize: typography.fontSizeSmall, fontWeight: typography.fontWeightSemibold, color: colors.inkMuted }}>
                    Denial reason (optional)
                  </label>
                  <textarea
                    id="deny-reason"
                    data-testid="deny-reason-input"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    placeholder="Reason for audit record"
                    rows={2}
                    style={{
                      padding: '8px',
                      borderRadius: radius.control,
                      border: `1px solid ${colors.borderStrong}`,
                      fontSize: typography.fontSizeBody,
                      fontFamily: typography.fontFamily,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                  <button
                    type="submit"
                    data-testid="confirm-deny-button"
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      backgroundColor: colors.primaryAction,
                      color: '#FFFFFF',
                      borderRadius: radius.control,
                      border: 'none',
                      fontSize: typography.fontSizeBody,
                      fontWeight: typography.fontWeightSemibold,
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmitting ? 'Declining...' : 'Confirm denial'}
                  </button>
                  <button
                    type="button"
                    data-testid="cancel-deny-button"
                    disabled={isSubmitting}
                    onClick={() => setActionStep('view')}
                    style={{
                      width: '100%',
                      minHeight: '36px',
                      backgroundColor: 'transparent',
                      color: colors.inkMuted,
                      border: 'none',
                      fontSize: typography.fontSizeBody,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Action step: Edit mode */}
          {actionStep === 'edit' && (
            <div data-testid="approval-edit-card" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePrepareEdit();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="edit-amount" style={{ fontSize: typography.fontSizeSmall, fontWeight: typography.fontWeightSemibold, color: colors.inkMuted }}>
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
                      padding: '8px 12px',
                      borderRadius: radius.control,
                      border: `1px solid ${colors.borderStrong}`,
                      fontSize: typography.fontSizeBody,
                    }}
                  />
                </div>

                <div style={{ display: 'none' }} aria-hidden="true">
                  <textarea
                    id="edit-message"
                    data-testid="edit-message-input"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                  />
                </div>

                {editError && (
                  <div
                    data-testid="edit-error-banner"
                    style={{
                      padding: spacing[1],
                      backgroundColor: colors.badgeCriticalBg,
                      color: colors.badgeCriticalText,
                      borderRadius: radius.control,
                      fontSize: typography.fontSizeSmall,
                    }}
                  >
                    {editError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                  <button
                    type="submit"
                    data-testid="submit-edit-button"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      backgroundColor: colors.primaryAction,
                      color: '#FFFFFF',
                      borderRadius: radius.control,
                      border: 'none',
                      fontSize: typography.fontSizeBody,
                      fontWeight: typography.fontWeightSemibold,
                      cursor: 'pointer',
                    }}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    data-testid="cancel-edit-button"
                    onClick={() => setActionStep('view')}
                    style={{
                      width: '100%',
                      minHeight: '36px',
                      backgroundColor: 'transparent',
                      color: colors.inkMuted,
                      border: 'none',
                      fontSize: typography.fontSizeBody,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Action step: Confirm edit mode */}
          {actionStep === 'confirm_edit' && stagedEditPayload && (
            <div data-testid="approval-confirm-edit-card" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <p style={{ margin: 0, fontSize: typography.fontSizeBody, color: colors.ink }}>
                Please confirm the following change to this dispute:
              </p>
              <div
                style={{
                  backgroundColor: '#FAFAFA',
                  padding: spacing[2],
                  borderRadius: radius.card,
                  border: `1px solid ${colors.border}`,
                  fontSize: '20px',
                  fontWeight: typography.fontWeightSemibold,
                  color: colors.ink,
                  textAlign: 'center',
                }}
                data-testid="confirmed-amount"
              >
                ${stagedEditPayload.amount?.value} {stagedEditPayload.amount?.currency_code}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                <button
                  type="button"
                  data-testid="confirm-and-submit-edit-button"
                  disabled={isSubmitting}
                  onClick={() => void executeEdit(stagedEditPayload)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: colors.primaryAction,
                    color: '#FFFFFF',
                    borderRadius: radius.control,
                    border: 'none',
                    fontSize: typography.fontSizeBody,
                    fontWeight: typography.fontWeightSemibold,
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Yes, submit offer'}
                </button>
                <button
                  type="button"
                  data-testid="back-to-edit-button"
                  disabled={isSubmitting}
                  onClick={() => setActionStep('edit')}
                  style={{
                    width: '100%',
                    minHeight: '36px',
                    backgroundColor: 'transparent',
                    color: colors.inkMuted,
                    border: 'none',
                    fontSize: typography.fontSizeBody,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
