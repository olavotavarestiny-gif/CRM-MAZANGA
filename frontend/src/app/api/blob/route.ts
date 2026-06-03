import { NextRequest, NextResponse } from 'next/server';

const PRIVATE_BLOB_HOSTNAME = '.private.blob.vercel-storage.com';

function isBlobUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return new NextResponse('Parâmetro url em falta', { status: 400 });
  }

  if (!isBlobUrl(rawUrl)) {
    return new NextResponse('URL inválido', { status: 400 });
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
