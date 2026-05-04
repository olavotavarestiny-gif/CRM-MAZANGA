import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from './supabase/env';
import type { LoginErrorCode } from './auth-error-codes';

export const AUTH_FETCH_TIMEOUT_MS = 12_000;
export const AUTH_RETRY_DELAY_MS = 650;

type CookieOperation = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export function makeAuthRequestId(prefix = 'auth') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getConfiguredApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  if (!apiUrl || !isAbsoluteHttpUrl(apiUrl)) {
    return null;
  }
  return apiUrl.replace(/\/+$/, '');
}

export function sanitizeUrlForDiagnostics(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return {
      protocol: parsed.protocol,
      host: parsed.host,
    };
  } catch {
    return null;
  }
}

export function createJsonError(
  code: LoginErrorCode,
  message: string,
  status: number,
  requestId: string,
  details?: Record<string, unknown>,
  cookieOperations: CookieOperation[] = []
) {
  const response = NextResponse.json(
    {
      error: message,
      message,
      code,
      requestId,
      details,
    },
    { status }
  );

  for (const operation of cookieOperations) {
    response.cookies.set({
      name: operation.name,
      value: operation.value,
      ...(operation.options as object),
    });
  }

  return response;
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = AUTH_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function mapFetchErrorToLoginCode(error: unknown): LoginErrorCode {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return 'LOGIN_TIMEOUT';
  }

  if (message.includes('cors')) {
    return 'LOGIN_CORS_ERROR';
  }

  return 'LOGIN_NETWORK_ERROR';
}

export async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createSupabaseServerClientForRequest(req: NextRequest) {
  const env = getSupabaseEnv();
  const cookieOperations: CookieOperation[] = [];

  if (!env) {
    return { env: null, supabase: null, cookieOperations };
  }

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

  return { env, supabase, cookieOperations };
}

export function applyCookieOperations(response: NextResponse, cookieOperations: CookieOperation[]) {
  for (const operation of cookieOperations) {
    response.cookies.set({
      name: operation.name,
      value: operation.value,
      ...(operation.options as object),
    });
  }
  return response;
}
