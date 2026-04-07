'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api';

export default function ReportsEntryPage() {
  const router = useRouter();
  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!currentUserQuery.data) return;
    router.replace(
      currentUserQuery.data.workspaceMode === 'comercio'
        ? '/relatorios/comercio'
        : '/relatorios/servicos'
    );
  }, [currentUserQuery.data, router]);

  return <div className="min-h-[40vh] p-6" />;
}
