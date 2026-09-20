/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOKEOPS_ENDPOINT: string;
  readonly VITE_SPOKEOPS_APP_ID: string;
  readonly VITE_SPOKEOPS_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
