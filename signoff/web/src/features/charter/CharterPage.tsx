import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import type { ActionType, DisputeReason } from '@signoff/api-client';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  colors,
  radius,
  spacing,
  typography,
  toast,
} from '@signoff/ui';
import { ApiQueryError } from '../../app/queries';
import { fetchLatestCharter, useCharter, useCharterHistory, useUpdateCharter } from './api';
import {
  ACTION_TYPES,
  DISPUTE_REASONS,
  buildCharterUpdate,
  toFormValues,
  toggleList,
  type Charter,
  type CharterFieldErrors,
  type CharterFormValues,
} from './types';

interface SettingRowProps {
  id: string;
  label: string;
  legacyAriaLabel: string;
  helper: string;
  value: string;
  currency?: string;
  error?: string;
  onChange: (value: string) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  id,
  label,
  legacyAriaLabel,
  helper,
  value,
  currency = 'USD',
  error,
  onChange,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: spacing[2], borderBottom: `1px solid ${colors.border}` }}>
    <label
      htmlFor={id}
      style={{
        fontSize: typography.fontSizeBody,
        fontWeight: typography.fontWeightSemibold,
        color: colors.ink,
      }}
    >
      {label}
    </label>
    <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
      {helper}
    </div>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginTop: '6px',
        maxWidth: '240px',
        backgroundColor: colors.surface,
        border: `1px solid ${error ? colors.badgeCriticalText : colors.borderStrong}`,
        borderRadius: radius.control,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          padding: '8px 10px',
          backgroundColor: 'var(--signoff-surface, #fff)',
          color: colors.inkMuted,
          fontSize: typography.fontSizeSmall,
          fontWeight: typography.fontWeightMedium,
          borderRight: `1px solid ${colors.border}`,
          userSelect: 'none',
        }}
      >
        {currency}
      </span>
      <input
        id={id}
        data-testid={id}
        aria-label={legacyAriaLabel}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          flex: 1,
          padding: '8px 12px',
          border: 'none',
          outline: 'none',
          fontSize: typography.fontSizeBody,
          fontFamily: typography.fontFamily,
          color: colors.ink,
        }}
      />
    </div>
    {error && (
      <span
        id={`${id}-error`}
        role="alert"
        data-testid={`${id}-error`}
        style={{ color: colors.badgeCriticalText, fontSize: typography.fontSizeSmall, marginTop: '2px' }}
      >
        {error}
      </span>
    )}
  </div>
);

const HUMAN_REASON_LABELS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: 'Item Not Received',
  UNAUTHORISED_TRANSACTION: 'Unauthorized Transaction',
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: 'Significantly Not As Described',
  CANCEL_RECURRING_BILLING: 'Canceled Recurring Subscription',
  CREDIT_NOT_PROCESSED: 'Credit Not Processed',
  DUPLICATE_TRANSACTION: 'Duplicate Charge',
  INCORRECT_AMOUNT: 'Incorrect Amount Billed',
  PAYMENT_BY_OTHER_MEANS: 'Paid By Other Payment Method',
};

const CheckboxGroup = <T extends string>({
  legend,
  options,
  selected,
  onChange,
  testId,
}: {
  legend: string;
  options: readonly T[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  testId: string;
}): React.ReactElement => (
  <fieldset
    data-testid={testId}
    style={{
      border: `1px solid ${colors.border}`,
      borderRadius: radius.card,
      padding: spacing[2],
      margin: 0,
      backgroundColor: 'var(--signoff-surface, #fff)',
    }}
  >
    <legend style={{ fontWeight: typography.fontWeightSemibold, fontSize: typography.fontSizeSmall, color: colors.ink, padding: '0 4px' }}>
      {legend}
    </legend>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '8px', marginTop: spacing[1] }}>
      {options.map((option) => (
        <label
          key={option}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: colors.ink,
            padding: '6px 10px',
            borderRadius: radius.control,
            backgroundColor: selected.includes(option) ? '#F0FDFA' : '#FFFFFF',
            border: `1px solid ${selected.includes(option) ? '#99F6E4' : colors.border}`,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onChange(toggleList(selected, option))}
            data-testid={`${testId}-${option}`}
          />
          <span style={{ fontWeight: selected.includes(option) ? 600 : 400 }}>
            {HUMAN_REASON_LABELS[option] || option.replace(/_/g, ' ')}
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

function errorMessage(error: unknown): { message: string; correlationId: string | null } {
  if (error instanceof ApiQueryError) {
    return { message: error.message, correlationId: error.correlationId };
  }
  return { message: 'The charter could not be loaded.', correlationId: null };
}

export const CharterPage: React.FC = () => {
  const charterQuery = useCharter();
  const historyQuery = useCharterHistory();
  const mutation = useUpdateCharter();

  const [values, setValues] = useState<CharterFormValues | null>(null);
  const [initialValues, setInitialValues] = useState<CharterFormValues | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [errors, setErrors] = useState<CharterFieldErrors>({});
  const [newerCharter, setNewerCharter] = useState<Charter | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);
  const leaveDialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (charterQuery.data && values === null) {
      const formVals = toFormValues(charterQuery.data);
      setValues(formVals);
      setInitialValues(formVals);
      setBaseVersion(charterQuery.data.version);
    }
  }, [charterQuery.data, values]);

  const patch = (next: Partial<CharterFormValues>) => {
    setValues((current) => (current === null ? null : { ...current, ...next }));
    setSavedVersion(null);
  };

  const isDirty = useMemo(() => {
    if (!values || !initialValues) return false;
    const current = buildCharterUpdate(values, 0);
    const initial = buildCharterUpdate(initialValues, 0);
    if (!current.ok || !initial.ok) return JSON.stringify(values) !== JSON.stringify(initialValues);
    const comparable = (value: typeof current.value) => ({
      ...value,
      never_auto_reasons: [...(value.never_auto_reasons ?? [])].sort(),
      never_auto_actions: [...(value.never_auto_actions ?? [])].sort(),
    });
    return JSON.stringify(comparable(current.value)) !== JSON.stringify(comparable(initial.value));
  }, [values, initialValues]);

  const blocker = useBlocker(isDirty && !mutation.isPending);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = leaveDialog.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); blocker.reset(); }
      if (event.key === 'Tab' && buttons && buttons.length > 0) {
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [blocker]);

  const handleDiscard = () => {
    if (initialValues) {
      setValues({ ...initialValues });
      setErrors({});
      setSaveError(null);
    }
  };

  const handleSave = async () => {
    if (values === null || baseVersion === null || !isDirty || submitting.current) {
      return;
    }
    submitting.current = true;
    setSaveError(null);
    setNewerCharter(null);
    try {
      const built = buildCharterUpdate(values, baseVersion);
      if (!built.ok) {
        setErrors(built.errors);
        const first = Object.keys(built.errors)[0];
        const ids: Record<string, string> = { autoOfferMax: 'charter-auto-offer', autoAcceptMax: 'charter-auto-accept', autoActMaxDisputeAmount: 'charter-auto-act', repeatDisputerThreshold: 'charter-repeat-threshold' };
        if (first && ids[first]) document.getElementById(ids[first])?.focus();
        return;
      }
      setErrors({});
      try {
        const saved = await mutation.mutateAsync(built.value);
        const nextVals = toFormValues(saved);
        setValues(nextVals);
        setInitialValues(nextVals);
        setBaseVersion(saved.version);
        setSavedVersion(saved.version);
        setSavedAt(saved.created_at);
        toast('Signing limits saved.');
      } catch (error) {
        toast('Signing limits could not be saved. Review the form and try again.', 'error');
        if (error instanceof ApiQueryError && error.status === 409) {
          try {
            setNewerCharter(await fetchLatestCharter());
          } catch {
            setNewerCharter(null);
          }
        } else {
          setSaveError(error instanceof ApiQueryError ? error.message : 'The charter could not be saved.');
        }
      }
    } finally {
      submitting.current = false;
    }
  };

  if (charterQuery.isPending && values === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <Skeleton height="32px" width="40%" />
        <Skeleton height="240px" />
      </div>
    );
  }

  if (charterQuery.isError) {
    const { message, correlationId } = errorMessage(charterQuery.error);
    return (
      <ErrorState
        testId="charter-error"
        message={message}
        correlationId={correlationId}
        onRetry={() => void charterQuery.refetch()}
      />
    );
  }

  if (values === null) {
    return null;
  }

  const pending = mutation.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <style>{`.charter-save-bar { position: sticky; bottom: 0; } @media (max-width: 899px) { .charter-save-bar { bottom: calc(65px + env(safe-area-inset-bottom)); } }`}</style>
      <PageHeader
        title="Signing limits"
        description="What the agent may do without asking you."
        testId="charter-title"
      />

      {/* Concurrent Conflict Banner */}
      {newerCharter && (
        <div
          data-testid="charter-conflict"
          style={{
            backgroundColor: '#FFFDF5',
            border: `1px solid ${colors.badgeAttentionBorder}`,
            borderRadius: radius.card,
            padding: spacing[2],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing[1],
          }}
        >
          <strong style={{ color: colors.badgeAttentionText, fontSize: typography.fontSizeBody }}>
            Charter changed elsewhere
          </strong>
          <p style={{ margin: 0, fontSize: typography.fontSizeSmall, color: colors.ink }}>
            A newer version is available: <strong data-testid="charter-conflict-version">v{newerCharter.version}</strong>. Your unsaved changes were not applied.
          </p>
          <details>
            <summary>Compare your edits with the latest version</summary>
            <div style={{ overflowX: 'auto' }} role="region" aria-label="Signing limit comparison" tabIndex={0}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360, textAlign: 'left' }}>
                <thead><tr><th>Setting</th><th>Your edit</th><th>Latest</th></tr></thead>
                <tbody>
                  <tr><th>Offer limit (USD)</th><td>{values.autoOfferMax}</td><td>{newerCharter.auto_offer_max.value}</td></tr>
                  <tr><th>Accept limit (USD)</th><td>{values.autoAcceptMax}</td><td>{newerCharter.auto_accept_max.value}</td></tr>
                  <tr><th>Dispute size (USD)</th><td>{values.autoActMaxDisputeAmount}</td><td>{newerCharter.auto_act_max_dispute_amount.value}</td></tr>
                  <tr><th>Repeat threshold</th><td>{values.repeatDisputerThreshold}</td><td>{newerCharter.repeat_disputer_threshold}</td></tr>
                  <tr><th>Automatic evidence</th><td>{values.autoProvideEvidence ? 'On' : 'Off'}</td><td>{newerCharter.auto_provide_evidence ? 'On' : 'Off'}</td></tr>
                  <tr><th>Automatic messages</th><td>{values.autoSendMessage ? 'On' : 'Off'}</td><td>{newerCharter.auto_send_message ? 'On' : 'Off'}</td></tr>
                  <tr><th>Missing delivery</th><td>{values.missingDeliveryPolicy.replaceAll('_', ' ')}</td><td>{(newerCharter.missing_delivery_policy ?? 'HUMAN_REVIEW').replaceAll('_', ' ')}</td></tr>
                  <tr><th>Excluded reasons</th><td>{values.neverAutoReasons.join(', ') || 'None'}</td><td>{newerCharter.never_auto_reasons?.join(', ') || 'None'}</td></tr>
                  <tr><th>Excluded actions</th><td>{values.neverAutoActions.join(', ') || 'None'}</td><td>{newerCharter.never_auto_actions?.join(', ') || 'None'}</td></tr>
                </tbody>
              </table>
            </div>
          </details>
          <div>
            <Button
              testId="charter-load-latest"
              onClick={() => {
                const nextVals = toFormValues(newerCharter);
                setValues(nextVals);
                setInitialValues(nextVals);
                setBaseVersion(newerCharter.version);
                setNewerCharter(null);
                setErrors({});
              }}
            >
              Load version {newerCharter.version}
            </Button>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <Card title="Signing limits" testId="charter-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          <p style={{ margin: 0 }}>Set the amounts Signoff may handle without asking you. Other rules and PayPal's current options still apply.</p>
          <h2 style={{ fontSize: 18, margin: '16px 0 0' }}>Financial limits</h2>
          {/* Row 1: Refund without asking, up to */}
          <SettingRow
            id="charter-auto-offer"
            label="Offer a refund without asking, up to"
            legacyAriaLabel="Auto-offer maximum (USD)"
            helper="Signoff may offer up to this amount without asking when the other rules allow it. An offer is not a completed refund."
            value={values.autoOfferMax}
            {...(errors.autoOfferMax ? { error: errors.autoOfferMax } : {})}
            onChange={(value) => patch({ autoOfferMax: value })}
          />

          {/* Row 2: Accept a claim without asking, up to */}
          <SettingRow
            id="charter-auto-accept"
            label="Accept a claim without asking, up to"
            legacyAriaLabel="Auto-accept maximum (USD)"
            helper="Signoff may accept a buyer's claim up to this amount when the other rules allow it. Accepting concedes the claim."
            value={values.autoAcceptMax}
            {...(errors.autoAcceptMax ? { error: errors.autoAcceptMax } : {})}
            onChange={(value) => patch({ autoAcceptMax: value })}
          />

          {/* Row 3: Handle disputes up to */}
          <SettingRow
            id="charter-auto-act"
            label="Handle disputes up to"
            legacyAriaLabel="Maximum autonomous dispute size (USD)"
            helper="Disputes exceeding this total transaction amount are always escalated to human review."
            value={values.autoActMaxDisputeAmount}
            {...(errors.autoActMaxDisputeAmount ? { error: errors.autoActMaxDisputeAmount } : {})}
            onChange={(value) => patch({ autoActMaxDisputeAmount: value })}
          />

          {/* Row 4: Repeat disputer threshold */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: spacing[2], borderBottom: `1px solid ${colors.border}` }}>
            <label
              htmlFor="charter-repeat-threshold"
              style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, color: colors.ink }}
            >
              Repeat disputer threshold
            </label>
            <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
              Disputes from buyers with this many prior claims in the lookback window require human approval.
            </div>
            <input
              id="charter-repeat-threshold"
              data-testid="charter-repeat-threshold"
              aria-label="Repeat-disputer threshold"
              inputMode="numeric"
              value={values.repeatDisputerThreshold}
              onChange={(event) => patch({ repeatDisputerThreshold: event.target.value })}
              aria-invalid={errors.repeatDisputerThreshold ? true : undefined}
              aria-describedby={errors.repeatDisputerThreshold ? 'charter-repeat-threshold-error' : undefined}
              style={{
                maxWidth: '120px',
                marginTop: '6px',
                padding: '8px 12px',
                border: `1px solid ${errors.repeatDisputerThreshold ? colors.badgeCriticalText : colors.borderStrong}`,
                borderRadius: radius.control,
                fontSize: typography.fontSizeBody,
                color: colors.ink,
              }}
            />
            {errors.repeatDisputerThreshold && (
              <span
                id="charter-repeat-threshold-error"
                role="alert"
                data-testid="charter-repeat-threshold-error"
                style={{ color: colors.badgeCriticalText, fontSize: typography.fontSizeSmall }}
              >
                {errors.repeatDisputerThreshold}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: 18, margin: '16px 0 0' }}>Automatic actions</h2>
          {/* Automated features toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: typography.fontSizeBody }}>
              <input
                type="checkbox"
                checked={values.autoProvideEvidence}
                onChange={(event) => patch({ autoProvideEvidence: event.target.checked })}
                data-testid="charter-auto-provide-evidence"
              />
              Provide evidence automatically
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: typography.fontSizeBody }}>
              <input
                type="checkbox"
                checked={values.autoSendMessage}
                onChange={(event) => patch({ autoSendMessage: event.target.checked })}
                data-testid="charter-auto-send-message"
              />
              Send messages automatically
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, maxWidth: 560 }}>
            When delivery evidence is missing
            <select data-testid="charter-missing-delivery-policy" value={values.missingDeliveryPolicy}
              onChange={event => patch({ missingDeliveryPolicy: event.target.value === 'GATED_SETTLEMENT'
                ? 'GATED_SETTLEMENT' : 'HUMAN_REVIEW' })}>
              <option value="HUMAN_REVIEW">Require human review</option>
              <option value="GATED_SETTLEMENT">Allow settlement within signing limits</option>
            </select>
            <span style={{ fontSize: 13, color: 'var(--signoff-muted, #686861)' }}>
              Settlement actions remain subject to PayPal rules and your signing limits. Invalid tracking or an unknown order still requires review.
            </span>
          </label>

          {/* Exclusion rules */}
          {(values.neverAutoReasons.length > 0 || values.neverAutoActions.length > 0) && <div aria-label="Selected review exceptions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {values.neverAutoReasons.map(reason => <button key={reason} type="button" onClick={() => patch({ neverAutoReasons: toggleList(values.neverAutoReasons, reason) })} aria-label={`Remove reason ${HUMAN_REASON_LABELS[reason] || reason.replaceAll('_', ' ')}`} style={{ minHeight: 44, border: `1px solid ${colors.borderStrong}`, borderRadius: 6, background: colors.surfaceSubtle, color: colors.ink, padding: '8px 12px' }}>{HUMAN_REASON_LABELS[reason] || reason.replaceAll('_', ' ')} ×</button>)}
            {values.neverAutoActions.map(action => <button key={action} type="button" onClick={() => patch({ neverAutoActions: toggleList(values.neverAutoActions, action) })} aria-label={`Remove action ${action.replaceAll('_', ' ')}`} style={{ minHeight: 44, border: `1px solid ${colors.borderStrong}`, borderRadius: 6, background: colors.surfaceSubtle, color: colors.ink, padding: '8px 12px' }}>{action.replaceAll('_', ' ')} ×</button>)}
          </div>}
          <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Review exceptions</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginTop: spacing[1] }}>
            <CheckboxGroup<DisputeReason>
              legend="Never automate these reasons"
              options={DISPUTE_REASONS}
              selected={values.neverAutoReasons}
              onChange={(next) => patch({ neverAutoReasons: next })}
              testId="charter-never-reasons"
            />
            <CheckboxGroup<ActionType>
              legend="Never automate these actions"
              options={ACTION_TYPES}
              selected={values.neverAutoActions}
              onChange={(next) => patch({ neverAutoActions: next })}
              testId="charter-never-actions"
            />
          </div>

          </details>
          {/* In-form save notification / errors */}
          {savedVersion !== null && (
            <span role="status" data-testid="charter-save-success" style={{ color: colors.badgeSuccessText, fontSize: typography.fontSizeSmall }}>
              Charter v{savedVersion} saved.{savedAt && <> <time dateTime={savedAt}>{new Date(savedAt).toLocaleString()}</time></>}
            </span>
          )}
          {saveError && (
            <p role="alert" data-testid="charter-save-error" style={{ color: colors.badgeCriticalText, margin: 0, fontSize: typography.fontSizeSmall }}>
              {saveError}
            </p>
          )}
        </div>
      </Card>

      {/* Version history list */}
      <Card title="Version history" testId="charter-version-history">
        {historyQuery.isPending && <Skeleton height="80px" />}
        {historyQuery.isError && <p role="alert" style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>Version history is unavailable.</p>}
        {historyQuery.data?.length === 0 && (
          <EmptyState title="No versions yet" description="Saving the charter creates the first version." />
        )}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
            {historyQuery.data.map((version) => {
              const dateStr = new Date(version.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li
                  key={version.version}
                  data-testid={`charter-history-item-${version.version}`}
                  style={{
                    padding: spacing[1],
                    borderBottom: `1px solid ${colors.border}`,
                    fontSize: typography.fontSizeBody,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                    <strong style={{ color: colors.ink }}>Version {version.version}</strong>
                    <span style={{ color: colors.inkMuted, fontSize: typography.fontSizeSmall }}>&bull; {dateStr}</span>
                  </div>
                  <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                    Refund limit USD {version.auto_offer_max.value} &bull; Claim limit USD {version.auto_accept_max.value} &bull; Dispute size USD {version.auto_act_max_dispute_amount.value}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {blocker.state === 'blocked' && <div ref={leaveDialog} role="dialog" aria-modal="true" aria-labelledby="charter-leave-title" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ background: colors.surface, color: colors.ink, borderRadius: 8, padding: 24, width: 'min(100%, 440px)', display: 'grid', gap: 16 }}>
          <h2 id="charter-leave-title" style={{ margin: 0 }}>Discard unsaved changes?</h2>
          <p style={{ margin: 0 }}>Your changes to signing limits have not been saved.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button onClick={() => blocker.reset()}>Keep editing</Button><Button variant="secondary" onClick={() => blocker.proceed()}>Discard changes</Button></div>
        </div>
      </div>}

      {/* Sticky save bar at bottom */}
      <div
        data-testid="charter-sticky-save-bar"
        className="charter-save-bar"
        style={{
          backgroundColor: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          padding: `${spacing[2]} ${spacing[4]}`,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: spacing[2],
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          zIndex: 19,
        }}
      >
        <button
          type="button"
          onClick={handleDiscard}
          disabled={!isDirty || pending}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.control,
            fontSize: typography.fontSizeBody,
            color: isDirty ? colors.ink : colors.inkMuted,
            cursor: isDirty ? 'pointer' : 'default',
          }}
        >
          Discard
        </button>
        <button
          type="button"
          data-testid="charter-save-button"
          onClick={() => void handleSave()}
          disabled={!isDirty || pending}
          style={{
            padding: '8px 20px',
            backgroundColor: colors.primaryAction,
            border: 'none',
            borderRadius: radius.control,
            fontSize: typography.fontSizeBody,
            fontWeight: typography.fontWeightSemibold,
            color: '#FFFFFF',
            cursor: !isDirty || pending ? 'not-allowed' : 'pointer',
            opacity: !isDirty || pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
