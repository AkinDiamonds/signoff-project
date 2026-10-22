import React, { useEffect, useRef, useState } from 'react';
import type { ActionType, DisputeReason } from '@signoff/api-client';
import { Button, Card, EmptyState, ErrorState, Skeleton, colors, spacing } from '@signoff/ui';
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

interface MoneyFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const MoneyField: React.FC<MoneyFieldProps> = ({ id, label, value, error, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      data-testid={id}
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      style={{ padding: '8px', border: `1px solid ${error ? colors.verdict.DENY.border : colors.border}`, borderRadius: '6px' }}
    />
    {error && (
      <span id={`${id}-error`} role="alert" data-testid={`${id}-error`} style={{ color: colors.verdict.DENY.text, fontSize: '12px' }}>
        {error}
      </span>
    )}
  </div>
);

const CheckboxGroup = <T extends string,>({
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
  <fieldset data-testid={testId} style={{ border: `1px solid ${colors.border}`, borderRadius: '6px', padding: spacing[1] }}>
    <legend style={{ fontWeight: 600 }}>{legend}</legend>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[1] }}>
      {options.map((option) => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
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
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [errors, setErrors] = useState<CharterFieldErrors>({});
  const [newerCharter, setNewerCharter] = useState<Charter | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (charterQuery.data && values === null) {
      setValues(toFormValues(charterQuery.data));
      setBaseVersion(charterQuery.data.version);
    }
  }, [charterQuery.data, values]);

  const patch = (next: Partial<CharterFormValues>) => {
    setValues((current) => (current === null ? null : { ...current, ...next }));
    setSavedVersion(null);
  };

  const handleSave = async () => {
    if (values === null || baseVersion === null || submitting.current) {
      return;
    }
    submitting.current = true;
    setSaveError(null);
    setNewerCharter(null);
    try {
      // base_version is the version the user loaded and edited. Fetching the
      // latest version here would silently overwrite someone else's change.
      const built = buildCharterUpdate(values, baseVersion);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      setErrors({});
      try {
        const saved = await mutation.mutateAsync(built.value);
        setValues(toFormValues(saved));
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
      <Card testId="charter-loading">
        <Skeleton height="32px" width="40%" />
        <Skeleton height="160px" />
      </Card>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      <header>
        <h1 data-testid="charter-title" style={{ margin: 0 }}>Authority Charter</h1>
        <p style={{ color: colors.inkMuted, margin: '4px 0 0' }}>
          Version {charterQuery.data?.version ?? '-'}. Limits apply to every automated decision.
        </p>
      </header>

      {newerCharter && (
        <Card testId="charter-conflict">
          <h2 style={{ marginTop: 0, color: colors.verdict.NEEDS_APPROVAL.text }}>Charter changed elsewhere</h2>
          <p>
            A newer version is available: <strong data-testid="charter-conflict-version">v{newerCharter.version}</strong>.
            Your unsaved changes were not applied.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing[1] }}>
            <div><dt>Auto offer</dt><dd>USD {newerCharter.auto_offer_max.value}</dd></div>
            <div><dt>Auto accept</dt><dd>USD {newerCharter.auto_accept_max.value}</dd></div>
            <div><dt>Auto-act dispute size</dt><dd>USD {newerCharter.auto_act_max_dispute_amount.value}</dd></div>
            <div><dt>Repeat threshold</dt><dd>{newerCharter.repeat_disputer_threshold}</dd></div>
          </dl>
          <Button
            testId="charter-load-latest"
            onClick={() => {
              setValues(toFormValues(newerCharter));
              setBaseVersion(newerCharter.version);
              setNewerCharter(null);
              setErrors({});
            }}
          >
            Load version {newerCharter.version}
          </Button>
        </Card>
      )}

      <Card title="Limits" testId="charter-form">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing[2] }}>
          <MoneyField
            id="charter-auto-offer"
            label="Auto-offer maximum (USD)"
            value={values.autoOfferMax}
            {...(errors.autoOfferMax ? { error: errors.autoOfferMax } : {})}
            onChange={(value) => patch({ autoOfferMax: value })}
          />
          <MoneyField
            id="charter-auto-accept"
            label="Auto-accept maximum (USD)"
            value={values.autoAcceptMax}
            {...(errors.autoAcceptMax ? { error: errors.autoAcceptMax } : {})}
            onChange={(value) => patch({ autoAcceptMax: value })}
          />
          <MoneyField
            id="charter-auto-act"
            label="Maximum autonomous dispute size (USD)"
            value={values.autoActMaxDisputeAmount}
            {...(errors.autoActMaxDisputeAmount ? { error: errors.autoActMaxDisputeAmount } : {})}
            onChange={(value) => patch({ autoActMaxDisputeAmount: value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="charter-repeat-threshold">Repeat-disputer threshold</label>
            <input
              id="charter-repeat-threshold"
              data-testid="charter-repeat-threshold"
              inputMode="numeric"
              value={values.repeatDisputerThreshold}
              onChange={(event) => patch({ repeatDisputerThreshold: event.target.value })}
              aria-invalid={errors.repeatDisputerThreshold ? true : undefined}
              aria-describedby={errors.repeatDisputerThreshold ? 'charter-repeat-threshold-error' : undefined}
              style={{ padding: '8px', border: `1px solid ${errors.repeatDisputerThreshold ? colors.verdict.DENY.border : colors.border}`, borderRadius: '6px' }}
            />
            {errors.repeatDisputerThreshold && (
              <span id="charter-repeat-threshold-error" role="alert" data-testid="charter-repeat-threshold-error" style={{ color: colors.verdict.DENY.text, fontSize: '12px' }}>
                {errors.repeatDisputerThreshold}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={values.autoProvideEvidence}
              onChange={(event) => patch({ autoProvideEvidence: event.target.checked })}
              data-testid="charter-auto-provide-evidence"
            />
            Provide evidence automatically
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={values.autoSendMessage}
              onChange={(event) => patch({ autoSendMessage: event.target.checked })}
              data-testid="charter-auto-send-message"
            />
            Send messages automatically
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], marginTop: spacing[2] }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] }}>
          <Button testId="charter-save-button" onClick={() => void handleSave()} disabled={pending}>
            {pending ? 'Saving...' : 'Save charter'}
          </Button>
          {savedVersion !== null && (
            <span role="status" data-testid="charter-save-success">
              Charter v{savedVersion} saved.
            </span>
          )}
        </div>
        {saveError && <p role="alert" data-testid="charter-save-error" style={{ color: colors.verdict.DENY.text }}>{saveError}</p>}
      </Card>

      <Card title="Version history" testId="charter-version-history">
        {historyQuery.isPending && <Skeleton height="80px" />}
        {historyQuery.isError && <p role="alert">Version history is unavailable.</p>}
        {historyQuery.data?.length === 0 && (
          <EmptyState title="No versions yet" description="Saving the charter creates the first version." />
        )}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
            {historyQuery.data.map((version) => (
              <li key={version.version} data-testid={`charter-history-item-${version.version}`} style={{ padding: spacing[1], border: `1px solid ${colors.border}`, borderRadius: '6px' }}>
                <strong>v{version.version}</strong>{' '}
                <span style={{ color: colors.inkMuted }}>{new Date(version.created_at).toISOString()}</span>
                <div style={{ fontSize: '13px' }}>
                  Offer USD {version.auto_offer_max.value} · Accept USD {version.auto_accept_max.value} ·
                  Dispute size USD {version.auto_act_max_dispute_amount.value}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
};
