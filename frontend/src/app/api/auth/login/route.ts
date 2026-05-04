import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseEnv } from '@/lib/supabase/env';
import {
  AUTH_FETCH_TIMEOUT_MS,
  AUTH_RETRY_DELAY_MS,
  createJsonError,
  delay,
  fetchWithTimeout,
  getConfiguredApiUrl,
  makeAuthRequestId,
  mapFetchErrorToLoginCode,
  readJsonSafely,
} from '@/lib/server-auth-utils';
import type { LoginErrorCode } from '@/lib/auth-error-codes';

function jsonWithHeaders(
  body: Record<string, unknown>,
  init: {
    status: number;
    headers?: HeadersInit;
  },
  cookieOperations: Array<{ name: string; value: string; options: Record<string, unknown> }> = []
) {
  const response = NextResponse.json(body, init);

  for (const operation of cookieOperations) {
    response.cookies.set({
      name: operation.name,
      value: operation.value,
      ...(operation.options as object),
    });
  }

  return response;
}

export async function POST(req: NextRequest) {
  const requestId = makeAuthRequestId('login');
  // Extract identifier (IP address)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

  // Apply rate limit: 5 attempts per minute per IP
  const { success, headers, reset } = await checkRateLimit(ip, 'login');

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Demasiadas tentativas. Tente novamente em breve.',
        message: 'Demasiadas tentativas. Tente novamente em breve.',
        code: 'LOGIN_BACKEND_UNAVAILABLE',
        requestId,
        retryAfter,
      },
      { status: 429, headers }
    );
  }

  const env = getSupabaseEnv();
  if (!env) {
    return createJsonError(
      'LOGIN_CONFIG_ERROR',
      'A configuração de autenticação não está disponível neste ambiente.',
      500,
      requestId
    );
  }

  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    return createJsonError(
      'LOGIN_CONFIG_ERROR',
      'O frontend não tem NEXT_PUBLIC_API_URL configurado corretamente.',
      500,
      requestId,
      { missing: 'NEXT_PUBLIC_API_URL' }
    );
  }

  try {
    const { email, password } = await req.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return createJsonError(
        'LOGIN_INVALID_CREDENTIALS',
        'Email e password são obrigatórios.',
        400,
        requestId
      );
    }

    const cookieOperations: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const supabase = createServerClient(
      env.url,
      env.anonKey,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieOperations.push({ name, value, options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieOperations.push({ name, value: '', options: { ...options, maxAge: 0 } });
          },
        },
      }
    );

    let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      signInResult = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    } catch (error) {
      const code = mapFetchErrorToLoginCode(error);
      return createJsonError(
        code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_AUTH_PROVIDER_UNAVAILABLE',
        'O serviço de autenticação está temporariamente indisponível.',
        code === 'LOGIN_TIMEOUT' ? 504 : 503,
        requestId,
        { provider: 'supabase', reason: code }
      );
    }

    const { data, error } = signInResult;

    if (error) {
      const message = error.message === 'Invalid login credentials'
        ? 'Email ou password incorretos'
        : error.message;
      const code: LoginErrorCode = error.message === 'Invalid login credentials'
        ? 'LOGIN_INVALID_CREDENTIALS'
        : 'LOGIN_AUTH_PROVIDER_UNAVAILABLE';

      return createJsonError(
        code,
        message,
        error.status || 401,
        requestId,
        { provider: 'supabase', status: error.status }
      );
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return createJsonError(
        'LOGIN_AUTH_PROVIDER_UNAVAILABLE',
        'Sessão criada sem access token. Tente novamente.',
        500,
        requestId,
        { provider: 'supabase' },
        cookieOperations
      );
    }

    let backendRes: Response | null = null;
    let lastBackendError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        backendRes = await fetchWithTimeout(`${apiUrl}/api/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }, AUTH_FETCH_TIMEOUT_MS);
        break;
      } catch (error) {
        lastBackendError = error;
        if (attempt < 2) {
          await delay(AUTH_RETRY_DELAY_MS);
        }
      }
    }

    if (!backendRes) {
      const code = mapFetchErrorToLoginCode(lastBackendError);
      return createJsonError(
        code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_SESSION_CREATED_BUT_PROFILE_FAILED',
        'Sessão criada, mas não foi possível carregar a conta.',
        code === 'LOGIN_TIMEOUT' ? 504 : 503,
        requestId,
        { backendHost: new URL(apiUrl).host, reason: code },
        cookieOperations
      );
    }

    let backendData: any = null;
    backendData = await readJsonSafely(backendRes);

    if (!backendRes.ok) {
      const errorMessage =
        backendData?.error ||
        (backendRes.status === 401
          ? 'Sessão Supabase criada, mas o backend rejeitou a autenticação.'
          : backendRes.status === 403
            ? 'Sessão Supabase criada, mas o utilizador não está autorizado no backend.'
            : 'Não foi possível validar o utilizador no backend.');

      const code: LoginErrorCode = backendRes.status === 401 || backendRes.status === 403
        ? 'LOGIN_PROFILE_LOAD_FAILED'
        : 'LOGIN_SESSION_CREATED_BUT_PROFILE_FAILED';

      return createJsonError(
        code,
        errorMessage,
        backendRes.status,
        requestId,
        { backendStatus: backendRes.status, backendHost: new URL(apiUrl).host },
        cookieOperations
      );
    }

    try {
      await fetch(`${apiUrl}/api/auth/log-login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      // Non-blocking: login should still succeed even if audit logging fails.
    }

    return jsonWithHeaders(
      {
        user: backendData,
        mustChangePassword: Boolean(backendData?.mustChangePassword),
        code: 'LOGIN_OK',
        requestId,
      },
      { status: 200, headers },
      cookieOperations
    );
  } catch (error) {
    console.error('[api/auth/login] error:', {
      requestId,
      message: error instanceof Error ? error.message : 'unknown',
      name: error instanceof Error ? error.name : 'unknown',
    });
    const code = mapFetchErrorToLoginCode(error);
    return createJsonError(
      code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_BACKEND_UNAVAILABLE',
      'Serviço temporariamente indisponível.',
      code === 'LOGIN_TIMEOUT' ? 504 : 503,
      requestId
    );
  }
}
