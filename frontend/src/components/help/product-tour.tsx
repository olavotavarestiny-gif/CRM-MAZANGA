'use client';

import {
  createContext, useContext, useCallback, useEffect, useRef, ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUR_GROUPS, TOUR_KEYS, TOTAL_STEPS, GROUP_OFFSETS } from '@/lib/tour-steps';

interface TourContextValue {
  startTour: () => void;
  stopTour: () => void;
}

const TourContext = createContext<TourContextValue>({ startTour: () => {}, stopTour: () => {} });
export const useTour = () => useContext(TourContext);

function isActive() {
  return typeof window !== 'undefined' && sessionStorage.getItem(TOUR_KEYS.ACTIVE) === 'true';
}
function getGroup() {
  return parseInt(sessionStorage.getItem(TOUR_KEYS.GROUP) ?? '0', 10);
}
function clearTour() {
  sessionStorage.removeItem(TOUR_KEYS.ACTIVE);
  sessionStorage.removeItem(TOUR_KEYS.GROUP);
}

export default function ProductTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<any>(null);

  const driveGroup = useCallback(async (groupId: number) => {
    try {
      const { driver } = await import('driver.js');
      const group = TOUR_GROUPS[groupId];
      if (!group) { clearTour(); return; }

      driverRef.current?.destroy();

      const isLast = groupId === TOUR_GROUPS.length - 1;
      const offset = GROUP_OFFSETS[groupId];

      driverRef.current = driver({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 8,
        showProgress: false,
        nextBtnText: 'Seguinte →',
        prevBtnText: '← Anterior',
        doneBtnText: isLast ? 'Concluir ✓' : 'Próxima secção →',

        onCloseClick: () => {
          clearTour();
        },

        onDestroyed: () => {
          if (!isActive()) return; // ESC or overlay clicked — keys already cleared
          const next = groupId + 1;
          if (next >= TOUR_GROUPS.length) { clearTour(); return; }
          sessionStorage.setItem(TOUR_KEYS.GROUP, String(next));
          const nextRoute = TOUR_GROUPS[next].route;
          if (nextRoute === pathname) {
            // Same route — call driveGroup directly (pathname won't change)
            setTimeout(() => driveGroup(next), 150);
          } else {
            router.push(nextRoute); // useEffect will resume on route change
          }
        },

        steps: group.steps.map((step, i) => ({
          element: step.element,
          popover: {
            ...step.popover,
            description:
              `<span style="display:block;font-size:11px;color:#6b7e9a;margin-bottom:6px;">` +
              `Passo ${offset + i + 1} de ${TOTAL_STEPS}</span>` +
              step.popover.description,
          },
        })),
      });

      driverRef.current.drive();
    } catch {
      clearTour();
    }
  }, [pathname, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTour = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return; // desktop only
    sessionStorage.setItem(TOUR_KEYS.ACTIVE, 'true');
    sessionStorage.setItem(TOUR_KEYS.GROUP, '0');
    if (pathname === '/') {
      setTimeout(() => driveGroup(0), 150);
    } else {
      router.push('/');
    }
  }, [pathname, router, driveGroup]);

  const stopTour = useCallback(() => {
    driverRef.current?.destroy();
    clearTour();
  }, []);

  // Resume tour after page navigation
  useEffect(() => {
    if (!isActive()) return;
    const groupId = getGroup();
    const group = TOUR_GROUPS[groupId];
    if (!group || group.route !== pathname) return;
    const t = setTimeout(() => driveGroup(groupId), 400);
    return () => clearTimeout(t);
  }, [pathname, driveGroup]);

  // Cleanup on unmount
  useEffect(() => () => driverRef.current?.destroy(), []);

  return (
    <TourContext.Provider value={{ startTour, stopTour }}>
      {children}
    </TourContext.Provider>
  );
}
