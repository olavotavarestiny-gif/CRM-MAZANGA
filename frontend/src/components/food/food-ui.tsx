'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FoodSettings } from '@/lib/types';
import { blobSrc, formatFileSize } from '@/lib/file-utils';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT_PRIMARY = '#0f766e';

type BrandVars = CSSProperties & Record<'--workspace-primary' | '--workspace-primary-hover' | '--workspace-primary-soft' | '--workspace-primary-border' | '--workspace-on-primary', string>;

function normalizeHex(value?: string | null, fallback = DEFAULT_PRIMARY) {
  const candidate = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

function mix(hex: string, target: '#ffffff' | '#000000', amount: number) {
  const source = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  const ratio = Math.max(0, Math.min(1, amount));
  return `#${toHex(source.r + (targetRgb.r - source.r) * ratio)}${toHex(source.g + (targetRgb.g - source.g) * ratio)}${toHex(source.b + (targetRgb.b - source.b) * ratio)}`;
}

function readableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#17202a' : '#ffffff';
}

export function getFoodBrand(settings?: Pick<FoodSettings, 'restaurantName' | 'logoUrl' | 'primaryColor' | 'secondaryColor'> | null) {
  const primary = normalizeHex(settings?.primaryColor);
  const name = (settings?.restaurantName || 'Restaurante').trim();
  return {
    name,
    logoUrl: settings?.logoUrl || null,
    primary,
    secondary: normalizeHex(settings?.secondaryColor, mix(primary, '#000000', 0.18)),
    soft: mix(primary, '#ffffff', 0.9),
    border: mix(primary, '#ffffff', 0.65),
    hover: mix(primary, '#000000', 0.16),
    onPrimary: readableTextColor(primary),
  };
}

export function getFoodBrandStyle(settings?: Pick<FoodSettings, 'restaurantName' | 'logoUrl' | 'primaryColor' | 'secondaryColor'> | null): BrandVars {
  const brand = getFoodBrand(settings);
  return {
    '--workspace-primary': brand.primary,
    '--workspace-primary-hover': brand.hover,
    '--workspace-primary-soft': brand.soft,
    '--workspace-primary-border': brand.border,
    '--workspace-on-primary': brand.onPrimary,
  };
}

export function restaurantInitials(name?: string | null) {
  const words = String(name || 'Restaurante')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || 'R').toUpperCase();
}

export function RestaurantMark({
  settings,
  size = 'md',
  className,
}: {
  settings?: Pick<FoodSettings, 'restaurantName' | 'logoUrl' | 'primaryColor' | 'secondaryColor'> | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const brand = getFoodBrand(settings);
  const fallbackSizes = {
    sm: 'h-9 w-9 text-xs rounded-xl',
    md: 'h-11 w-11 text-sm rounded-2xl',
    lg: 'h-14 w-14 text-base rounded-2xl',
    xl: 'h-20 w-20 text-2xl rounded-[1.25rem]',
  };
  const logoSizes = {
    sm: 'h-9 w-16 rounded-xl p-1',
    md: 'h-11 w-20 rounded-2xl p-1.5',
    lg: 'h-14 w-28 rounded-2xl p-2',
    xl: 'h-20 w-40 rounded-[1.25rem] p-2.5',
  };

  if (brand.logoUrl) {
    return (
      <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-white shadow-sm', logoSizes[size], className)}>
        <img src={blobSrc(brand.logoUrl)} alt={brand.name} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-black shadow-sm', fallbackSizes[size], className)}
      style={{ backgroundColor: brand.primary, color: brand.onPrimary }}
      aria-label={brand.name}
    >
      {restaurantInitials(brand.name)}
    </div>
  );
}

export function FoodPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-bold text-[var(--workspace-primary)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function FoodTabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50/70 p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-primary)]',
              active
                ? 'bg-white text-[var(--workspace-primary)] ring-1 ring-[var(--workspace-primary-border)]'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn('rounded-full px-2 py-0.5 text-xs', active ? 'bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'bg-slate-100 text-slate-500')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function FoodEmptyState({
  icon: Icon = ImageIcon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[230px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[var(--workspace-primary)] ring-1 ring-slate-200">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-bold text-slate-950">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-5 text-slate-500">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" className="mt-6" onClick={onAction}>
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function FoodImagePicker({
  value,
  onChange,
  label = 'Fotografia',
  compact = false,
  fit = 'cover',
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  compact?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, uploading, progress } = useFileUpload();
  const maxSize = 4 * 1024 * 1024;

  const handleFile = async (file?: File | null) => {
    setError(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > maxSize) {
      setError(`Máximo ${formatFileSize(maxSize)}.`);
      return;
    }
    const result = await upload(file, 'food');
    if (result?.url) onChange(result.url);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Remover
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-slate-200',
          value && fit === 'contain' ? 'bg-white' : 'bg-slate-50',
          compact ? 'h-32' : 'h-44'
        )}
      >
        {value ? (
          <img
            src={blobSrc(value)}
            alt={label}
            className={cn('h-full w-full', fit === 'contain' ? 'object-contain p-3' : 'object-cover')}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm font-medium">Sem imagem</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-3 right-3 inline-flex min-h-9 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? `${progress}%` : value ? 'Substituir' : 'Carregar'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

export function SuccessNote({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
      <Check className="h-4 w-4" />
      <span className="flex-1">{children}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1 hover:bg-emerald-100">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
