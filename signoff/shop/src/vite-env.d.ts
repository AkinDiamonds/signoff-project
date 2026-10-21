/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly PUBLIC_API_URL?: string;
  readonly VITE_PAYPAL_CLIENT_ID?: string;
  readonly PUBLIC_SIGNOFF_URL?: string;
  readonly VITE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
