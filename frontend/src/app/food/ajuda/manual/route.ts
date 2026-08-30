import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FILE_NAME = 'kukugest-food-manual-v1.pdf';

export async function GET() {
  const root = path.resolve(process.cwd(), '..');
  const filePath = path.join(root, 'output', 'pdf', FILE_NAME);

  try {
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${FILE_NAME}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Manual ainda não foi gerado. Execute npm run guide:food:pdf.' },
      { status: 404 },
    );
  }
}
