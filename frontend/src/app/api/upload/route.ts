import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, type UploadFolder } from '@/lib/storage';

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
    const result = await uploadFile(file, folder);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json(
      { error: 'Erro interno ao fazer upload' },
      { status: 500 }
    );
  }
}
