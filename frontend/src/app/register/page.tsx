'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestLoginLogo } from '@/components/KukuGestLogo';
import { REGISTER_PRICING, formatKz, type RegisterPlanKey } from '@/lib/plan-utils';

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<RegisterPlanKey>('profissional');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, plan: selectedPlan }),
      });

      const registerData = await registerRes.json().catch(() => ({}));

      if (!registerRes.ok) {
        setError(registerData?.error || 'Erro ao criar conta. Tente novamente.');
        setStep(1);
        return;
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        window.location.assign('/login?registered=1');
        return;
      }

      const loginData = await loginRes.json().catch(() => ({}));
      window.location.assign(loginData?.mustChangePassword ? '/change-password' : '/?new=1');
    } catch {
      setError('Erro de ligação. Verifique a sua conexão e tente novamente.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundGradientAnimation
      containerClassName="min-h-screen"
      interactive={false}
      size="110%"
      blendingValue="soft-light"
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(140,169,255,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(114,141,229,0.22),transparent_24%),linear-gradient(180deg,rgba(6,16,36,0.08),rgba(6,16,36,0.38))]" />

      <div className="absolute inset-0 z-10 flex items-center justify-center px-4 py-10 sm:px-6">

        {/* ── STEP 1: Informação ── */}
        {step === 1 && (
          <div className="relative w-full max-w-[28.5rem]">
            <div className="absolute inset-x-10 -top-10 h-20 rounded-full bg-white/15 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/35 bg-[linear-gradient(180deg,rgba(181,191,205,0.42),rgba(111,124,141,0.52))] p-6 shadow-[0_30px_80px_rgba(6,16,36,0.38),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[22px] sm:p-8">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_32%,transparent_68%,rgba(255,255,255,0.08))]" />

              <div className="relative text-center">
                <KukuGestLoginLogo showTagline className="mx-auto mb-5" />
                <p className="mt-1 text-sm text-white/75 sm:text-base">14 dias grátis, sem cartão</p>
              </div>

              {error && (
                <div className="relative mt-6 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90">
                  {error}
                </div>
              )}

              <form onSubmit={handleStep1} className="relative mt-7 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">Nome completo</label>
                  <div className="group relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                    <input
                      type="text"
                      placeholder="O seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-4 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">Email</label>
                  <div className="group relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-4 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">Password</label>
                  <div className="group relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-12 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white/80"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-1 h-12 w-full rounded-[0.95rem] bg-[linear-gradient(180deg,#ff6b35,#ff3d00)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,80,0,0.30),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
                >
                  Continuar →
                </button>

                <p className="pt-1 text-center text-xs text-white/60">
                  Ao criar conta aceita os{' '}
                  <Link href="/termos" className="underline transition hover:text-white/85">termos de uso</Link>{' '}
                  e a{' '}
                  <Link href="/privacidade" className="underline transition hover:text-white/85">política de privacidade</Link>.
                </p>

                <div className="pt-1 text-center">
                  <Link href="/login" className="text-sm text-white/78 transition hover:text-white">
                    Já tem conta?{' '}
                    <span className="font-semibold text-white">Entrar</span>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP 2: Escolher plano ── */}
        {step === 2 && (
          <div className="relative w-full max-w-[58rem]">
            <div className="absolute inset-x-10 -top-10 h-20 rounded-full bg-white/15 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/35 bg-[linear-gradient(180deg,rgba(181,191,205,0.42),rgba(111,124,141,0.52))] p-6 shadow-[0_30px_80px_rgba(6,16,36,0.38),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[22px] sm:p-8">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_32%,transparent_68%,rgba(255,255,255,0.08))]" />

              {/* Header */}
              <div className="relative text-center mb-6">
                <h2 className="text-xl font-bold text-white">Escolhe o teu plano</h2>
                <p className="mt-1 text-sm text-white/70">14 dias grátis em qualquer plano, sem cartão de crédito.</p>
              </div>

              {/* Toggle mensal / anual */}
              <div className="relative flex items-center justify-center gap-1 mb-6">
                <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] p-1">
                  <button
                    type="button"
                    onClick={() => setBilling('monthly')}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${billing === 'monthly' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/80'}`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilling('annual')}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition ${billing === 'annual' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/80'}`}
                  >
                    Anual
                    <span className="rounded-full bg-[#ff6b35] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">-30%</span>
                  </button>
                </div>
                {billing === 'annual' && (
                  <p className="absolute -bottom-5 left-0 right-0 text-center text-[11px] text-white/55">Desconto de 30% no 1.º ano</p>
                )}
              </div>

              {/* Cards de planos */}
              <form onSubmit={handleRegister}>
                <div className={`relative grid gap-3 sm:grid-cols-3 ${billing === 'annual' ? 'mt-7' : 'mt-2'}`}>
                  {REGISTER_PRICING.map((tier) => {
                    const isSelected = selectedPlan === tier.key;
                    const price = billing === 'annual' ? tier.annualMonthlyPrice : tier.monthlyPrice;
                    const isHighlighted = tier.badge === 'Mais escolhido';

                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setSelectedPlan(tier.key)}
                        className={`relative flex flex-col rounded-[1.25rem] border p-5 text-left transition-all ${
                          isSelected
                            ? 'border-[#ff6b35] bg-white/[0.12] shadow-[0_0_0_2px_rgba(255,107,53,0.4)]'
                            : 'border-white/20 bg-white/[0.05] hover:border-white/35 hover:bg-white/[0.08]'
                        }`}
                      >
                        {/* Badge */}
                        {tier.badge && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#ff6b35,#ff3d00)] px-3 py-0.5 text-[11px] font-bold text-white whitespace-nowrap">
                            {tier.badge}
                          </span>
                        )}

                        {/* Seleccionado */}
                        {isSelected && (
                          <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6b35]">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </span>
                        )}

                        {/* Nome */}
                        <p className={`text-sm font-semibold ${isHighlighted ? 'text-[#ffb38a]' : 'text-white/80'}`}>
                          {tier.name}
                        </p>

                        {/* Preço */}
                        <div className="mt-2 mb-1">
                          <span className="text-2xl font-bold text-white">{formatKz(price)}</span>
                          <span className="text-xs text-white/55">/mês</span>
                        </div>
                        {billing === 'annual' && (
                          <p className="text-[11px] text-white/45 mb-2">
                            {formatKz(tier.annualTotalPrice)}/ano
                          </p>
                        )}

                        {/* Descrição */}
                        <p className="text-[12px] text-white/55 mb-4 leading-snug">{tier.description}</p>

                        {/* Features */}
                        <ul className="space-y-1.5 mt-auto">
                          {tier.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[12px] text-white/75">
                              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#ff6b35]" strokeWidth={2.5} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                {/* CTA */}
                <div className="relative mt-6 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-[0.95rem] bg-[linear-gradient(180deg,#ff6b35,#ff3d00)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,80,0,0.30),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'A criar conta...' : 'Criar conta grátis — 14 dias de trial'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex w-full items-center justify-center gap-1.5 text-sm text-white/60 transition hover:text-white/80"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </BackgroundGradientAnimation>
  );
}
