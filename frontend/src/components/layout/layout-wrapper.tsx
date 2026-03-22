'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/api';
import Sidebar from './sidebar';
import { Footer } from './footer';
import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { User } from '@/lib/api';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const authChecked = useRef(false);

  const isPublicPage =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/form' ||
    pathname === '/termos' ||
    pathname === '/privacidade' ||
    pathname === '/manutencao' ||
    pathname.startsWith('/f/');

  // Keep-alive: ping backend every 14 minutes to prevent Render free tier cold starts
  useEffect(() => {
    if (isPublicPage) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const ping = () => fetch(`${API_URL}/health`, { method: 'GET' }).catch(() => {});
    ping();
    const interval = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // If public page, no auth needed
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    // Only call getCurrentUser once per session (not on every route change)
    // Middleware already protects routes — just need to load user data
    if (authChecked.current) {
      // Already verified — just check role-based route protection
      if (currentUser) {
        if (pathname.startsWith('/admin') && currentUser.role !== 'admin') {
          router.push('/');
        }
        // Finances: allow admin or account owners (not members)
        if (pathname.startsWith('/finances') && currentUser.role !== 'admin' && currentUser.accountOwnerId) {
          router.push('/');
        }
        // Equipa: only for account owners (not members)
        if (pathname.startsWith('/equipa') && currentUser.accountOwnerId) {
          router.push('/');
        }
      }
      return;
    }

    // First time: verify session with server
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        authChecked.current = true;

        if (pathname.startsWith('/admin') && user.role !== 'admin') {
          router.push('/');
        }
        // Finances: allow admin or account owners (not members)
        if (pathname.startsWith('/finances') && user.role !== 'admin' && user.accountOwnerId) {
          router.push('/');
        }
        // Equipa: only for account owners (not members)
        if (pathname.startsWith('/equipa') && user.accountOwnerId) {
          router.push('/');
        }
      } catch (err: any) {
        // Only force logout on explicit 401 — network errors should not log out
        if (err?.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !isPublicPage) {
    return <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e4edf7 50%, #dce8f5 100%)' }} />;
  }

  if (isPublicPage) {
    return <>{children}<Footer /></>;
  }

  return (
    <div className="flex h-screen" style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e4edf7 50%, #dce8f5 100%)' }}>
      {/* Sidebar Desktop */}
      <div className="hidden md:flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentUser={currentUser} />
      </div>

      {/* Sidebar Mobile (Overlay) */}
      <div className="md:hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentUser={currentUser} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Top Bar Mobile */}
        <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-[#dde3ec] bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#F8FAFC] rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-[#0A2540]" />
          </button>
          <h1 className="text-lg font-semibold text-[#0A2540]">ULU Gestão</h1>
        </div>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
