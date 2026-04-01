/** @type {import('next').NextConfig} */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Security headers — fixes ZAP alerts: CSP, X-Frame-Options, X-Content-Type-Options,
// Anti-clickjacking, MIME-sniffing, Cache-Control
const securityHeaders = [
  // Prevent MIME-type sniffing (alerts 4 & 5)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Anti-clickjacking (alert 3)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Legacy XSS filter
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Limit referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS — force HTTPS for 1 year (ZAP alert: Strict-Transport-Security Not Set)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Content Security Policy (alerts 2 & 3)
  // 'unsafe-inline' and 'unsafe-eval' required by Next.js 14 inline script injection
  // Tracking domains (Meta Pixel, Google Tag) included globally — scripts only load
  // on public form pages (/f/*) when configured, so no security regression elsewhere.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.supabase.co https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com ${API_URL} https://www.facebook.com https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://region1.google-analytics.com https://region1.analytics.google.com`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Prevent caching of authenticated pages (alerts 7 & 8)
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  { key: 'Pragma',        value: 'no-cache' },
  { key: 'Expires',       value: '0' },
];

const nextConfig = {
  async redirects() {
    return [
      {
        source: '/auth/signout',
        destination: '/api/auth/signout',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
