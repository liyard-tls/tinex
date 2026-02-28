'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Wallet, PieChart, BarChart3, Menu } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import SideMenu from './SideMenu';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/accounts', icon: Wallet, label: 'Accounts' },
  { href: '/budgets', icon: PieChart, label: 'Budgets' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  // Refs to each nav item for measuring position
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navRef = useRef<HTMLDivElement>(null);

  // Glow position in px (left offset + width relative to nav container)
  const [glowStyle, setGlowStyle] = useState<{ left: number; width: number } | null>(null);
  // Track if first render (skip transition on initial paint)
  const isFirstRender = useRef(true);

  const currentIndex = navItems.findIndex((item) => pathname.startsWith(item.href));

  // Measure active item and update glow position
  useLayoutEffect(() => {
    if (currentIndex === -1) {
      setGlowStyle(null);
      return;
    }
    const el = itemRefs.current[currentIndex];
    const nav = navRef.current;
    if (!el || !nav) return;

    const elRect = el.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setGlowStyle({
      left: elRect.left - navRect.left,
      width: elRect.width,
    });

    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, [currentIndex]);

  // Listen for swipe-triggered menu open
  useEffect(() => {
    const handler = () => setShowMenu(true);
    document.addEventListener('openSideMenu', handler);
    return () => document.removeEventListener('openSideMenu', handler);
  }, []);

  const handleNavClick = (targetHref: string, targetIndex: number) => {
    if (currentIndex === -1 || currentIndex === targetIndex) return;
    const direction = targetIndex > currentIndex ? 'left' : 'right';
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.setAttribute('data-swipe', direction);
    router.push(targetHref);
    setTimeout(() => document.documentElement.removeAttribute('data-swipe'), 350);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/75 backdrop-blur-md border-t border-white/[0.07] safe-area-bottom">
        <div ref={navRef} className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2">

          {/* Sliding glow — pixel-accurate, transitions on position change */}
          {glowStyle && (
            <span
              className="absolute bottom-0 h-full pointer-events-none"
              style={{
                left: glowStyle.left,
                width: glowStyle.width,
                transition: isFirstRender.current ? 'none' : 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                background: 'radial-gradient(ellipse 80% 60% at 50% 100%, hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.07) 60%, transparent 100%)',
              }}
            />
          )}

          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={() => handleNavClick(item.href, index)}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors duration-200',
                  'active:scale-95',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="flex items-center justify-center w-8 h-6">
                  <Icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'stroke-[2.5]')} />
                </div>
                <span className={cn('text-xs transition-all duration-200', isActive ? 'font-semibold' : 'font-medium')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Menu Button */}
          <button
            onClick={() => setShowMenu(true)}
            className={cn(
              'relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200',
              'active:scale-95',
              'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center justify-center w-8 h-6">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </nav>

      <SideMenu isOpen={showMenu} onClose={() => setShowMenu(false)} />
    </>
  );
}
