'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, FileText, Loader2, Pencil, Trash2, UserPlus2 } from 'lucide-react';
import { getEntityHistory } from '@/lib/api';
import type { ActivityLogEntry } from '@/lib/types';
import { formatActivityDetail, formatActivityMessage, formatRelativeTime } from '@/lib/activity-log';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

const PAGE_SIZE = 20;

function TimelineIcon({ entry }: { entry: ActivityLogEntry }) {
  if (entry.action === 'created') return <UserPlus2 className="h-4 w-4" />;
  if (entry.action === 'deleted') return <Trash2 className="h-4 w-4" />;
  if (entry.action === 'status_changed') return <CheckCircle2 className="h-4 w-4" />;
  if (entry.entity_type === 'invoice') return <FileText className="h-4 w-4" />;
  return <Pencil className="h-4 w-4" />;
}

export function ContactHistoryTimeline({ contactId }: { contactId: number }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [lastLoadedPage, setLastLoadedPage] = useState(0);

  useEffect(() => {
    setPage(1);
    setItems([]);
    setLastLoadedPage(0);
  }, [contactId]);

  useEffect(() => {
    if (!sectionRef.current || isVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px' }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  const historyQuery = useQuery({
    queryKey: ['contact-activity-history', contactId, page],
    queryFn: () => getEntityHistory('contact', contactId, { page, pageSize: PAGE_SIZE }),
    enabled: isVisible,
    retry: false,
  });

  useEffect(() => {
    const response = historyQuery.data;
    if (!response || page === lastLoadedPage) return;

    setItems((current) => {
      const incoming = response.data.filter(
        (entry) => !current.some((existing) => existing.id === entry.id)
      );
      return page === 1 ? response.data : [...current, ...incoming];
    });
    setLastLoadedPage(page);
  }, [historyQuery.data, lastLoadedPage, page]);

  const totalPages = historyQuery.data?.pagination.totalPages || 1;
  const canLoadMore = page < totalPages;

  return (
    <Card ref={sectionRef}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#6b7e9a]" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isVisible ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : historyQuery.isError && items.length === 0 ? (
          <ErrorState
            title="Não foi possível carregar o histórico"
            message="Tenta novamente daqui a pouco."
            onRetry={() => historyQuery.refetch()}
            compact
          />
        ) : items.length === 0 && !historyQuery.isLoading ? (
          <EmptyState
            title="Sem histórico ainda"
            description="As mudanças deste contacto vão aparecer aqui."
            compact
          />
        ) : (
          <div className="space-y-5">
            {items.map((entry, index) => (
              <div key={entry.id} className="relative flex gap-4">
                {index !== items.length - 1 ? (
                  <span className="absolute left-[15px] top-9 h-[calc(100%+12px)] w-px bg-[#dde3ec]" aria-hidden="true" />
                ) : null}
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#dde3ec] bg-white text-[#0A2540]">
                  <TimelineIcon entry={entry} />
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <p className="text-sm font-medium text-[#0A2540]">{formatActivityMessage(entry)}</p>
                  <p className="mt-1 text-sm text-[#6b7e9a]">{formatActivityDetail(entry)}</p>
                  <p className="mt-1 text-xs text-[#8a94a6]">{formatRelativeTime(entry.created_at)}</p>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#8a94a6]">
                {items.length} de {historyQuery.data?.pagination.total || items.length} entradas
              </span>
              {canLoadMore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={historyQuery.isFetching}
                >
                  {historyQuery.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Ver mais
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
