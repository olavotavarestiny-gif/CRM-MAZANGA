'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PreviewSidebar from './preview-sidebar';
import { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60 * 1000 },
  },
});

const mockUser = {
  id: 999,
  name: 'Carlos Silva',
  email: 'preview@demo.local',
  role: 'admin',
  active: true,
  plan: 'profissional',
  isSuperAdmin: false,
  permissions: null,
  accountOwnerId: null,
  impersonatedBy: undefined,
  mustChangePassword: false,
  createdAt: new Date().toISOString(),
} as any;

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-[#f5f7f9]">
        {/* Sidebar */}
        <PreviewSidebar currentUser={mockUser} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between px-8 py-6 bg-white border-b border-slate-100 sticky top-0 z-40">
            <div>
              <h2 className="text-2xl font-extrabold text-[#2c2f31] tracking-tight">Bem-vindo, CEO</h2>
              <p className="text-[#595c5e] text-sm">Aqui está o que precisa da sua atenção hoje.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#595c5e] bg-blue-50 px-3 py-1 rounded-full">Preview</span>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-[#2c2f31]">Carlos Silva</span>
                <span className="text-xs text-[#595c5e]">Administrador</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0049e6] to-[#829bff] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">CS</span>
              </div>
            </div>
          </header>

          {/* Main scrollable content */}
          <main className="flex-1 overflow-y-auto bg-[#f5f7f9] p-8">
            {children}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
