'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/lib/growth-api';

export default function GrowthHomePage() {
  const router = useRouter();
  const query = useQuery({ queryKey: ['growth-bootstrap'], queryFn: growthApi.bootstrap });
  useEffect(() => {
    if (query.data) router.replace(query.data.role === 'mazanga_admin' ? '/clientes' : '/sala');
  }, [query.data, router]);
  return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><p className="text-sm text-white/40">A abrir a tua sala…</p></div>;
}
