/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — enables cloud workspaces, auth and realtime sync. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key — enables cloud workspaces, auth and realtime sync. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Email of the Supabase admin account used by `loginAdmin`. */
  readonly VITE_FESTIZE_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
