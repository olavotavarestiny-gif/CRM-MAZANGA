'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import Sidebar from './sidebar';
import { Footer } from './footer';
import WelcomeModal from '@/components/help/welcome-modal';
import OnboardingChecklist from '@/components/help/onboarding-checklist';
import { ONBOARDING_OPEN } from '@/lib/onboarding-tasks';
import ProductTourProvider, { useTour } from '@/components/help/product-tour';
import { ReactNode } from 'react';
import { Menu, Eye, LogOut } from 'lucide-react';
import type { User } from '@/lib/api';
import { canView, getVisibleModules } from '@/lib/permissions';

// Map route prefix → module key (for permission redirect checks)
const PATH_MODULE_MAP: Record<string, Parameters<typeof canView>[1]> = {
  '/contacts':   'contacts',
  '/pipeline':   'pipeline',
  '/tasks':      'tasks',
  '/calendario': 'calendario',
  '/chat':       'chat',
  '/automations':'automations',
  '/forms':      'forms',
  '/finances':   'finances',
  '/produtos':   'finances',
};

// ── Inner layout — consumes TourContext ──────────────────────────────────────

function LayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { startTour } = useTour();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const authChecked = useRef(false);
  const currentSessionRef = useRef<string | null>(null);

  const isPublicPage =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/change-password' ||
    pathname === '/form' ||
    pathname === '/termos' ||
    pathname === '/privacidade' ||
    pathname === '/manutencao' ||
    pathname.startsWith('/f/');

  // Reset auth cache when Supabase session changes (e.g. after login/logout)
  useEffect(() => {
    if (isPublicPage) return;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newSessionId = session?.access_token ?? null;
      if (newSessionId !== currentSessionRef.current) {
        currentSessionRef.current = newSessionId;
        if (event === 'SIGNED_IN') {
          authChecked.current = false; // force re-fetch user on next render
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    const enforceAccess = (user: User) => {
      // SuperAdmin can access /superadmin
      if (pathname.startsWith('/superadmin') && !user.isSuperAdmin) {
        router.push('/');
        return;
      }
      // Platform admin routes
      if (pathname.startsWith('/admin') && user.role !== 'admin') {
        router.push('/');
        return;
      }
      // Permission-based redirect for team members
      if (user.accountOwnerId) {
        const firstSegment = '/' + pathname.split('/')[1];
        const module = PATH_MODULE_MAP[firstSegment];
        if (module && !canView(user, module)) {
          // Redirect to first visible module
          const visible = getVisibleModules(user);
          const moduleToPath: Record<string, string> = {
            contacts: '/contacts', pipeline: '/pipeline', tasks: '/tasks',
            chat: '/chat', calendario: '/calendario', automations: '/automations',
            forms: '/forms', finances: '/finances',
          };
          const fallback = visible.map(m => moduleToPath[m]).find(Boolean) ?? '/';
          router.push(fallback);
        }
      }
    };

    if (authChecked.current) {
      if (currentUser) enforceAccess(currentUser);
      return;
    }

    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        authChecked.current = true;

        // Force password change before accessing anything
        if (user.mustChangePassword) {
          router.push('/change-password');
          return;
        }

        enforceAccess(user);

        // Show welcome modal on first visit
        if (!localStorage.getItem('kukugest_guide_seen')) setShowWelcome(true);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartChecklist = () => {
    localStorage.setItem('kukugest_guide_seen', '1');
    setShowWelcome(false);
    localStorage.setItem(ONBOARDING_OPEN, '1');
    // Trigger re-render of OnboardingChecklist by dispatching a storage event
    window.dispatchEvent(new StorageEvent('storage', { key: ONBOARDING_OPEN }));
  };

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
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentUser={currentUser}
          onStartTour={startTour}
        />
      </div>

      {/* Sidebar Mobile (Overlay) */}
      <div className="md:hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentUser={currentUser}
          onStartTour={startTour}
        />
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
          <h1 className="text-lg font-semibold text-[#0A2540]">KukuGest</h1>
        </div>

        {/* Impersonation Banner */}
        {currentUser?.impersonatedBy && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-white text-sm font-medium">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span>A ver o sistema como <strong>{currentUser.name}</strong> ({currentUser.email})</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('impersonation_token');
                window.location.reload();
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da Impersonation
            </button>
          </div>
        )}

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
          {children}
        </main>
      </div>

      <WelcomeModal
        open={showWelcome}
        onClose={() => { localStorage.setItem('kukugest_guide_seen', '1'); setShowWelcome(false); }}
        onStartTour={handleStartChecklist}
      />
      <OnboardingChecklist />
    </div>
  );
}

// ── Outer wrapper — provides TourContext ─────────────────────────────────────

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <ProductTourProvider>
      <LayoutInner>{children}</LayoutInner>
    </ProductTourProvider>
  );
}
