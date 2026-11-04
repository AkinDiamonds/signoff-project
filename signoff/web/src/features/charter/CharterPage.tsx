import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import type { ActionType, DisputeReason } from '@signoff/api-client';
import {
  Button,
  ConceptButton,
  ConceptCard,
  ConceptDisclosure,
  ConceptPageTitle,
  ConceptSectionHeading,
  EmptyState,
  ErrorState,
  Skeleton,
  colors,
  concept,
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
  helper?: string;
  hiddenHelper?: string;
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
  hiddenHelper,
  value,
  currency = 'USD',
  error,
  onChange,
}) => {
  const describedBy = [hiddenHelper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: 16, alignItems: 'center', padding: '16px 0', borderTop: `1px solid ${concept.border}` }}>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <label htmlFor={id} style={{ fontSize: 17, fontWeight: 600, color: concept.ink }}>{label}</label>
        {helper && <span style={{ fontSize: 14, color: concept.muted }}>{helper}</span>}
        {hiddenHelper && <span id={`${id}-help`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{hiddenHelper}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap', border: `1px solid ${error ? concept.dangerText : colors.borderStrong}`, borderRadius: 10, overflow: 'hidden', background: concept.surface }}>
        <span style={{ flex: 'none', width: 42, textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 500, color: concept.muted, borderRight: `1px solid ${concept.border}`, userSelect: 'none' }}>{currency}</span>
        <input
          id={id}
          data-testid={id}
          aria-label={legacyAriaLabel}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          style={{ width: '100%', minWidth: 0, padding: '8px 10px', border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: typography.fontFamily, color: concept.ink, textAlign: 'right' }}
        />
      </div>
      {error && (
        <span id={`${id}-error`} role="alert" data-testid={`${id}-error`} style={{ gridColumn: '1 / -1', color: concept.dangerText, fontSize: 14 }}>
          {error}
        </span>
      )}
    </div>
  );
};

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
            backgroundColor: selected.includes(option) ? concept.primarySoft : concept.surface,
            border: `1px solid ${selected.includes(option) ? concept.primary : colors.border}`,
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
        if (first === 'repeatDisputerThreshold') {
          const exceptions = document.querySelector('[data-testid="charter-review-exceptions"]');
          if (exceptions instanceof HTMLDetailsElement) exceptions.open = true;
        }
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
      <ConceptPageTitle
        title="Signing limits"
        subtitle="What Signoff may do without asking."
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
      <ConceptCard testId="charter-form" style={{ display: 'grid', gap: 0 }}>
        <ConceptSectionHeading>Financial limits</ConceptSectionHeading>
        <div style={{ marginTop: 8 }}>
          <SettingRow
            id="charter-auto-offer"
            label="Offer a refund, up to"
            legacyAriaLabel="Auto-offer maximum (USD)"
            helper="An offer is not a completed refund."
            value={values.autoOfferMax}
            {...(errors.autoOfferMax ? { error: errors.autoOfferMax } : {})}
            onChange={(value) => patch({ autoOfferMax: value })}
          />
          <SettingRow
            id="charter-auto-accept"
            label="Accept a claim, up to"
            legacyAriaLabel="Auto-accept maximum (USD)"
            helper="Accepting concedes the claim."
            value={values.autoAcceptMax}
            {...(errors.autoAcceptMax ? { error: errors.autoAcceptMax } : {})}
            onChange={(value) => patch({ autoAcceptMax: value })}
          />
          <SettingRow
            id="charter-auto-act"
            label="Handle disputes, up to"
            legacyAriaLabel="Maximum autonomous dispute size (USD)"
            hiddenHelper="Disputes above this total transaction amount are always escalated to human review."
            value={values.autoActMaxDisputeAmount}
            {...(errors.autoActMaxDisputeAmount ? { error: errors.autoActMaxDisputeAmount } : {})}
            onChange={(value) => patch({ autoActMaxDisputeAmount: value })}
          />
        </div>
        {savedVersion !== null && (
          <span role="status" data-testid="charter-save-success" style={{ color: concept.primary, fontSize: 14, marginTop: 8 }}>
            Charter v{savedVersion} saved.{savedAt && <> <time dateTime={savedAt}>{new Date(savedAt).toLocaleString()}</time></>}
          </span>
        )}
        {saveError && (
          <p role="alert" data-testid="charter-save-error" style={{ color: concept.dangerText, margin: '8px 0 0', fontSize: 14 }}>
            {saveError}
          </p>
        )}
      </ConceptCard>

      <ConceptCard padding={0}>
        <ConceptDisclosure testId="charter-review-exceptions" title="Review exceptions" subtitle={`Repeat buyer threshold: ${values.repeatDisputerThreshold}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="charter-repeat-threshold" style={{ fontSize: 17, fontWeight: 600, color: concept.ink }}>
                Repeat disputer threshold
              </label>
              <span style={{ fontSize: 14, color: concept.muted }}>
                Disputes from buyers with this many prior claims in the lookback window require human approval.
              </span>
              <input
                id="charter-repeat-threshold"
                data-testid="charter-repeat-threshold"
                aria-label="Repeat-disputer threshold"
                inputMode="numeric"
                value={values.repeatDisputerThreshold}
                onChange={(event) => patch({ repeatDisputerThreshold: event.target.value })}
                aria-invalid={errors.repeatDisputerThreshold ? true : undefined}
                aria-describedby={errors.repeatDisputerThreshold ? 'charter-repeat-threshold-error' : undefined}
                style={{ maxWidth: 120, marginTop: 6, padding: '8px 12px', border: `1px solid ${errors.repeatDisputerThreshold ? concept.dangerText : colors.borderStrong}`, borderRadius: 10, fontSize: 16, color: concept.ink }}
              />
              {errors.repeatDisputerThreshold && (
                <span id="charter-repeat-threshold-error" role="alert" data-testid="charter-repeat-threshold-error" style={{ color: concept.dangerText, fontSize: 14 }}>
                  {errors.repeatDisputerThreshold}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2] }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16 }}>
                <input type="checkbox" checked={values.autoProvideEvidence} onChange={(event) => patch({ autoProvideEvidence: event.target.checked })} data-testid="charter-auto-provide-evidence" />
                Provide evidence automatically
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16 }}>
                <input type="checkbox" checked={values.autoSendMessage} onChange={(event) => patch({ autoSendMessage: event.target.checked })} data-testid="charter-auto-send-message" />
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
              <span style={{ fontSize: 13, color: concept.muted }}>
                Settlement actions remain subject to PayPal rules and your signing limits. Invalid tracking or an unknown order still requires review.
              </span>
            </label>

            {(values.neverAutoReasons.length > 0 || values.neverAutoActions.length > 0) && <div aria-label="Selected review exceptions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {values.neverAutoReasons.map(reason => <button key={reason} type="button" onClick={() => patch({ neverAutoReasons: toggleList(values.neverAutoReasons, reason) })} aria-label={`Remove reason ${HUMAN_REASON_LABELS[reason] || reason.replaceAll('_', ' ')}`} style={{ minHeight: 44, border: `1px solid ${colors.borderStrong}`, borderRadius: 10, background: concept.subtle, color: concept.ink, padding: '8px 12px' }}>{HUMAN_REASON_LABELS[reason] || reason.replaceAll('_', ' ')} ×</button>)}
              {values.neverAutoActions.map(action => <button key={action} type="button" onClick={() => patch({ neverAutoActions: toggleList(values.neverAutoActions, action) })} aria-label={`Remove action ${action.replaceAll('_', ' ')}`} style={{ minHeight: 44, border: `1px solid ${colors.borderStrong}`, borderRadius: 10, background: concept.subtle, color: concept.ink, padding: '8px 12px' }}>{action.replaceAll('_', ' ')} ×</button>)}
            </div>}
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
        </ConceptDisclosure>
      </ConceptCard>

      <ConceptCard padding={0}>
        <ConceptDisclosure testId="charter-version-history" icon="clock" title="Version history">
          {historyQuery.isPending && <Skeleton height="80px" />}
          {historyQuery.isError && <p role="alert" style={{ fontSize: 14, color: concept.muted }}>Version history is unavailable.</p>}
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
                  <li key={version.version} data-testid={`charter-history-item-${version.version}`} style={{ padding: spacing[1], borderBottom: `1px solid ${concept.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                      <strong style={{ color: concept.ink }}>Version {version.version}</strong>
                      <span style={{ color: concept.muted, fontSize: 14 }}>&bull; {dateStr}</span>
                    </div>
                    <div style={{ fontSize: 14, color: concept.muted }}>
                      Refund limit USD {version.auto_offer_max.value} &bull; Claim limit USD {version.auto_accept_max.value} &bull; Dispute size USD {version.auto_act_max_dispute_amount.value}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </ConceptDisclosure>
      </ConceptCard>

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
        style={{ backgroundColor: concept.surface, borderTop: `1px solid ${concept.border}`, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, zIndex: 19 }}
      >
        {isDirty && !pending && (
          <ConceptButton variant="secondary" onClick={handleDiscard}>Discard</ConceptButton>
        )}
        <ConceptButton
          testId="charter-save-button"
          onClick={() => void handleSave()}
          disabled={!isDirty || pending}
          fullWidth
          style={{ flex: 1 }}
        >
          {pending ? 'Saving...' : 'Save changes'}
        </ConceptButton>
      </div>
    </div>
  );
};
