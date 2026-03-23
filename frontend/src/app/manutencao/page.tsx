'use client';

import { Settings, Mail, Phone } from 'lucide-react';

export default function ManutencaoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2540] to-[#1a3a5c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl p-8 text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <span className="text-2xl font-bold text-white tracking-wide">KukuGest</span>
          </div>

          {/* Spinning icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <Settings className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Em Manutenção</h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Estamos a realizar melhorias na plataforma. O serviço estará disponível em breve.
            </p>
          </div>

          {/* ETA */}
          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Tempo estimado</p>
            <p className="text-white font-semibold">30 — 60 minutos</p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/20" />

          {/* Contact buttons */}
          <div className="space-y-3">
            <p className="text-white/60 text-sm">Precisa de ajuda urgente?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="mailto:suporte@mazanga.digital"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
              <a
                href="tel:+244923000000"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Telefone
              </a>
            </div>
          </div>

          {/* Status link */}
          <p className="text-white/40 text-xs">
            Estado do serviço:{' '}
            <a
              href="https://status.ulu.ao"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
            >
              status.ulu.ao
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          © 2026 KukuGest · Mazanga Marketing Lda
        </p>
      </div>
    </div>
  );
}
