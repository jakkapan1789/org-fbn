/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL — see .env.example. Empty/unset keeps the app on mock data. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
