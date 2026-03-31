import * as React from 'react';

const SERVICES_PRIMARY = '#1A6FD4';
const SERVICES_DARK = '#0D3F7A';
const SERVICES_LIGHT = '#5EB0F5';
const SERVICES_BADGE_LIGHT = '#2D9BFF';
const SERVICES_BG = '#EEF5FC';
const SERVICES_BORDER = '#B5D4F4';

const COMMERCE_PRIMARY = '#F06A1A';
const COMMERCE_DARK = '#B84D0E';
const COMMERCE_LIGHT = '#FFA040';
const COMMERCE_BG = '#FDF2EA';
const COMMERCE_BORDER = '#FAC775';

const BLUE = SERVICES_PRIMARY;
const ORANGE = COMMERCE_PRIMARY;
const ORANGE_SOFT = COMMERCE_LIGHT;
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

interface KukuGestNavLogoProps {
  iconSize?: number;
  className?: string;
}

type WorkspaceMode = 'servicos' | 'comercio';

interface KukuGestWorkspaceLogoProps {
  workspace: WorkspaceMode;
  height?: number;
  compact?: boolean;
  className?: string;
}

function WorkspaceMark({
  workspace,
  compact = false,
}: {
  workspace: WorkspaceMode;
  compact?: boolean;
}) {
  const color = workspace === 'comercio' ? COMMERCE_PRIMARY : SERVICES_PRIMARY;
  const accent = workspace === 'comercio' ? COMMERCE_LIGHT : SERVICES_BADGE_LIGHT;
  const baseX = compact ? 18 : 24;
  const baseY = compact ? 10 : 20;

  return (
    <>
      <rect x={baseX} y={baseY} width="7" height="36" rx="2" fill={color} />
      <polygon points={`${baseX + 7},${baseY + 18} ${baseX + 20},${baseY} ${baseX + 28},${baseY} ${baseX + 18},${baseY + 12} ${baseX + 7},${baseY + 18}`} fill={color} />
      <polygon points={`${baseX + 18},${baseY + 12} ${baseX + 28},${baseY} ${baseX + 33},${baseY} ${baseX + 24},${baseY + 10}`} fill={accent} />
      <polygon points={`${baseX + 7},${baseY + 20} ${baseX + 18},${baseY + 24} ${baseX + 28},${baseY + 36} ${baseX + 22},${baseY + 36} ${baseX + 7},${baseY + 22}`} fill={color} />
      <polygon points={`${baseX + 18},${baseY + 24} ${baseX + 28},${baseY + 36} ${baseX + 33},${baseY + 36} ${baseX + 24},${baseY + 28}`} fill={accent} />
      <circle cx={baseX + 11} cy={baseY + 19} r="2.5" fill={accent} />
    </>
  );
}

export function KukuGestWorkspaceLogo({
  workspace,
  height = 48,
  compact = false,
  className,
}: KukuGestWorkspaceLogoProps) {
  const isComercio = workspace === 'comercio';
  const viewBoxWidth = compact ? 212 : 292;
  const viewBoxHeight = compact ? 60 : 88;
  const titleColor = isComercio ? COMMERCE_PRIMARY : SERVICES_PRIMARY;
  const bg = isComercio ? COMMERCE_BG : SERVICES_BG;
  const border = isComercio ? COMMERCE_BORDER : SERVICES_BORDER;
  const workspaceLabel = isComercio ? 'Comércio' : 'Serviços';

  return (
    <svg
      width={(viewBoxWidth / viewBoxHeight) * height}
      height={height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`KukuGest ${workspaceLabel}`}
      className={className}
    >
      <rect x="0.5" y="0.5" width={viewBoxWidth - 1} height={viewBoxHeight - 1} rx={compact ? 12 : 14} fill={bg} stroke={border} />
      <WorkspaceMark workspace={workspace} compact={compact} />
      <text
        x={compact ? '78' : '76'}
        y={compact ? '26' : '34'}
        fontFamily="'Montserrat', sans-serif"
        fontSize={compact ? '17' : '19'}
        fontWeight="800"
        fill={titleColor}
      >
        KukuGest
      </text>
      <text
        x={compact ? '78' : '76'}
        y={compact ? '46' : '60'}
        fontFamily="'Montserrat', sans-serif"
        fontSize={compact ? '13.5' : '16'}
        fontWeight="700"
        fill={titleColor}
      >
        {workspaceLabel}
      </text>
    </svg>
  );
}

export function KukuGestNavLogo({
  iconSize = 48,
  className,
}: KukuGestNavLogoProps) {
  const size = Math.max(34, Math.round(iconSize * 0.78));

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <KukuGestIcon size={size} color="white" accentColor={ORANGE} bg={SERVICES_DARK} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 800,
          color: 'white',
          fontSize: Math.round(size * 0.44),
          letterSpacing: '0.01em',
        }}>
          KukuGest
        </span>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          color: SERVICES_PRIMARY,
          fontSize: Math.round(size * 0.27),
          letterSpacing: '0.06em',
          marginTop: 3,
        }}>
          Serviços
        </span>
      </div>
    </div>
  );
}

interface KukuGestNavLogoComercioProps {
  iconSize?: number;
  className?: string;
}

export function KukuGestNavLogoComercio({
  iconSize = 48,
  className,
}: KukuGestNavLogoComercioProps) {
  const size = Math.max(34, Math.round(iconSize * 0.78));

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <KukuGestIcon size={size} color={COMMERCE_PRIMARY} accentColor={SERVICES_LIGHT} bg={SERVICES_DARK} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 800,
          color: 'white',
          fontSize: Math.round(size * 0.44),
          letterSpacing: '0.01em',
        }}>
          KukuGest
        </span>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          color: COMMERCE_PRIMARY,
          fontSize: Math.round(size * 0.27),
          letterSpacing: '0.06em',
          marginTop: 3,
        }}>
          Comércio
        </span>
      </div>
    </div>
  );
}

export default KukuGestLogo;
