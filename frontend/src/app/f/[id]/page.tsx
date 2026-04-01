'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getForm, submitForm } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

export default function PublicFormPage({ params }: { params: { id: string } }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const pixelLoadedRef = useRef(false);
  const gtagLoadedRef  = useRef(false);

  const { data: form, isLoading } = useQuery({
    queryKey: ['publicForm', params.id],
    queryFn: () => getForm(params.id),
  });

  // Inject tracking scripts once the form config is loaded
  useEffect(() => {
    if (!form) return;

    // ── Meta Pixel ────────────────────────────────────────────────
    if (form.metaPixelEnabled && form.metaPixelId && !pixelLoadedRef.current) {
      pixelLoadedRef.current = true;
      const script = document.createElement('script');
      script.innerHTML = `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${form.metaPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    }

    // ── Google Tag ────────────────────────────────────────────────
    if (form.googleTagEnabled && form.googleTagId && !gtagLoadedRef.current) {
      gtagLoadedRef.current = true;
      const scriptSrc = document.createElement('script');
      scriptSrc.async = true;
      scriptSrc.src = `https://www.googletagmanager.com/gtag/js?id=${form.googleTagId}`;
      document.head.appendChild(scriptSrc);

      const scriptInit = document.createElement('script');
      scriptInit.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${form.googleTagId}');
      `;
      document.head.appendChild(scriptInit);
    }
  }, [form]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!form) return Promise.reject('No form');
      const answersArray = form.fields.map((field) => ({
        fieldId: field.id,
        value: answers[field.id] || '',
      }));
      return submitForm(params.id, answersArray);
    },
    onSuccess: () => {
      setSubmitted(true);
      // Conversion tracking
      if (form?.trackSubmitAsLead !== false) {
        if (form?.metaPixelEnabled && form?.metaPixelId && typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'Lead');
        }
        if (form?.googleTagEnabled && form?.googleTagId && typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'generate_lead', {
            form_id: form?.id,
            form_name: form?.title,
          });
        }
      }
      if (form?.thankYouUrl) {
        setTimeout(() => { window.location.href = form.thankYouUrl!; }, 1500);
      }
    },
  });

  // Branding
  const brandColor = form?.brandColor || '#635BFF';
  const bgColor = form?.bgColor || '#F8FAFC';
  const logoUrl = form?.logoUrl;

  // Detect if background is dark
  const isDark = (() => {
    const hex = bgColor.replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();

  const textColor = isDark ? '#FFFFFF' : '#0A2540';
  const subColor = isDark ? 'rgba(255,255,255,0.65)' : '#6b7e9a';
  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';

  const isStepByStep = form?.mode === 'step';
  const fields = form?.fields || [];
  const currentField = isStepByStep ? fields[currentStep] : null;
  const progress = isStepByStep
    ? ((currentStep + 1) / Math.max(fields.length, 1)) * 100
    : (() => {
        if (fields.length === 0) return 0;
        return (fields.filter((f) => answers[f.id]?.trim()).length / fields.length) * 100;
      })();

  function canProceed(): boolean {
    if (isStepByStep && currentField) {
      return !currentField.required || !!answers[currentField.id]?.trim();
    }
    return true;
  }

  function handleSubmit() {
    const allRequired = fields.filter((f) => f.required).every((f) => answers[f.id]?.trim());
    if (!allRequired) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    submitMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
        <p style={{ color: subColor }}>A carregar...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
        <p style={{ color: '#EF4444' }}>Formulário não encontrado</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgColor }}>
        <div className="w-full max-w-md rounded-2xl border p-8 text-center shadow-sm"
          style={{ background: cardBg, borderColor: cardBorder }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: brandColor + '22' }}>
            <Check className="w-7 h-7" style={{ color: brandColor }} />
          </div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-10 object-contain mx-auto mb-4" />}
          <h2 className="text-2xl font-bold mb-2" style={{ color: brandColor }}>Obrigado!</h2>
          <p style={{ color: subColor }}>Entraremos em contacto em breve.</p>
          {form.thankYouUrl && <p className="text-xs mt-4" style={{ color: subColor }}>A redirecionar...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgColor }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-sm overflow-hidden"
        style={{ background: cardBg, borderColor: cardBorder }}>

        {/* Header */}
        <div className="p-6 pb-4">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="max-h-12 object-contain mb-5" />
          )}
          <h1 className="text-xl font-bold" style={{ color: textColor }}>{form.title}</h1>
          {form.description && (
            <p className="text-sm mt-1" style={{ color: subColor }}>{form.description}</p>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: brandColor }}
              />
            </div>
            {isStepByStep && (
              <p className="text-xs mt-1 text-right" style={{ color: subColor }}>
                {currentStep + 1} / {fields.length}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {isStepByStep ? (
            currentField && (
              <div key={currentField.id} className="space-y-4">
                <Label className="text-base font-medium" style={{ color: textColor }}>
                  {currentField.label}
                  {currentField.required && <span className="text-red-400 ml-1">*</span>}
                </Label>

                {currentField.type === 'text' ? (
                  <input
                    className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-all"
                    style={{ background: inputBg, borderColor: cardBorder, color: textColor }}
                    onFocus={(e) => { e.target.style.borderColor = brandColor; e.target.style.boxShadow = `0 0 0 3px ${brandColor}22`; }}
                    onBlur={(e) => { e.target.style.borderColor = cardBorder; e.target.style.boxShadow = 'none'; }}
                    placeholder="Escrever resposta..."
                    value={answers[currentField.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [currentField.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceed()) {
                        currentStep < fields.length - 1 ? setCurrentStep(currentStep + 1) : handleSubmit();
                      }
                    }}
                  />
                ) : (
                  <Select value={answers[currentField.id] || ''} onValueChange={(v) => setAnswers({ ...answers, [currentField.id]: v })}>
                    <SelectTrigger style={{ background: inputBg, borderColor: cardBorder, color: textColor }}>
                      <SelectValue placeholder="Selecionar opção..." />
                    </SelectTrigger>
                    <SelectContent>
                      {currentField.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex gap-3 justify-between pt-2">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ borderColor: cardBorder, color: textColor, background: 'transparent' }}
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep(currentStep - 1)}
                  >
                    <ArrowLeft className="w-4 h-4" /> Anterior
                  </button>
                  {currentStep === fields.length - 1 ? (
                    <button
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ background: brandColor }}
                      disabled={submitMutation.isPending || !canProceed()}
                      onClick={handleSubmit}
                    >
                      {submitMutation.isPending ? 'A enviar...' : 'Enviar'} <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ background: brandColor }}
                      disabled={!canProceed()}
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Próximo <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-5">
              {fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label className="font-medium" style={{ color: textColor }}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  {field.type === 'text' ? (
                    <input
                      className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-all"
                      style={{ background: inputBg, borderColor: cardBorder, color: textColor }}
                      onFocus={(e) => { e.target.style.borderColor = brandColor; e.target.style.boxShadow = `0 0 0 3px ${brandColor}22`; }}
                      onBlur={(e) => { e.target.style.borderColor = cardBorder; e.target.style.boxShadow = 'none'; }}
                      placeholder="Escrever resposta..."
                      value={answers[field.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    />
                  ) : (
                    <Select value={answers[field.id] || ''} onValueChange={(v) => setAnswers({ ...answers, [field.id]: v })}>
                      <SelectTrigger style={{ background: inputBg, borderColor: cardBorder, color: textColor }}>
                        <SelectValue placeholder="Selecionar opção..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
              <button
                className="w-full mt-2 py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: brandColor }}
                disabled={submitMutation.isPending}
                onClick={handleSubmit}
              >
                {submitMutation.isPending ? 'A enviar...' : 'Enviar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
