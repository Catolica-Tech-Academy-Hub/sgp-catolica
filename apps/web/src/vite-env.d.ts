/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const componente: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default componente;
}

declare module '*.md' {
  import type { DefineComponent } from 'vue';
  const componente: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default componente;
}

interface ImportMetaEnv {
  /** Endereço da API (`apps/api`). Sem ele, a web roda com os dados de demonstração. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
