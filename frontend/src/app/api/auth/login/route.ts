import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

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

  // Proxy to Express backend
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  try {
    const body = await req.text();
    const backendRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status, headers });
  } catch {
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível.' },
      { status: 503, headers }
    );
  }
}
