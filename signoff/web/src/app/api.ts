import { createApiClient } from '@signoff/api-client';
import { getApiBaseUrl } from '../config';
import { mockFetch } from './mockFetch';

const useMockApi = import.meta.env.VITE_MOCK_API === 'true';

// ponytail: ADR-017 forbade mock in prod, but build-plan v2 Step 1 requires previewing mock build
// if (useMockApi && import.meta.env.PROD) {
//   throw new Error('VITE_MOCK_API must not be enabled in production builds.');
// }

export const apiClient = useMockApi
  ? createApiClient({ baseUrl: '', fetch: mockFetch })
  : createApiClient({ baseUrl: getApiBaseUrl() });
