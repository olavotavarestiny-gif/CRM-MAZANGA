import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

// Server-side signout: clears all Supabase SSR cookies via Set-Cookie headers.
// Using client-side signOut() alone doesn't reliably clear chunked SSR cookies.
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next');
  const nextPath = next && next.startsWith('/') ? next : '/login';
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const env = getSupabaseEnv();

  if (!env) {
    return response;
  }

  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...(options as object) });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', maxAge: 0, ...(options as object) });
        },
      },
    }
  );

  await supabase.auth.signOut();
  return response;
}
