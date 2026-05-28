import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, getConfiguredApiUrl } from '@/lib/server-auth-utils';

export const dynamic = 'force-dynamic';

const WARMUP_TIMEOUT_MS = 8_000;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    return NextResponse.json(
      { ok: false, error: 'NEXT_PUBLIC_API_URL inválido ou ausente' },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      `${apiUrl}/api/ready`,
      {
        method: 'GET',
        cache: 'no-store',
      },
      WARMUP_TIMEOUT_MS
    );
    const payload = await response.json().catch(() => null);

    return NextResponse.json(
      {
        ok: response.ok,
        backendStatus: response.status,
        durationMs: Date.now() - startedAt,
        backend: payload,
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.name : 'WARMUP_FAILED',
        durationMs: Date.now() - startedAt,
      },
      { status: 504 }
    );
  }
}
