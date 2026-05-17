import * as React from 'react';

const SERVICES_PRIMARY = '#1A6FD4';
const SERVICES_DARK = '#0D3F7A';
const COMMERCE_PRIMARY = '#F06A1A';
const COMMERCE_DARK = '#B84D0E';
const COMMERCE_BG = '#FDF2EA';
const COMMERCE_BORDER = '#FAC775';

const BLUE = SERVICES_PRIMARY;
const ORANGE = COMMERCE_PRIMARY;
const TAGLINE = '#8A8F98';

interface MarkProps {
  color?: string;
  accentColor?: string;
}

function KukuGestMark({
  color = BLUE,
  accentColor = ORANGE,
}: MarkProps) {
  return (
    <>
      <rect x="8" y="10" width="18" height="80" rx="4" fill={color} />
      <polygon points="26,50 66,10 83,10 56,42 26,50" fill={color} />
      <polygon points="56,42 83,10 93,10 66,35" fill={accentColor} />
      <polygon points="26,50 56,58 83,90 66,90 26,56" fill={color} />
      <polygon points="56,58 83,90 93,90 66,71" fill={accentColor} />
      <circle cx="38" cy="50" r="5" fill={accentColor} />
    </>
  );
}

interface KIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
  bg?: string;
  borderColor?: string;
}

export function KukuGestIcon({
  size = 48,
  color = BLUE,
  accentColor = ORANGE,
  bg = SERVICES_DARK,
  borderColor,
}: KIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KukuGest icon"
    >
      <rect x="1" y="1" width="98" height="98" rx="20" fill={bg} stroke={borderColor} />
      <g transform="translate(16 16) scale(0.68)">
        <KukuGestMark color={color} accentColor={accentColor} />
      </g>
    </svg>
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
  showTagline = false,
  showBetaBadge = false,
  className,
  style,
}: KukuGestLogoProps) {
  const viewBoxHeight = 110;
  const viewBoxWidth = showTagline ? 440 : 360;
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
      <svg
        width={(viewBoxWidth / viewBoxHeight) * height}
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="KukuGest"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <g transform="translate(0 10)">
          <KukuGestMark />
        </g>

        <text
          x="118"
          y="47"
          fontFamily="'Montserrat', sans-serif"
          fontSize="38"
          fontWeight="800"
          fill={BLUE}
          letterSpacing="-0.5"
        >
          KUKU
        </text>
        <text
          x="118"
          y="87"
          fontFamily="'Montserrat', sans-serif"
          fontSize="38"
          fontWeight="800"
          fill={ORANGE}
          letterSpacing="-0.5"
        >
          GEST
        </text>

        {showTagline && (
          <text
            x="320"
            y="84"
            fontFamily="'Montserrat', sans-serif"
            fontSize="9"
            fontWeight="600"
            fill={TAGLINE}
            letterSpacing="0.15em"
            textAnchor="middle"
          >
            GESTÃO INTELIGENTE
          </text>
        )}
      </svg>
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
      <KukuGestIcon size={72} color="white" accentColor={ORANGE} bg={SERVICES_DARK} />
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
