import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function GrowthBrand({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="Mazanga Growth Room" className={cn('inline-flex items-center gap-3', className)}>
      <Image
        src="/mazanga/mazanga-logo-white.png"
        alt="Mazanga Marketing"
        width={176}
        height={60}
        priority={priority}
        className="h-auto w-[132px] object-contain sm:w-[148px]"
      />
      <span className="h-8 w-px bg-white/15" />
      <span className="font-growth-display text-[10px] font-bold uppercase leading-[1.15] tracking-[.16em] text-white/55">
        Growth<br />Room
      </span>
    </Link>
  );
}
