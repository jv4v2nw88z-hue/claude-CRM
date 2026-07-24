/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin. Left empty in dev so Vite's proxy handles /api. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
