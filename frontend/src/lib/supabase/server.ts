import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error('Supabase env vars em falta: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const cookieStore = cookies();

  return createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
