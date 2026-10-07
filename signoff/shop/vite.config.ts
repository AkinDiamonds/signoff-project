import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl =
    env.VITE_API_URL ||
    env.PUBLIC_API_URL ||
    process.env.VITE_API_URL ||
    process.env.PUBLIC_API_URL;

  if (mode === 'production' && !apiUrl) {
    throw new Error(
      'BUILD ERROR: API base URL variable (VITE_API_URL or PUBLIC_API_URL) is required for production builds. Silent localhost defaults are forbidden.'
    );
  }

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl ?? ''),
    },
  };
});
