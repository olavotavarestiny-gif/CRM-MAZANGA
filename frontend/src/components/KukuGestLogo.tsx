import * as React from "react";

// ─────────────────────────────────────────────
// KukuGest — Brand colors
// ─────────────────────────────────────────────
const BLUE = "#1A6FD4";
const ORANGE = "#F06A1A";
const WHITE = "#FFFFFF";
const DARK = "#080F1A";
const MUTED = "#2A4A6A";

// ─────────────────────────────────────────────
// K Icon — reusable sub-component
// ─────────────────────────────────────────────
interface KIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
  bg?: string;
}

export function KukuGestIcon({
  size = 48,
  color = BLUE,
  accentColor = ORANGE,
  bg = DARK,
}: KIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KukuGest icon"
    >
      {/* Background square */}
      <rect width="48" height="48" rx="10" fill={bg} />

      {/* K — vertical stroke */}
      <rect x="12" y="10" width="6" height="28" rx="2" fill={color} />

      {/* K — upper arm (rounded pill, angled up-right) */}
      <rect
        x="17"
        y="10"
        width="20"
        height="6"
        rx="3"
        fill={color}
        transform="rotate(-30 17 13)"
      />

      {/* K — lower arm (rounded pill, angled down-right) */}
      <rect
        x="17"
        y="32"
        width="20"
        height="6"
        rx="3"
        fill={color}
        transform="rotate(30 17 35)"
      />

      {/* Orange accent — 3 growth bars at the vertex */}
      <rect x="22" y="25" width="3" height="6"  rx="1.5" fill={accentColor} opacity="0.55" />
      <rect x="27" y="22" width="3" height="9"  rx="1.5" fill={accentColor} opacity="0.78" />
      <rect x="32" y="19" width="3" height="12" rx="1.5" fill={accentColor} />
    </svg>
  );
}

// ─────────────────────────────────────────────
// KukuGest Icon — Comércio variant (K laranja, barras azuis)
// ─────────────────────────────────────────────
export function KukuGestIconComercio({
  size = 48,
  bg = DARK,
}: { size?: number; bg?: string }) {
  return <KukuGestIcon size={size} color={ORANGE} accentColor={BLUE} bg={bg} />;
}

// ─────────────────────────────────────────────
// Full Logo — horizontal dark
// ─────────────────────────────────────────────
interface KukuGestLogoProps {
  /** Height of the logo in px. Width scales proportionally. */
  height?: number;
  /** Show the tagline below GEST */
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
  const vbH = showTagline ? 72 : 60;
  const scale = height / vbH;
  const vbW = 260;

  return (
    <svg
      width={vbW * scale}
      height={height}
      viewBox={`0 0 ${vbW} ${vbH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KukuGest"
      className={className}
      style={style}
    >
      {/* ── K mark ── */}
      {/* Vertical stroke */}
      <rect x="4" y="4" width="8" height="52" rx="2.5" fill={BLUE} />

      {/* Upper arm — rounded pill rotated */}
      <rect
        x="11"
        y="4"
        width="30"
        height="8"
        rx="4"
        fill={BLUE}
        transform="rotate(-34 11 8)"
      />

      {/* Lower arm — rounded pill rotated */}
      <rect
        x="11"
        y="52"
        width="30"
        height="8"
        rx="4"
        fill={BLUE}
        transform="rotate(34 11 56)"
      />

      {/* Orange growth bars — at the K vertex */}
      <rect x="18" y="26" width="3.5" height="7"  rx="1.75" fill={ORANGE} opacity="0.55" />
      <rect x="23" y="23" width="3.5" height="10" rx="1.75" fill={ORANGE} opacity="0.78" />
      <rect x="28" y="19" width="3.5" height="14" rx="1.75" fill={ORANGE} />

      {/* ── Wordmark ── */}
      {/* KUKU — Montserrat Light 300 */}
      <text
        x="50"
        y="34"
        fontFamily="'Montserrat', sans-serif"
        fontSize="28"
        fontWeight="300"
        fill={WHITE}
        letterSpacing="3"
      >
        KUKU
      </text>

      {/* GEST — Montserrat Black 900 */}
      <text
        x="50"
        y="57"
        fontFamily="'Montserrat', sans-serif"
        fontSize="28"
        fontWeight="900"
        fill={WHITE}
        letterSpacing="-1"
      >
        GEST
      </text>

      {/* Orange underline accent on GEST */}
      <rect x="50" y="60" width="22" height="2" rx="1" fill={ORANGE} />

      {/* Tagline (optional) */}
      {showTagline && (
        <text
          x="50"
          y="70"
          fontFamily="'Montserrat', sans-serif"
          fontSize="5"
          fontWeight="300"
          fill={MUTED}
          letterSpacing="2"
        >
          GESTÃO INTELIGENTE
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Nav Logo — ícone + wordmark + label de workspace (base)
// ─────────────────────────────────────────────
interface KukuGestNavLogoProps {
  iconSize?: number;
  label?: string;
  labelColor?: string;
  className?: string;
}

export function KukuGestNavLogo({
  iconSize = 32,
  label,
  labelColor = WHITE,
  className,
}: KukuGestNavLogoProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <KukuGestIcon size={iconSize} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 900,
            color: WHITE,
            fontSize: iconSize * 0.5,
            letterSpacing: '0.05em',
          }}
        >
          KUKUGEST
        </span>
        {label && (
          <span
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              color: labelColor,
              fontSize: iconSize * 0.3,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              marginTop: 2,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Nav Logo — variante Comércio (ícone laranja + label em #F06A1A)
// ─────────────────────────────────────────────
interface KukuGestNavLogoComercioProps {
  iconSize?: number;
  label?: string;
  className?: string;
}

export function KukuGestNavLogoComercio({
  iconSize = 32,
  label = 'Comércio',
  className,
}: KukuGestNavLogoComercioProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <KukuGestIconComercio size={iconSize} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 900,
            color: WHITE,
            fontSize: iconSize * 0.5,
            letterSpacing: '0.05em',
          }}
        >
          KUKUGEST
        </span>
        {label && (
          <span
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              color: ORANGE,
              fontSize: iconSize * 0.3,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              marginTop: 2,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — full logo dark
// ─────────────────────────────────────────────
export default KukuGestLogo;
