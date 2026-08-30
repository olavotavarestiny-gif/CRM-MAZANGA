'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamFoodEvents } from '@/lib/api';
import type { FoodOrderEvent } from '@/lib/types';

const INVALIDATED_QUERY_KEYS = [
  'food-v1-orders',
  'food-kitchen-tickets',
  'food-deliveries',
  'food-courier-deliveries',
  'food-management-overview',
  'food-cash-session',
] as const;

export function useFoodRealtime(enabled = true, onEvent?: (event: FoodOrderEvent) => void) {
  const queryClient = useQueryClient();
  const cursorRef = useRef<string>();
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        await streamFoodEvents({
          cursor: cursorRef.current,
          signal: controller.signal,
          onEvent: (event) => {
            cursorRef.current = `${event.occurredAt}|${event.id}`;
            onEventRef.current?.(event);
            for (const queryKey of INVALIDATED_QUERY_KEYS) {
              queryClient.invalidateQueries({ queryKey: [queryKey] });
            }
          },
        });
      } catch {
        if (controller.signal.aborted || stopped) return;
      }
      if (!stopped) retryTimer = setTimeout(connect, 3_000);
    };

    void connect();
    return () => {
      stopped = true;
      if (controller && !controller.signal.aborted) {
        controller.abort(new DOMException('Ligação Food encerrada pela navegação.', 'AbortError'));
      }
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, queryClient]);
}
