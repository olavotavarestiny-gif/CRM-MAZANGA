import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseEnv } from '@/lib/supabase/env';

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
  // Extract identifier (IP address)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

  // Apply rate limit: 5 attempts per minute per IP
  const { success, headers, reset } = await checkRateLimit(ip, 'login');

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Tente novamente em breve.', retryAfter },
      { status: 429, headers }
    );
  }

  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json(
      { error: 'A configuração de autenticação não está disponível neste ambiente.' },
      { status: 500, headers }
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    return NextResponse.json(
      { error: 'O frontend não tem NEXT_PUBLIC_API_URL configurado.' },
      { status: 500, headers }
    );
  }

  try {
    const { email, password } = await req.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json(
        { error: 'Email e password são obrigatórios.' },
        { status: 400, headers }
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const message = error.message === 'Invalid login credentials'
        ? 'Email ou password incorretos'
        : error.message;

      return NextResponse.json(
        { error: message },
        { status: error.status || 401, headers }
      );
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Sessão criada sem access token. Tente novamente.' },
        { status: 500, headers }
      );
    }

    const backendRes = await fetch(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    let backendData: any = null;
    try {
      backendData = await backendRes.json();
    } catch {
      backendData = null;
    }

    if (!backendRes.ok) {
      const errorMessage =
        backendData?.error ||
        (backendRes.status === 401
          ? 'Sessão Supabase criada, mas o backend rejeitou a autenticação.'
          : backendRes.status === 403
            ? 'Sessão Supabase criada, mas o utilizador não está autorizado no backend.'
            : 'Não foi possível validar o utilizador no backend.');

      return NextResponse.json(
        { error: errorMessage },
        { status: backendRes.status, headers }
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
      },
      { status: 200, headers },
      cookieOperations
    );
  } catch (error) {
    console.error('[api/auth/login] error:', error);
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível.' },
      { status: 503, headers }
    );
  }
}
