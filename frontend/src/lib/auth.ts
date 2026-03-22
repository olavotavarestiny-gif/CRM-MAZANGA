import { createClient } from './supabase/client';

export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

// Legacy compat — kept so any imports of getToken don't break at compile time
// These should not be called at runtime (Supabase manages tokens via cookies)
export function getToken(): string | null {
  return null;
}

export function setToken(_token: string): void {}
export function removeToken(): void {}
