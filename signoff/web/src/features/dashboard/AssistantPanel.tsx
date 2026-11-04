import React, { useRef, useState } from 'react';
import { ConceptButton, ConceptPill, ConceptSearchField, concept } from '@signoff/ui';
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
    <section aria-labelledby="assistant-title" data-testid="assistant-panel" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="assistant-title" style={{ margin: 0, fontSize: 22, fontWeight: 750, letterSpacing: '-0.01em' }}>Ask your dashboard</h2>
        <ConceptPill tone="gray">Read-only</ConceptPill>
      </div>
      <p data-testid="assistant-readonly-label" style={{ margin: 0, fontSize: 14, color: concept.muted }}>
        Read-only assistant. It can summarise KPIs and disputes; it cannot approve, edit or take
        actions.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <ConceptSearchField
          aria-label="Dashboard question"
          data-testid="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about deadlines…"
        />
        <ConceptButton type="submit" testId="assistant-ask-button" disabled={pending || question.trim() === ''}>
          {pending ? 'Asking...' : 'Ask'}
        </ConceptButton>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Sample questions" role="group">
        {SAMPLE_QUESTIONS.map((sample, index) => (
          <ConceptButton
            key={sample}
            variant="secondary"
            testId={`assistant-sample-${index}`}
            onClick={() => void ask(sample)}
            disabled={pending}
            style={{ minHeight: 44, fontSize: 14, fontWeight: 550, whiteSpace: 'normal', textAlign: 'left', padding: '8px 14px' }}
          >
            {sample}
          </ConceptButton>
        ))}
      </div>

      {error && (
        <p role="alert" data-testid="assistant-error" style={{ color: concept.dangerText, margin: 0 }}>
          {error}
        </p>
      )}
      {answer && (
        <div data-testid="assistant-answer" style={{ background: concept.subtle, borderRadius: 12, padding: 16, whiteSpace: 'pre-wrap' }}>
          {answer.answer}
        </div>
      )}
    </section>
  );
};
