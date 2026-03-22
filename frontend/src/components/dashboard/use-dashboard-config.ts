'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardWidget, DEFAULT_WIDGETS } from './types';

const STORAGE_KEY = 'dashboard_config_v1';

export function useDashboardConfig() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setWidgets(JSON.parse(raw));
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }
    setLoaded(true);
  }, []);

  const save = useCallback((next: DashboardWidget[]) => {
    setWidgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addWidget = (w: DashboardWidget) => save([...widgets, w]);
  const removeWidget = (id: string) => save(widgets.filter((w) => w.id !== id));
  const updateWidget = (id: string, patch: Partial<DashboardWidget>) =>
    save(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const reorder = (newOrder: DashboardWidget[]) => save(newOrder);
  const reset = () => save(DEFAULT_WIDGETS);

  return { widgets, loaded, addWidget, removeWidget, updateWidget, reorder, reset };
}
