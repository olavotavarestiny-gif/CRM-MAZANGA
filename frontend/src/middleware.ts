import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/termos',
  '/privacidade',
  '/manutencao',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response.cookies.set({ name, value: '', ...(options as object) });
        },
      },
    }
  );

  // Refresh session — keeps cookies up to date
  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/f/');

  // Redirect unauthenticated users to /login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users away from /login
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/signout).*)',
  ],
};
