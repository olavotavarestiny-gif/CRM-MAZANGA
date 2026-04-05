'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
} as const;

type ModalSize = keyof typeof SIZE_CLASSES;

interface ModalProps {
  open: boolean;
  /** Called when the modal requests close (ESC, outside click, X button) */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: ModalSize;
  /** Footer slot — usually CTA buttons. Rendered inside DialogFooter. */
  footer?: React.ReactNode;
  /** Whether the modal scrolls internally for tall content */
  scrollable?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Standardised modal built on top of the shadcn Dialog primitives.
 *
 * Sizes: sm (384px) · md (512px, default) · lg (672px) · xl (768px)
 * Close: ESC, click outside, X button (all built-in via Radix).
 *
 * Usage:
 *   <Modal open={open} onClose={onClose} title="Nova Tarefa" size="md" footer={<>…buttons…</>}>
 *     {children}
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  scrollable = false,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          SIZE_CLASSES[size],
          scrollable && 'max-h-[90vh] overflow-y-auto',
          'bg-white text-[#0A2540]',
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[#6b7e9a]">{description}</DialogDescription>
          )}
        </DialogHeader>

        {children}

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
