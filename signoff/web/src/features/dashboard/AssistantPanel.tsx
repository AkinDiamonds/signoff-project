import React, { useRef, useState } from 'react';
import { Button, Card, colors } from '@signoff/ui';
import { ApiQueryError } from '../../app/queries';
import { askAssistant } from './api';
import {
  SAMPLE_QUESTIONS,
  buildAssistantRequest,
  type AssistantResponse,
  type DisputeItem,
  type Kpis,
} from './types';

export interface AssistantPanelProps {
  kpis: Kpis;
  disputes: readonly DisputeItem[];
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ kpis, disputes }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '' || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    setAnswer(null);
    try {
      setAnswer(await askAssistant(buildAssistantRequest(trimmed, kpis, disputes)));
      setQuestion('');
    } catch (caught) {
      setError(
        caught instanceof ApiQueryError
          ? caught.message
          : 'The assistant could not answer. Check the LLM configuration.'
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Card title="Ask the dashboard" testId="assistant-panel">
      <p data-testid="assistant-readonly-label" style={{ marginTop: 0, color: colors.inkMuted }}>
        Read-only assistant. It can summarise KPIs and disputes; it cannot approve, edit or take
        actions.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
      >
        <input
          aria-label="Dashboard question"
          data-testid="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about open disputes, deadlines or limits"
          style={{ flex: '1 1 260px', padding: '8px', border: `1px solid ${colors.border}`, borderRadius: '6px' }}
        />
        <Button type="submit" testId="assistant-ask-button" disabled={pending || question.trim() === ''}>
          {pending ? 'Asking...' : 'Ask'}
        </Button>
      </form>

      <div style={{ marginTop: '12px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', color: colors.inkMuted }}>Sample questions</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SAMPLE_QUESTIONS.map((sample, index) => (
            <Button
              key={sample}
              variant="secondary"
              testId={`assistant-sample-${index}`}
              onClick={() => void ask(sample)}
              disabled={pending}
            >
              {sample}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="assistant-error" style={{ color: colors.verdict.DENY.text }}>
          {error}
        </p>
      )}
      {answer && (
        <div data-testid="assistant-answer" style={{ marginTop: '12px', whiteSpace: 'pre-wrap' }}>
          {answer.answer}
        </div>
      )}
    </Card>
  );
};
