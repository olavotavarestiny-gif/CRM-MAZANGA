'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { formatFileSize } from '@/lib/file-utils';
import type { UploadResult } from '@/lib/storage';

interface UploadDemo {
  label: string;
  result: UploadResult | null;
}

export default function TestUploadPage() {
  const [avatar, setAvatar] = useState<UploadDemo>({ label: 'Avatar', result: null });
  const [attachment, setAttachment] = useState<UploadDemo>({ label: 'Documento', result: null });
  const [invoice, setInvoice] = useState<UploadDemo>({ label: 'Fatura', result: null });

  const ResultCard = ({ demo }: { demo: UploadDemo }) => {
    if (!demo.result) return null;
    return (
      <div className="mt-3 rounded-lg bg-zinc-900 p-3 font-mono text-xs text-green-400">
        <p className="text-zinc-500 mb-1">// UploadResult</p>
        <p><span className="text-zinc-400">url:</span> <span className="break-all">{demo.result.url}</span></p>
        <p><span className="text-zinc-400">size:</span> {formatFileSize(demo.result.size)}</p>
        <p><span className="text-zinc-400">contentType:</span> {demo.result.contentType}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-zinc-900">File Upload — Teste</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Demonstração do componente <code className="bg-zinc-200 px-1 rounded">&lt;FileUpload /&gt;</code>
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {/* Avatar */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h2 className="mb-1 font-semibold text-zinc-800">Avatar</h2>
            <p className="mb-4 text-xs text-zinc-400">JPEG, PNG, WebP — máx 2 MB</p>
            <FileUpload
              folder="avatars"
              onUpload={(r) => setAvatar((p) => ({ ...p, result: r }))}
              onError={(e) => console.error('Avatar error:', e)}
            />
            <ResultCard demo={avatar} />
            {avatar.result && (
              <button
                onClick={() => setAvatar((p) => ({ ...p, result: null }))}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Attachment */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h2 className="mb-1 font-semibold text-zinc-800">Documento</h2>
            <p className="mb-4 text-xs text-zinc-400">PDF, DOCX, XLSX, imagens — máx 10 MB</p>
            <FileUpload
              folder="attachments"
              onUpload={(r) => setAttachment((p) => ({ ...p, result: r }))}
              onError={(e) => console.error('Attachment error:', e)}
            />
            <ResultCard demo={attachment} />
            {attachment.result && (
              <button
                onClick={() => setAttachment((p) => ({ ...p, result: null }))}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Invoice */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h2 className="mb-1 font-semibold text-zinc-800">Fatura</h2>
            <p className="mb-4 text-xs text-zinc-400">Apenas PDF — máx 5 MB</p>
            <FileUpload
              folder="invoices"
              onUpload={(r) => setInvoice((p) => ({ ...p, result: r }))}
              onError={(e) => console.error('Invoice error:', e)}
            />
            <ResultCard demo={invoice} />
            {invoice.result && (
              <button
                onClick={() => setInvoice((p) => ({ ...p, result: null }))}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Usage example */}
        <div className="mt-10 rounded-2xl bg-zinc-900 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Como usar</p>
          <pre className="overflow-x-auto text-sm text-zinc-300">{`import { FileUpload } from '@/components/file-upload'

<FileUpload
  folder="avatars"           // 'avatars' | 'attachments' | 'invoices'
  onUpload={(result) => {
    console.log(result.url)  // URL pública do ficheiro
  }}
  currentFileUrl={user.avatar} // opcional — mostra ficheiro existente
/>`}</pre>
        </div>
      </div>
    </div>
  );
}
