'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardWidget, DEFAULT_WIDGETS } from './types';

const STORAGE_PREFIX = 'dashboard_config_v2';

export function useDashboardConfig(scopeKey?: string | number | null) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loaded, setLoaded] = useState(false);
  const storageKey = scopeKey ? `${STORAGE_PREFIX}:${scopeKey}` : null;

  useEffect(() => {
    if (!storageKey) {
      setWidgets([]);
      setLoaded(false);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setWidgets(JSON.parse(raw));
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }
    setLoaded(true);
  }, [storageKey]);

  const save = useCallback((next: DashboardWidget[]) => {
    setWidgets(next);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }, [storageKey]);

  const addWidget = (w: DashboardWidget) => save([...widgets, w]);
  const removeWidget = (id: string) => save(widgets.filter((w) => w.id !== id));
  const updateWidget = (id: string, patch: Partial<DashboardWidget>) =>
    save(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const reorder = (newOrder: DashboardWidget[]) => save(newOrder);
  const reset = () => save(DEFAULT_WIDGETS);

  return { widgets, loaded, addWidget, removeWidget, updateWidget, reorder, reset };
}
