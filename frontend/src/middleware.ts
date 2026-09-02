import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import {
  DEV_AUTH_HEADER,
  DEV_AUTH_TOKEN,
  DEV_AUTH_USER,
  isServerDevAuthBypassEnabled,
} from '@/lib/dev-auth';
import { isFoodProduct, isGrowthRoomProduct, toPublicFoodPath } from '@/lib/product';

const PUBLIC_PATHS = [
  '/login',
  '/register',
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
  const pathname = request.nextUrl.pathname;
  const foodProduct = isFoodProduct();
  const growthProduct = isGrowthRoomProduct();

  // Assets que nunca precisam de autenticação — deixar passar sempre.
  // O matcher no config deveria excluí-los mas o regex de lookahead negativo
  // não funciona de forma fiável no Edge Runtime do Next.js em produção.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/') ||
    pathname === '/auth/signout'
  ) {
    return NextResponse.next();
  }

  if (foodProduct) {
    if (pathname === '/register') {
      return NextResponse.redirect(buildRedirectUrl(request, '/login'));
    }
    if (pathname === '/food' || pathname.startsWith('/food/')) {
      return NextResponse.redirect(buildRedirectUrl(request, toPublicFoodPath(pathname)));
    }

    const allowedRoots = [
      '/ambientes', '/gestao', '/caixa', '/cozinha', '/delivery', '/entregador',
      '/crm', '/menu', '/configuracoes', '/ajuda', '/pedidos', '/novo-pedido',
      '/login', '/forgot-password', '/reset-password', '/change-password',
      '/auth', '/termos', '/privacidade', '/manutencao',
    ];
    const allowed = pathname === '/' || allowedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
    if (!allowed) {
      return NextResponse.redirect(buildRedirectUrl(request, '/'));
    }
  }

  if (growthProduct) {
    if (pathname === '/register') return NextResponse.redirect(buildRedirectUrl(request, '/login'));
    if (pathname === '/growth' || pathname.startsWith('/growth/')) {
      const publicPath = pathname === '/growth' ? '/' : pathname.slice('/growth'.length);
      return NextResponse.redirect(buildRedirectUrl(request, publicPath));
    }
    const allowedRoots = ['/clientes', '/sala', '/login', '/forgot-password', '/reset-password', '/change-password', '/auth', '/termos', '/privacidade', '/manutencao'];
    const allowed = pathname === '/' || allowedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
    if (!allowed) return NextResponse.redirect(buildRedirectUrl(request, '/'));
  }

  if (isServerDevAuthBypassEnabled()) {
    if (pathname === '/login') {
      return NextResponse.redirect(buildRedirectUrl(request, '/'));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(DEV_AUTH_HEADER, DEV_AUTH_TOKEN);
    requestHeaders.set('x-kukugest-dev-user-id', DEV_AUTH_USER.id);
    requestHeaders.set('x-kukugest-dev-org-id', DEV_AUTH_USER.orgId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  let response = NextResponse.next({ request });
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

  // Redirect authenticated users away from /login and /register
  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(buildRedirectUrl(request, '/'));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/signout).*)',
  ],
};
