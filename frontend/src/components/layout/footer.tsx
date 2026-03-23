import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-4 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
        <span>© 2026 KukuGest · Mazanga Marketing Lda · NIF 5001636863</span>
        <div className="flex gap-4">
          <Link href="/termos" className="hover:text-[#0A2540] transition-colors">Termos</Link>
          <Link href="/privacidade" className="hover:text-[#0A2540] transition-colors">Privacidade</Link>
          <a href="mailto:suporte@mazanga.digital" className="hover:text-[#0A2540] transition-colors">Suporte</a>
        </div>
      </div>
    </footer>
  );
}
