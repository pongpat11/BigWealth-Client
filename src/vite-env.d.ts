/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the BigWealth API (BigWealth-Server). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
