/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string
}

declare module '*.glsl?raw' {
  const source: string
  export default source
}
