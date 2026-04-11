import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error('Supabase env vars em falta: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createBrowserClient(
    env.url,
    env.anonKey
  );
}
