import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import LayoutWrapper from '@/components/layout/layout-wrapper';
import { Analytics } from '@vercel/analytics/react';
import { isServerDevAuthBypassEnabled } from '@/lib/dev-auth';
import { APP_PRODUCT } from '@/lib/product';

export const metadata: Metadata = {
  title: APP_PRODUCT === 'growth-room' ? 'Mazanga Growth Room' : APP_PRODUCT === 'food' ? 'KukuGest Food' : APP_PRODUCT === 'platform-admin' ? 'KukuGest Admin' : 'KukuGest',
  description: APP_PRODUCT === 'food'
    ? 'Operação de restaurantes, caixa, cozinha e delivery'
    : APP_PRODUCT === 'platform-admin'
      ? 'Administração da plataforma KukuGest'
      : 'Sistema de gestão de clientes e faturação AGT',
  icons: {
    icon: APP_PRODUCT === 'food' ? '/food-favicon.svg' : '/favicon.png',
    shortcut: APP_PRODUCT === 'food' ? '/food-favicon.svg' : '/favicon.png',
    apple: APP_PRODUCT === 'food' ? '/food-favicon.svg' : '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devAuthBypassEnabled = isServerDevAuthBypassEnabled();

  return (
    <html lang="pt" data-product={APP_PRODUCT}>
      <body className={APP_PRODUCT === 'food' ? 'product-food' : APP_PRODUCT === 'growth-room' ? 'product-growth-room' : undefined}>
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
