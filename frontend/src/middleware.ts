import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/termos',
  '/privacidade',
  '/manutencao',
];

function buildRedirectUrl(request: NextRequest, pathname: string) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  const baseUrl = host ? `${protocol}://${host}` : request.url;
  const redirectUrl = new URL(pathname, baseUrl);

  redirectUrl.search = '';
  redirectUrl.hash = '';

  return redirectUrl;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/f/');
  const env = getSupabaseEnv();

  if (!env) {
    if (isPublic) {
      return response;
    }

    return NextResponse.redirect(buildRedirectUrl(request, '/login'));
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
          response.cookies.set({ name, value: '', ...(options as object) });
        },
      },
    }
  );

  // Refresh session — keeps cookies up to date
  const { data: { session } } = await supabase.auth.getSession();

  // Redirect unauthenticated users to /login
  if (!session && !isPublic) {
    return NextResponse.redirect(buildRedirectUrl(request, '/login'));
  }

  // Redirect authenticated users away from /login
  if (session && pathname === '/login') {
    return NextResponse.redirect(buildRedirectUrl(request, '/'));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/signout).*)',
  ],
};
