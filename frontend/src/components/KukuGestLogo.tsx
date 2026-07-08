import * as React from 'react';

const COMMERCE_PRIMARY = '#F06A1A';
const COMMERCE_DARK = '#B84D0E';
const COMMERCE_BG = '#FDF2EA';
const COMMERCE_BORDER = '#FAC775';

const ORANGE = COMMERCE_PRIMARY;

const LOGO_SRC = '/assets/kukugest-logo.png';
const ICON_SRC = '/assets/kukugest-icon.png';

interface KIconProps {
  size?: number;
  /** Mantido por compatibilidade — o ícone oficial é uma imagem com cores fixas. */
  color?: string;
  accentColor?: string;
  bg?: string;
  borderColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function KukuGestIcon({ size = 48, className, style }: KIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ICON_SRC}
      alt="KukuGest"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}

interface KukuGestLogoProps {
  height?: number;
  /** Mantido por compatibilidade — o logótipo oficial não inclui tagline. */
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="KukuGest"
        style={{ display: 'block', height, width: 'auto', flexShrink: 0 }}
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
      <KukuGestIcon size={72} style={{ borderRadius: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 26,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '0.16em',
          }}>KUKU</span>
          <span style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 900,
            fontSize: 26,
            color: 'white',
            letterSpacing: '-0.01em',
          }}>GEST</span>
        </div>
        <div style={{ width: 28, height: 2, background: ORANGE, borderRadius: 1, marginTop: 4 }} />
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
    </div>
  );
}

export default KukuGestLogo;
