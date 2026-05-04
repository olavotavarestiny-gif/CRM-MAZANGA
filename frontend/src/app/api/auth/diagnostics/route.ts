import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseServerClientForRequest,
  fetchWithTimeout,
  getConfiguredApiUrl,
  makeAuthRequestId,
  readJsonSafely,
  sanitizeUrlForDiagnostics,
} from '@/lib/server-auth-utils';
import { getSupabaseEnv } from '@/lib/supabase/env';

const DIAGNOSTIC_TIMEOUT_MS = 6000;

function getRequestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host') || '';
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  return host ? `${forwardedProto}://${host}` : null;
}

async function runCheck(name: string, fn: () => Promise<Record<string, unknown>>) {
  try {
    return { name, ok: true, ...(await fn()) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    const code = error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'FAILED';
    return { name, ok: false, code, message };
  }
}

export async function GET(req: NextRequest) {
  const requestId = makeAuthRequestId('diag');
  const apiUrl = getConfiguredApiUrl();
  const supabaseEnv = getSupabaseEnv();
  const appOrigin = getRequestOrigin(req);
  const { supabase } = createSupabaseServerClientForRequest(req);

  let accessToken: string | undefined;
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    } catch {
      accessToken = undefined;
    }
  }

  const checks: Array<Record<string, unknown> & { ok?: unknown }> = [];

  checks.push({
    name: 'frontend',
    ok: true,
    code: 'FRONTEND_LOADED',
    origin: appOrigin,
  });

  checks.push(await runCheck('backendHealth', async () => {
    if (!apiUrl) return { ok: false, code: 'NEXT_PUBLIC_API_URL_INVALID' };
    const response = await fetchWithTimeout(`${apiUrl}/api/health`, { cache: 'no-store' }, DIAGNOSTIC_TIMEOUT_MS);
    return { status: response.status, code: response.ok ? 'BACKEND_HEALTH_OK' : 'BACKEND_HEALTH_FAILED' };
  }));

  checks.push(await runCheck('backendAuthDiagnostics', async () => {
    if (!apiUrl) return { ok: false, code: 'NEXT_PUBLIC_API_URL_INVALID' };
    const response = await fetchWithTimeout(`${apiUrl}/api/auth/diagnostics`, {
      cache: 'no-store',
      headers: appOrigin ? { Origin: appOrigin } : undefined,
    }, DIAGNOSTIC_TIMEOUT_MS);
    const payload = await readJsonSafely(response);
    const backendOk = response.ok && payload?.ok !== false;
    return {
      status: response.status,
      ok: backendOk,
      code: backendOk ? 'BACKEND_AUTH_DIAGNOSTICS_OK' : 'BACKEND_AUTH_DIAGNOSTICS_FAILED',
      payload,
    };
  }));

  checks.push(await runCheck('supabaseAuthProvider', async () => {
    if (!supabaseEnv) return { ok: false, code: 'SUPABASE_ENV_MISSING' };
    const response = await fetchWithTimeout(`${supabaseEnv.url}/auth/v1/health`, {
      cache: 'no-store',
    }, DIAGNOSTIC_TIMEOUT_MS);

    return {
      status: response.status,
      code: response.status < 500 ? 'SUPABASE_REACHABLE' : 'SUPABASE_UNAVAILABLE',
    };
  }));

  checks.push(await runCheck('profile', async () => {
    if (!apiUrl) return { ok: false, code: 'NEXT_PUBLIC_API_URL_INVALID' };
    if (!accessToken) return { ok: true, code: 'PROFILE_SKIPPED_NO_SESSION' };
    const response = await fetchWithTimeout(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }, DIAGNOSTIC_TIMEOUT_MS);
    const payload = await readJsonSafely(response);
    return {
      status: response.status,
      code: response.ok ? 'PROFILE_OK' : 'PROFILE_FAILED',
      detail: response.ok ? undefined : { error: payload?.error || payload?.message || null },
    };
  }));

  const ok = checks.every((check) => Boolean(check.ok));

  return NextResponse.json({
    ok,
    code: ok ? 'LOGIN_DIAGNOSTICS_OK' : 'LOGIN_DIAGNOSTICS_DEGRADED',
    requestId,
    timestamp: new Date().toISOString(),
    config: {
      api: sanitizeUrlForDiagnostics(apiUrl),
      supabase: sanitizeUrlForDiagnostics(supabaseEnv?.url || null),
      hasSession: Boolean(accessToken),
    },
    checks,
  }, { status: 200 });
}
