'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NAV_ROUTES = ['/dashboard', '/accounts', '/budgets', '/analytics'];

const MIN_SWIPE_X = 60;   // minimum horizontal distance to trigger navigation
const MAX_SWIPE_Y = 80;   // maximum vertical distance (to avoid scroll conflicts)
const EDGE_ZONE = 40;     // px from screen edge — ignore to not conflict with back gesture

export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const currentIndex = NAV_ROUTES.findIndex((r) => pathname.startsWith(r));

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Ignore touches starting near screen edges (browser back/forward gesture zones)
      if (touch.clientX < EDGE_ZONE || touch.clientX > window.innerWidth - EDGE_ZONE) {
        touchStart.current = null;
        return;
      }
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = Math.abs(touch.clientY - touchStart.current.y);
      touchStart.current = null;

      // Not a valid horizontal swipe
      if (Math.abs(dx) < MIN_SWIPE_X || dy > MAX_SWIPE_Y) return;
      // Not on a main nav page
      if (currentIndex === -1) return;

      const navigate = (direction: 'left' | 'right', target: string) => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.setAttribute('data-swipe', direction);
        router.push(target);
        // Clear attribute after animation completes so it re-triggers on next swipe
        setTimeout(() => document.documentElement.removeAttribute('data-swipe'), 350);
      };

      if (dx < 0) {
        // Swipe left → next page
        const next = NAV_ROUTES[currentIndex + 1];
        if (next) {
          navigate('left', next);
        } else if (currentIndex === NAV_ROUTES.length - 1) {
          // Swipe left on last page (Analytics) → open side menu
          document.dispatchEvent(new CustomEvent('openSideMenu'));
        }
      } else {
        // Swipe right → previous page
        const prev = NAV_ROUTES[currentIndex - 1];
        if (prev) navigate('right', prev);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pathname, router]);
}
