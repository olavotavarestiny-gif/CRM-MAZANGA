'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { formatFileSize, isImageFile } from '@/lib/file-utils';
import type { UploadFolder, UploadResult } from '@/lib/storage';

const DEFAULT_ACCEPT: Record<UploadFolder, string> = {
  avatars: 'image/jpeg,image/png,image/webp',
  attachments: 'image/*,application/pdf,application/vnd.openxmlformats-officedocument.*',
  invoices: 'application/pdf',
};

const MAX_SIZES: Record<UploadFolder, number> = {
  avatars: 2 * 1024 * 1024,
  attachments: 10 * 1024 * 1024,
  invoices: 5 * 1024 * 1024,
};

export interface FileUploadProps {
  folder: UploadFolder;
  accept?: string;
  maxSize?: number;
  onUpload: (result: UploadResult) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  currentFileUrl?: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function FileUpload({
  folder,
  accept,
  maxSize,
  onUpload,
  onError,
  disabled = false,
  currentFileUrl,
}: FileUploadProps) {
  const effectiveAccept = accept ?? DEFAULT_ACCEPT[folder];
  const effectiveMaxSize = maxSize ?? MAX_SIZES[folder];

  const [state, setState] = useState<UploadState>(currentFileUrl ? 'success' : 'idle');
  const [fileUrl, setFileUrl] = useState<string | null>(currentFileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileType, setFileType] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error: uploadError, reset: resetHook } = useFileUpload();

  const reset = useCallback(() => {
    setState('idle');
    setFileUrl(null);
    setFileName(null);
    setFileSize(null);
    setFileType('');
    setValidationError(null);
    resetHook();
    if (inputRef.current) inputRef.current.value = '';
  }, [resetHook]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > effectiveMaxSize) {
        return `Ficheiro demasiado grande. Máximo: ${formatFileSize(effectiveMaxSize)}`;
      }
      const allowedTypes = effectiveAccept.split(',').map((t) => t.trim());
      const typeAllowed = allowedTypes.some((allowed) => {
        if (allowed.endsWith('/*')) {
          return file.type.startsWith(allowed.slice(0, -1));
        }
        if (allowed.endsWith('.*')) {
          return file.type.startsWith(allowed.slice(0, -2));
        }
        return file.type === allowed;
      });
      if (!typeAllowed) return 'Tipo de ficheiro não permitido';
      return null;
    },
    [effectiveAccept, effectiveMaxSize]
  );

  const processFile = useCallback(
    async (file: File) => {
      setValidationError(null);

      const err = validateFile(file);
      if (err) {
        setValidationError(err);
        setState('error');
        onError?.(err);
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      setFileType(file.type);
      setState('uploading');

      const result = await upload(file, folder);
      if (result) {
        setFileUrl(result.url);
        setState('success');
        onUpload(result);
      } else {
        setState('error');
        if (uploadError) onError?.(uploadError);
      }
    },
    [validateFile, upload, folder, onUpload, onError, uploadError]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, uploading, processFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const isImage = isImageFile(fileType);
  const currentError = validationError ?? uploadError;
  const isDisabled = disabled || uploading;

  return (
    <div className="w-full">
      {/* Drop zone — hidden when file is successfully uploaded */}
      {state !== 'success' && (
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-label={`Área de upload para ${folder}`}
          aria-disabled={isDisabled}
          onClick={() => !isDisabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
              inputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-8 text-center transition-all',
            isDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:bg-zinc-50',
            isDraggingOver
              ? 'border-blue-500 bg-blue-50'
              : state === 'error'
              ? 'border-red-400 bg-red-50'
              : 'border-dashed border-zinc-300',
          ].join(' ')}
        >
          {state === 'uploading' ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-zinc-600">A fazer upload...</p>
              {/* Progress bar */}
              <div className="w-full max-w-xs rounded-full bg-zinc-200 h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">{progress}%</p>
            </>
          ) : (
            <>
              <div className={[
                'flex h-12 w-12 items-center justify-center rounded-full',
                state === 'error' ? 'bg-red-100' : 'bg-zinc-100',
              ].join(' ')}>
                {state === 'error'
                  ? <AlertCircle className="h-6 w-6 text-red-500" />
                  : <Upload className="h-6 w-6 text-zinc-400" />
                }
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  {isDraggingOver ? 'Solte o ficheiro aqui' : 'Arraste ou clique para seleccionar'}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Máximo {formatFileSize(effectiveMaxSize)}
                </p>
              </div>
              {state === 'error' && currentError && (
                <p className="text-xs font-medium text-red-600">{currentError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Success state */}
      {state === 'success' && fileUrl && (
        <div className="relative flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          {/* Image preview */}
          {isImage ? (
            <img
              src={fileUrl}
              alt={fileName ?? 'Preview'}
              className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-green-200">
              <FileText className="h-7 w-7 text-zinc-400" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
              <p className="text-sm font-medium text-zinc-700 truncate">
                {fileName ?? 'Ficheiro enviado'}
              </p>
            </div>
            {fileSize !== null && (
              <p className="mt-0.5 text-xs text-zinc-400">{formatFileSize(fileSize)}</p>
            )}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-blue-600 hover:underline truncate"
            >
              Ver ficheiro
            </a>
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={reset}
            aria-label="Remover ficheiro"
            className="flex-shrink-0 rounded-full p-1 text-zinc-400 hover:bg-green-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={effectiveAccept}
        onChange={handleChange}
        disabled={isDisabled}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
