/**
 * AgLlmAdapter implementation that proxies turns through the server at POST /api/llm/studio.
 * The browser never holds the LLM key; the key lives server-side only.
 *
 * Routes through apiClient so it respects getApiBaseUrl() in production/dev
 * and mockFetch in mock mode (VITE_MOCK_API=true).
 *
 * Stream is not required: we buffer the whole turn and emit one TEXT_MESSAGE_CHUNK event,
 * then resolve `complete` with status 'completed'.
 */

import type {
  AgAiEvent,
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponse,
  AgLlmExecuteTurnOptions,
  AgLlmResponseHandler,
} from 'ag-studio';
import { apiClient } from '../../app/api';

const STUDIO_LLM_ENDPOINT = '/api/llm/studio';

async function* emitTextAsChunks(text: string): AsyncGenerator<AgAiEvent> {
  const messageId = crypto.randomUUID();
  yield { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' } satisfies AgAiEvent;
  yield { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text } satisfies AgAiEvent;
  yield { type: 'TEXT_MESSAGE_END', messageId } satisfies AgAiEvent;
}

export const studioLlmAdapter: AgLlmAdapter = {
  executeTurn(request: AgLlmRequest, options?: AgLlmExecuteTurnOptions): AgLlmResponseHandler {
    const messageId = crypto.randomUUID();
    const responseId = crypto.randomUUID();
    const createdAt = Date.now();

    const complete: Promise<AgLlmResponse> = (async () => {
      const body = {
        input: request.input,
        instructions: request.instructions,
        tools: request.tools,
        responseFormat: request.responseFormat,
      };

      try {
        const response = await apiClient.request<{ answer: string; model?: string }>(
          STUDIO_LLM_ENDPOINT,
          {
            method: 'POST',
            body,
            signal: options?.signal,
          }
        );

        if (!response.success || !response.data) {
          const errorMessage =
            response.error?.kind === 'api_envelope'
              ? response.error.error.message
              : response.error?.message ?? `LLM proxy error ${response.status}`;

          return {
            id: responseId,
            createdAt,
            status: 'failed',
            error: { code: String(response.status), message: errorMessage },
            output: [],
          } satisfies AgLlmResponse;
        }

        const text = response.data.answer ?? '';

        return {
          id: responseId,
          createdAt,
          status: 'completed',
          model: response.data.model,
          output: [
            {
              id: messageId,
              kind: 'output',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'text', text, annotations: [] }],
            },
          ],
        } satisfies AgLlmResponse;
      } catch (err: unknown) {
        return {
          id: responseId,
          createdAt,
          status: 'failed',
          error: {
            code: 'FETCH_ERROR',
            message: err instanceof Error ? err.message : 'Unknown network error',
          },
          output: [],
        } satisfies AgLlmResponse;
      }
    })();

    // Stream: emit the text as events once the promise resolves
    const stream = {
      [Symbol.asyncIterator](): AsyncIterator<AgAiEvent> {
        return (async function* () {
          const response = await complete;
          if (response.status === 'completed') {
            const msg = response.output[0];
            if (msg && msg.type === 'message' && msg.role === 'assistant') {
              const textPart = msg.content.find((c) => c.type === 'text');
              if (textPart && textPart.type === 'text') {
                yield* emitTextAsChunks(textPart.text);
              }
            }
          }
        })();
      },
    };

    return { stream, complete };
  },
};
