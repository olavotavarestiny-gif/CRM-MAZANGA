import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// Server-side signout: clears all Supabase SSR cookies via Set-Cookie headers.
// Using client-side signOut() alone doesn't reliably clear chunked SSR cookies.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
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
