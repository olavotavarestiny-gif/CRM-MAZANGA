'use client';

import { useState } from 'react';
import { Copy, Check, Code2, Zap, Eye } from 'lucide-react';

interface EmbedCodePanelProps {
  formId: string;
}

export function EmbedCodePanel({ formId }: EmbedCodePanelProps) {
  const [copiedKey, setCopiedKey] = useState<'iframe' | 'script' | null>(null);

  const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const embedUrl = `${origin}/f/${formId}?embed=1`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  scrolling="no"
  style="border:none; width:100%;"
  title="Formulário"
></iframe>`;

  const scriptSnippet = `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.style.cssText = 'width:100%;border:none;display:block;';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.title = 'Formulário';
  document.currentScript.parentNode.insertBefore(iframe, document.currentScript);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'kukugest:resize' && e.source === iframe.contentWindow) {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
</script>`;

  const handleCopy = async (key: 'iframe' | 'script', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-[#0A2540]">Incorporar Formulário</h3>
        <p className="mt-1 text-sm text-[#6b7e9a]">
          Cole um dos snippets abaixo na sua landing page ou site externo para incorporar este formulário.
        </p>
      </div>

      {/* iFrame simples */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2540]/8">
              <Code2 className="w-4 h-4 text-[#0A2540]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0A2540]">iFrame simples</p>
              <p className="text-xs text-[#6b7e9a]">Altura fixa (600 px por defeito). Funciona em qualquer página HTML.</p>
            </div>
          </div>
          <button
            onClick={() => handleCopy('iframe', iframeSnippet)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all"
            style={{
              background: copiedKey === 'iframe'
                ? '#8B5CF6'
                : 'linear-gradient(135deg, #FF6B35, #FF3D00)',
            }}
          >
            {copiedKey === 'iframe'
              ? <><Check className="w-3.5 h-3.5" /> Copiado!</>
              : <><Copy className="w-3.5 h-3.5" /> Copiar código</>
            }
          </button>
        </div>
        <pre className="rounded-lg bg-[#0A2540] border border-slate-200 p-4 text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap break-all">
          {iframeSnippet}
        </pre>
      </div>

      {/* Script embed com auto-resize */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <Zap className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0A2540] flex items-center gap-2">
                Script embed
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700">
                  Auto-resize
                </span>
              </p>
              <p className="text-xs text-[#6b7e9a]">Ajusta a altura do iframe automaticamente. Recomendado.</p>
            </div>
          </div>
          <button
            onClick={() => handleCopy('script', scriptSnippet)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all"
            style={{
              background: copiedKey === 'script'
                ? '#8B5CF6'
                : 'linear-gradient(135deg, #FF6B35, #FF3D00)',
            }}
          >
            {copiedKey === 'script'
              ? <><Check className="w-3.5 h-3.5" /> Copiado!</>
              : <><Copy className="w-3.5 h-3.5" /> Copiar código</>
            }
          </button>
        </div>
        <pre className="rounded-lg bg-[#0A2540] border border-slate-200 p-4 text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap break-all">
          {scriptSnippet}
        </pre>
      </div>

      {/* Pré-visualização */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#6b7e9a]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7e9a]">Pré-visualização</p>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-200" style={{ height: 420 }}>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            title="Pré-visualização do formulário"
            scrolling="no"
            style={{ border: 'none' }}
          />
        </div>
        <p className="text-center text-xs text-[#6b7e9a]">
          Esta é uma pré-visualização em tempo real do formulário incorporado.
        </p>
      </div>
    </div>
  );
}
