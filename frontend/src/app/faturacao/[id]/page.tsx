'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getFactura, getFaturacaoConfig } from '@/lib/api';
import type { IBANEntry } from '@/lib/types';
import { FacturaDetail } from '@/components/faturacao/factura-detail';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function FacturaDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: factura, isLoading } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => getFactura(id),
    enabled: !!id,
  });

  const { data: config } = useQuery({
    queryKey: ['faturacao-config'],
    queryFn: getFaturacaoConfig,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">A carregar...</div>
  );
  if (!factura) return (
    <div className="flex items-center justify-center py-20 text-gray-400">Factura não encontrada</div>
  );

  let ibans: IBANEntry[] = [];
  if (config?.iban) {
    try {
      ibans = JSON.parse(config.iban);
    } catch {
      ibans = config.iban ? [{ label: 'Principal', iban: config.iban }] : [];
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/finances?tab=facturas" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0A2540]">
        <ChevronLeft className="h-4 w-4" />
        Voltar às faturas
      </Link>
      <FacturaDetail factura={factura} isMock={config?.agtMockMode} ibans={ibans} />
    </div>
  );
}
