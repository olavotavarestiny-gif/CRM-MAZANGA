import * as React from 'react';
import Image from 'next/image';

const COMMERCE_DARK = '#B84D0E';
const COMMERCE_BG = '#FDF2EA';
const COMMERCE_BORDER = '#FAC775';

interface KIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
  bg?: string;
  borderColor?: string;
}

export function KukuGestIcon({
  size = 48,
}: KIconProps) {
  return (
    <Image
      src="/kukugest-logo.png"
      alt="KukuGest"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  );
}

interface KukuGestLogoProps {
  height?: number;
  showTagline?: boolean;
  showBetaBadge?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function KukuGestLogo({
  height = 56,
  showBetaBadge = false,
  className,
  style,
}: KukuGestLogoProps) {
  const badgeFontSize = Math.max(8, Math.round(height * 0.18));
  const badgePaddingY = Math.max(3, Math.round(height * 0.08));
  const badgePaddingX = Math.max(7, Math.round(height * 0.16));

  // Real image aspect ratio after trim: 3764x1906 ≈ 1.97
  const aspectRatio = 3764 / 1906;
  const width = Math.round(height * aspectRatio);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: Math.max(4, Math.round(height * 0.12)),
        ...style,
      }}
    >
      <Image
        src="/kukugest-logo.png"
        alt="KukuGest"
        width={width}
        height={height}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
        priority
      />
      {showBetaBadge && (
        <span
          style={{
            marginTop: Math.max(2, Math.round(height * 0.08)),
            padding: `${badgePaddingY}px ${badgePaddingX}px`,
            borderRadius: 999,
            background: COMMERCE_BG,
            border: `1px solid ${COMMERCE_BORDER}`,
            color: COMMERCE_DARK,
            fontFamily: "'Montserrat', sans-serif",
            fontSize: badgeFontSize,
            fontWeight: 800,
            letterSpacing: '0.08em',
            lineHeight: 1,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Beta
        </span>
      )}
    </div>
  );
}

export function KukuGestLoginLogo({
  showTagline = false,
  className,
}: {
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <Image
        src="/kukugest-logo.png"
        alt="KukuGest"
        width={200}
        height={80}
        style={{ objectFit: 'contain' }}
        priority
      />
      {showTagline && (
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 8,
          color: 'rgba(255,255,255,0.42)',
          letterSpacing: '0.24em',
          marginTop: 9,
          textTransform: 'uppercase' as const,
        }}>
          GESTÃO INTELIGENTE
        </span>
      )}
    </div>
  );
}

export default KukuGestLogo;
