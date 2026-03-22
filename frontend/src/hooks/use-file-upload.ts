'use client';

import { useState, useCallback } from 'react';
import type { UploadFolder, UploadResult } from '@/lib/storage';

interface UseFileUploadReturn {
  upload: (file: File, folder: UploadFolder) => Promise<UploadResult | null>;
  uploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File, folder: UploadFolder): Promise<UploadResult | null> => {
      setError(null);
      setUploading(true);
      setProgress(10);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        setProgress(30);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        setProgress(80);

        const data = await res.json() as unknown;
        const body = data as Record<string, unknown>;

        if (!res.ok) {
          const msg = typeof body.error === 'string' ? body.error : 'Erro no upload';
          throw new Error(msg);
        }

        setProgress(100);
        return data as UploadResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return { upload, uploading, progress, error, reset };
}
