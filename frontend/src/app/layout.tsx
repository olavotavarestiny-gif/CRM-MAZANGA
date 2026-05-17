import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import LayoutWrapper from '@/components/layout/layout-wrapper';
import { Analytics } from '@vercel/analytics/react';
import { isServerDevAuthBypassEnabled } from '@/lib/dev-auth';

export const metadata: Metadata = {
  title: 'KukuGest',
  description: 'Sistema de gestão de clientes e faturação AGT',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devAuthBypassEnabled = isServerDevAuthBypassEnabled();

  return (
    <html lang="pt">
      <body>
        <Providers>
          <LayoutWrapper devAuthBypassEnabled={devAuthBypassEnabled}>
            {children}
          </LayoutWrapper>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
