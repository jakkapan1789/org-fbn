// Central place for backend-connection settings, sourced from Vite env vars (see
// .env.example at the repo root). import.meta.env.VITE_* is inlined at build time, so
// nothing here needs a server round-trip to read.

/** Fallback when VITE_API_BASE_URL is unset — the app always talks to a real backend
 *  (there is no mock data), so an unconfigured build points at the local one. */
const DEFAULT_API_BASE_URL = "http://localhost:41704/api";

/** Backend base URL, trailing slash stripped. */
export const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL ?? "").trim() || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  "",
);

/** Sent as `Authorization: Bearer <token>` when set. */
export const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

/** Request timeout in ms before a call is aborted. */
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 10000;
