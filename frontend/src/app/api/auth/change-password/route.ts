import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_FETCH_TIMEOUT_MS,
  applyCookieOperations,
  createJsonError,
  createSupabaseServerClientForRequest,
  fetchWithTimeout,
  getConfiguredApiUrl,
  makeAuthRequestId,
  mapFetchErrorToLoginCode,
  readJsonSafely,
} from '@/lib/server-auth-utils';
import { isServerDevAuthBypassEnabled } from '@/lib/dev-auth';

export async function POST(req: NextRequest) {
  const requestId = makeAuthRequestId('change-password');

  if (isServerDevAuthBypassEnabled()) {
    return NextResponse.json(
      { error: 'Modo DEV com auth desactivado não permite alteração de password.' },
      { status: 403 }
    );
  }

  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    return createJsonError('LOGIN_CONFIG_ERROR', 'Backend não configurado.', 500, requestId);
  }

  const { supabase, cookieOperations } = createSupabaseServerClientForRequest(req);
  if (!supabase) {
    return createJsonError('LOGIN_CONFIG_ERROR', 'Configuração de autenticação indisponível.', 500, requestId);
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return createJsonError(
      'LOGIN_UNAUTHENTICATED',
      'Sessão expirada. Inicie sessão novamente.',
      401,
      requestId,
      undefined,
      cookieOperations
    );
  }

  const body = await req.json().catch(() => ({}));

  let backendRes: Response | null = null;
  try {
    backendRes = await fetchWithTimeout(
      `${apiUrl}/api/auth/change-password`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      AUTH_FETCH_TIMEOUT_MS
    );
  } catch (error) {
    const code = mapFetchErrorToLoginCode(error);
    return createJsonError(
      code === 'LOGIN_TIMEOUT' ? 'LOGIN_TIMEOUT' : 'LOGIN_BACKEND_UNAVAILABLE',
      'Não foi possível alterar a password.',
      code === 'LOGIN_TIMEOUT' ? 504 : 503,
      requestId,
      {},
      cookieOperations
    );
  }

  const payload = await readJsonSafely(backendRes);

  if (!backendRes.ok) {
    const message = payload?.error || payload?.message || 'Erro ao alterar a password.';
    return applyCookieOperations(
      NextResponse.json({ error: message }, { status: backendRes.status }),
      cookieOperations
    );
  }

  return applyCookieOperations(NextResponse.json(payload, { status: 200 }), cookieOperations);
}
