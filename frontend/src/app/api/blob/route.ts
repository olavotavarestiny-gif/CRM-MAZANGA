import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { DEV_AUTH_HEADER, DEV_AUTH_TOKEN, isServerDevAuthBypassEnabled } from '@/lib/dev-auth';

const PRIVATE_BLOB_HOSTNAME = '.private.blob.vercel-storage.com';

function isBlobUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

function isDeliveryProofUrl(url: string): boolean {
  try {
    return new URL(url).pathname.split('/').includes('food-proof');
  } catch {
    return false;
  }
}

async function hasAuthenticatedSession(request: NextRequest): Promise<boolean> {
  if (isServerDevAuthBypassEnabled() || request.headers.get(DEV_AUTH_HEADER) === DEV_AUTH_TOKEN) return true;
  if (!getSupabaseEnv()) return false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!await hasAuthenticatedSession(request)) {
    return new NextResponse('Sessão inválida', { status: 401 });
  }
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return new NextResponse('Parâmetro url em falta', { status: 400 });
  }

  if (!isBlobUrl(rawUrl)) {
    return new NextResponse('URL inválido', { status: 400 });
  }
  if (isDeliveryProofUrl(rawUrl)) {
    return new NextResponse('Use a rota protegida da entrega para consultar este ficheiro', { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new NextResponse('Storage não configurado', { status: 500 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: rawUrl.includes(PRIVATE_BLOB_HOSTNAME)
        ? { Authorization: `Bearer ${token}` }
        : {},
    });

    if (!upstream.ok) {
      return new NextResponse('Ficheiro não encontrado', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return new NextResponse('Erro ao carregar ficheiro', { status: 502 });
  }
}
