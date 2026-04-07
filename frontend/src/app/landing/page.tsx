import Link from 'next/link';
import KukuGestLogo from '@/components/KukuGestLogo';
import PricingSection from '@/components/landing/PricingSection';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f9]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-6">
        <Link href="/landing" className="inline-flex items-center">
          <KukuGestLogo height={36} />
        </Link>

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <a href="#pricing">Ver planos</a>
          </Button>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-4 pt-6 md:px-6 md:pb-8 md:pt-10">
        <div className="overflow-hidden rounded-[32px] border border-[#dde3ec] bg-white px-6 py-10 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] md:px-10 md:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6b7e9a]">KukuGest</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#0A2540] md:text-6xl">
              Um pricing simples para vender melhor, atender melhor e crescer com controlo.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5b6b7f] md:text-lg">
              Escolha entre Serviços e Comércio, compare os planos lado a lado e fale com a equipa para ativar o setup certo para o seu negócio.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#pricing">Escolher plano</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Entrar no CRM</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div id="pricing">
        <PricingSection initialWorkspaceMode="servicos" allowWorkspaceToggle source="landing" />
      </div>
    </div>
  );
}
