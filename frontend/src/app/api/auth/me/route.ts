import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_FETCH_TIMEOUT_MS,
  AUTH_RETRY_DELAY_MS,
  applyCookieOperations,
  createJsonError,
  createSupabaseServerClientForRequest,
  delay,
  fetchWithTimeout,
  getConfiguredApiUrl,
  makeAuthRequestId,
  mapFetchErrorToLoginCode,
  readJsonSafely,
} from '@/lib/server-auth-utils';
import { DEV_AUTH_USER, isServerDevAuthBypassEnabled } from '@/lib/dev-auth';

export async function GET(req: NextRequest) {
  const requestId = makeAuthRequestId('me');

  if (isServerDevAuthBypassEnabled()) {
    return NextResponse.json(DEV_AUTH_USER, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-KukuGest-Dev-Auth': 'true',
      },
    });
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

  const { supabase, cookieOperations } = createSupabaseServerClientForRequest(req);

  if (!supabase) {
    return createJsonError(
      'LOGIN_CONFIG_ERROR',
      'A configuração de autenticação não está disponível neste ambiente.',
      500,
      requestId
    );
  }

  let accessToken: string | undefined;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  } catch (error) {
    const code = mapFetchErrorToLoginCode(error);
    return createJsonError(
      code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_AUTH_PROVIDER_UNAVAILABLE',
      'Não foi possível validar a sessão atual.',
      code === 'LOGIN_TIMEOUT' ? 504 : 503,
      requestId,
      { provider: 'supabase', reason: code },
      cookieOperations
    );
  }

  if (!accessToken) {
    return createJsonError(
      'LOGIN_UNAUTHENTICATED',
      'Sessão expirada. Inicie sessão novamente.',
      401,
      requestId,
      undefined,
      cookieOperations
    );
  }

  let backendRes: Response | null = null;
  let lastBackendError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      backendRes = await fetchWithTimeout(`${apiUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }, AUTH_FETCH_TIMEOUT_MS);

      // Retry on 502/503 (Render cold start returning gateway errors)
      if ((backendRes.status === 502 || backendRes.status === 503) && attempt < 3) {
        backendRes = null;
        await delay(AUTH_RETRY_DELAY_MS * 4);
        continue;
      }

      break;
    } catch (error) {
      lastBackendError = error;
      if (attempt < 3) {
        await delay(AUTH_RETRY_DELAY_MS);
      }
    }
  }

  if (!backendRes) {
    const code = mapFetchErrorToLoginCode(lastBackendError);
    return createJsonError(
      code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_BACKEND_UNAVAILABLE',
      'Não foi possível carregar a conta. O servidor pode estar a iniciar.',
      code === 'LOGIN_TIMEOUT' ? 504 : 503,
      requestId,
      { backendHost: new URL(apiUrl).host, reason: code },
      cookieOperations
    );
  }

  const payload = await readJsonSafely(backendRes);

  if (!backendRes.ok) {
    const message = payload?.error || payload?.message || 'Não foi possível carregar a conta.';
    const code =
      backendRes.status === 401 || backendRes.status === 403
        ? 'LOGIN_UNAUTHENTICATED'
        : backendRes.status === 502 || backendRes.status === 503
          ? 'LOGIN_BACKEND_UNAVAILABLE'
          : 'LOGIN_PROFILE_LOAD_FAILED';

    return createJsonError(
      code,
      message,
      backendRes.status,
      requestId,
      { backendStatus: backendRes.status, backendHost: new URL(apiUrl).host },
      cookieOperations
    );
  }

  return applyCookieOperations(NextResponse.json(payload, { status: 200 }), cookieOperations);
}
