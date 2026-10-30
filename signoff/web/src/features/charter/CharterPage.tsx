import React, { useEffect, useMemo, useRef, useState } from 'react';
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
          backgroundColor: '#F7F7F7',
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
    }}
  >
    <legend style={{ fontWeight: typography.fontWeightSemibold, fontSize: typography.fontSizeSmall, color: colors.ink }}>
      {legend}
    </legend>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] }}>
      {options.map((option) => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: typography.fontSizeBody, color: colors.ink }}>
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onChange(toggleList(selected, option))}
            data-testid={`${testId}-${option}`}
          />
          {option.replace(/_/g, ' ')}
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

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
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  const handleDiscard = () => {
    if (initialValues) {
      setValues({ ...initialValues });
      setErrors({});
      setSaveError(null);
    }
  };

  const handleSave = async () => {
    if (values === null || baseVersion === null || submitting.current) {
      return;
    }
    submitting.current = true;
    setSaveError(null);
    setNewerCharter(null);
    try {
      const built = buildCharterUpdate(values, baseVersion);
      if (!built.ok) {
        setErrors(built.errors);
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
      } catch (error) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], paddingBottom: '80px' }}>
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
      <Card title="Autonomous signing authority" testId="charter-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {/* Row 1: Refund without asking, up to */}
          <SettingRow
            id="charter-auto-offer"
            label="Refund without asking, up to"
            legacyAriaLabel="Auto-offer maximum (USD)"
            helper="Disputes up to this amount will be refunded automatically when evidence warrants it."
            value={values.autoOfferMax}
            {...(errors.autoOfferMax ? { error: errors.autoOfferMax } : {})}
            onChange={(value) => patch({ autoOfferMax: value })}
          />

          {/* Row 2: Accept a claim without asking, up to */}
          <SettingRow
            id="charter-auto-accept"
            label="Accept a claim without asking, up to"
            legacyAriaLabel="Auto-accept maximum (USD)"
            helper="Buyer claims up to this amount will be conceded without requesting human review."
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

          {/* Exclusion rules */}
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

          {/* In-form save notification / errors */}
          {savedVersion !== null && (
            <span role="status" data-testid="charter-save-success" style={{ color: colors.badgeSuccessText, fontSize: typography.fontSizeSmall }}>
              Charter v{savedVersion} saved.
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

      {/* Sticky save bar at bottom */}
      <div
        data-testid="charter-sticky-save-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          padding: `${spacing[2]} ${spacing[4]}`,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: spacing[2],
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          zIndex: 100,
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
          disabled={pending}
          style={{
            padding: '8px 20px',
            backgroundColor: colors.primaryAction,
            border: 'none',
            borderRadius: radius.control,
            fontSize: typography.fontSizeBody,
            fontWeight: typography.fontWeightSemibold,
            color: '#FFFFFF',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
