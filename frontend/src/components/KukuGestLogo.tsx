import * as React from 'react';

const BLUE = '#1A6FD4';
const ORANGE = '#F06A1A';
const ORANGE_SOFT = '#FFA040';
const DARK = '#0D1C33';
const LIGHT = '#F8F8F8';
const BORDER = '#E5E5E5';
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
  bg = DARK,
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
      <g transform="translate(16 0) scale(0.68)">
        <KukuGestMark color={color} accentColor={accentColor} />
      </g>
    </svg>
  );
}

export function KukuGestIconComercio({
  size = 48,
  bg = LIGHT,
}: { size?: number; bg?: string }) {
  return (
    <KukuGestIcon
      size={size}
      color={ORANGE}
      accentColor={ORANGE_SOFT}
      bg={bg}
      borderColor={bg === LIGHT ? BORDER : undefined}
    />
  );
}

interface KukuGestLogoProps {
  height?: number;
  showTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function KukuGestLogo({
  height = 56,
  showTagline = false,
  className,
  style,
}: KukuGestLogoProps) {
  const viewBoxHeight = 110;
  const viewBoxWidth = showTagline ? 440 : 360;

  return (
    <svg
      width={(viewBoxWidth / viewBoxHeight) * height}
      height={height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KukuGest"
      className={className}
      style={style}
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
  );
}

interface KukuGestNavLogoProps {
  iconSize?: number;
  label?: string;
  labelColor?: string;
  className?: string;
}

function WorkspaceLabel({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ color, backgroundColor: background }}
    >
      {label}
    </span>
  );
}

export function KukuGestNavLogo({
  iconSize = 36,
  label,
  labelColor = BLUE,
  className,
}: KukuGestNavLogoProps) {
  const logoHeight = Math.max(30, iconSize + 2);

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <KukuGestIcon size={iconSize} color={BLUE} accentColor={ORANGE} bg={DARK} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <KukuGestLogo height={logoHeight} />
        {label ? (
          <WorkspaceLabel label={label} color={labelColor} background="#EEF5FC" />
        ) : null}
      </div>
    </div>
  );
}

interface KukuGestNavLogoComercioProps {
  iconSize?: number;
  label?: string;
  className?: string;
}

export function KukuGestNavLogoComercio({
  iconSize = 36,
  label = 'Comércio',
  className,
}: KukuGestNavLogoComercioProps) {
  const logoHeight = Math.max(30, iconSize + 2);

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <KukuGestIconComercio size={iconSize} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <KukuGestLogo height={logoHeight} />
        {label ? (
          <WorkspaceLabel label={label} color={ORANGE} background="#FDF2EA" />
        ) : null}
      </div>
    </div>
  );
}

export default KukuGestLogo;
