// Central place for backend-connection settings, sourced from Vite env vars (see
// .env.example at the repo root). import.meta.env.VITE_* is inlined at build time, so
// nothing here needs a server round-trip to read.

/** Backend base URL, trailing slash stripped. Empty string when unset. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

/** Sent as `Authorization: Bearer <token>` when set. */
export const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

/** Request timeout in ms before a call is aborted. */
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 10000;

/** No base URL configured → nothing to call, so fall back to the deterministic mock
 *  generator (src/orgchart/orgData.ts) and keep the app runnable standalone. */
export const USE_MOCK_DATA = API_BASE_URL === "";
