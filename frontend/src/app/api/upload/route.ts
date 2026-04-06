import { NextRequest, NextResponse } from 'next/server';
import type { UploadFolder } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

const MAX_SIZES: Record<UploadFolder, number> = {
  avatars: 2 * 1024 * 1024,      // 2 MB
  attachments: 10 * 1024 * 1024,  // 10 MB
  invoices: 5 * 1024 * 1024,      // 5 MB
};

const ALLOWED_TYPES: Record<UploadFolder, readonly string[]> = {
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  attachments: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  invoices: ['application/pdf'],
};

const VALID_FOLDERS: UploadFolder[] = ['avatars', 'attachments', 'invoices'];

// Simple in-memory rate limiter: max 10 uploads per minute per IP
const uploadCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = uploadCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function getUploadErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : '';

  if (rawMessage.includes('BLOB_READ_WRITE_TOKEN')) {
    return 'Uploads não configurados no ambiente actual. Defina a variável BLOB_READ_WRITE_TOKEN no frontend.';
  }

  if (/storage não configurado/i.test(rawMessage)) {
    return 'O storage de ficheiros não está configurado no backend.';
  }

  if (/token|unauthorized|forbidden|access denied|not authorized/i.test(rawMessage)) {
    return 'A configuração do storage está inválida. Verifique o token do Vercel Blob.';
  }

  if (/network|fetch failed|timeout|econn|dns/i.test(rawMessage)) {
    return 'O serviço de ficheiros está indisponível neste momento. Tente novamente em instantes.';
  }

  if (rawMessage.trim()) {
    return rawMessage;
  }

  return 'Erro interno ao fazer upload';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiados uploads. Tente novamente em 1 minuto.' },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const file = formData.get('file');
  const folderRaw = formData.get('folder');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Campo "file" obrigatório' },
      { status: 400 }
    );
  }

  if (typeof folderRaw !== 'string' || !VALID_FOLDERS.includes(folderRaw as UploadFolder)) {
    return NextResponse.json(
      { error: `Campo "folder" inválido. Use: ${VALID_FOLDERS.join(', ')}` },
      { status: 400 }
    );
  }

  const folder = folderRaw as UploadFolder;
  const maxSize = MAX_SIZES[folder];
  const allowedTypes = ALLOWED_TYPES[folder];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  if (file.size > maxSize) {
    const mb = (maxSize / 1024 / 1024).toFixed(0);
    return NextResponse.json(
      { error: `Ficheiro demasiado grande. Máximo: ${mb} MB` },
      { status: 413 }
    );
  }

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo de ficheiro não permitido para ${folder}` },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Sessão expirada. Inicie sessão novamente.' }, { status: 401 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const backendRes = await fetch(`${apiUrl}/api/uploads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'x-upload-folder': folder,
        'x-file-name': encodeURIComponent(file.name),
        'x-file-type': file.type,
      },
      body: arrayBuffer,
    });

    const payload = await backendRes.json();
    if (!backendRes.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Erro no upload');
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json(
      { error: getUploadErrorMessage(err) },
      { status: 500 }
    );
  }
}
