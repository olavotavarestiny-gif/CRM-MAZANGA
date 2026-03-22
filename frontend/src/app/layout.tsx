import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import LayoutWrapper from '@/components/layout/layout-wrapper';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  title: 'ULU Gestão',
  description: 'Sistema de gestão de clientes e faturação AGT',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>
        <Providers>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
