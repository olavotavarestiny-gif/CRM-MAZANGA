'use client';

import { FacturaForm } from '@/components/faturacao/factura-form';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NovaFacturaPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/finances?tab=facturas" className="text-gray-500 hover:text-[#0A2540] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0A2540]">Nova Factura</h1>
      </div>
      <FacturaForm />
    </div>
  );
}
