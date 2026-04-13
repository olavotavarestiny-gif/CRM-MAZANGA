import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next');
  const type = searchParams.get('type') as EmailOtpType | null;
  const env = getSupabaseEnv();

  if (type === 'recovery' || next === '/reset-password') {
    const redirectUrl = new URL('/reset-password', origin);

    for (const key of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description']) {
      const value = searchParams.get(key);
      if (value) {
        redirectUrl.searchParams.set(key, value);
      }
    }

    return NextResponse.redirect(redirectUrl);
  }

  const safeNext = next && next.startsWith('/') ? next : '/';
  const redirectUrl = new URL(safeNext, origin);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');

  for (const key of ['error', 'error_code', 'error_description']) {
    const value = searchParams.get(key);
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(redirectUrl);
  }

  if (!env) {
    redirectUrl.searchParams.set('error', 'supabase_env_missing');
    redirectUrl.searchParams.set('error_description', 'A configuração de autenticação não está disponível neste ambiente.');
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  const cookieStore = cookies();
  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set(name, value, options);
        },
        remove(name, options) {
          response.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  let error = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    error = result.error;
  }

  if (error) {
    redirectUrl.searchParams.set('error', error.name || 'auth_callback_failed');
    redirectUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
