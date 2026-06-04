import { NextRequest, NextResponse } from 'next/server';
import { getConfiguredApiUrl, fetchWithTimeout, AUTH_FETCH_TIMEOUT_MS } from '@/lib/server-auth-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = getConfiguredApiUrl();

    const backendRes = await fetchWithTimeout(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, AUTH_FETCH_TIMEOUT_MS);

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[api/auth/register] error:', error);
    return NextResponse.json({ error: 'Erro ao criar conta. Tente novamente.' }, { status: 500 });
  }
}
