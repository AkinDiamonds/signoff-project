/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly PUBLIC_API_URL?: string;
  readonly VITE_MOCK_API?: string;
  readonly PUBLIC_SHOP_URL?: string;
  readonly PUBLIC_SIGNOFF_URL?: string;
  readonly VITE_DEMO_CLAIM_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
