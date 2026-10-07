/**
 * Environment configuration for web application.
 * Enforces presence of API URL in production with no silent localhost defaults.
 */

export function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL || import.meta.env.PUBLIC_API_URL;

  if (!url) {
    if (import.meta.env.PROD) {
      throw new Error(
        'CRITICAL CONFIG ERROR: Missing API base URL variable (VITE_API_URL / PUBLIC_API_URL) in production build.'
      );
    }
    return 'http://localhost:8000';
  }

  return url;
}
