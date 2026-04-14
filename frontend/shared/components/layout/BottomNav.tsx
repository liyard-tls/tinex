'use client';

import { useState, useEffect, useRef } from 'react';
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

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);

  const currentIndex = navItems.findIndex((item) => pathname.startsWith(item.href));

  // Move glow to the active item's position
  useEffect(() => {
    if (currentIndex === -1) return;
    const el = itemRefs.current[currentIndex];
    const nav = navRef.current;
    const glow = glowRef.current;
    if (!el || !nav || !glow) return;

    const elRect = el.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const newLeft = elRect.left - navRect.left;
    const newWidth = elRect.width;

    if (!initialized.current) {
      // First paint: set position instantly, no transition
      glow.style.transition = 'none';
      glow.style.left = `${newLeft}px`;
      glow.style.width = `${newWidth}px`;
      glow.style.opacity = '1';
      // Force reflow so next change gets transition
      void glow.offsetWidth;
      glow.style.transition = 'left 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)';
      initialized.current = true;
    } else {
      // Subsequent navigations: animate
      glow.style.left = `${newLeft}px`;
      glow.style.width = `${newWidth}px`;
    }
  }, [currentIndex]);

  // Listen for swipe-triggered menu open
  useEffect(() => {
    const handler = () => setShowMenu(true);
    document.addEventListener('openSideMenu', handler);
    return () => document.removeEventListener('openSideMenu', handler);
  }, []);

  // Debug: watch data-swipe attribute and <main> presence together
  useEffect(() => {
    let swipeSetAt: number | null = null;

    const attrObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-swipe') {
          const val = document.documentElement.getAttribute('data-swipe');
          const mainEl = document.querySelector('main');
          if (val) {
            swipeSetAt = Date.now();
            console.log(`[Nav:observer] data-swipe="${val}" SET — main present: ${!!mainEl}`);
          } else {
            const elapsed = swipeSetAt ? Date.now() - swipeSetAt : '?';
            const mainEl2 = document.querySelector('main');
            console.log(`[Nav:observer] data-swipe REMOVED after ${elapsed}ms — main present: ${!!mainEl2}`);
            swipeSetAt = null;
          }
        }
      }
    });

    attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-swipe'] });

    // Also watch for <main> appearing/disappearing during a swipe
    const domObserver = new MutationObserver(() => {
      const swipe = document.documentElement.getAttribute('data-swipe');
      if (!swipe) return;
      const mainEl = document.querySelector('main');
      console.log(`[Nav:observer] DOM changed while data-swipe="${swipe}" — main present: ${!!mainEl}`);
    });

    domObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      attrObserver.disconnect();
      domObserver.disconnect();
    };
  }, []);

  const handleNavClick = (e: React.MouseEvent, targetHref: string, targetIndex: number) => {
    console.log(`[Nav] click: from="${navItems[currentIndex]?.href ?? 'unknown'}(${currentIndex})" to="${targetHref}(${targetIndex})" pathname="${pathname}"`);
    if (currentIndex === -1 || currentIndex === targetIndex) {
      console.log(`[Nav] skipped: currentIndex=${currentIndex}, targetIndex=${targetIndex}`);
      return;
    }
    e.preventDefault();
    const direction = targetIndex > currentIndex ? 'left' : 'right';
    console.log(`[Nav] navigating direction="${direction}" pushing to="${targetHref}"`);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.setAttribute('data-swipe', direction);
    console.log(`[Nav] data-swipe="${direction}" set on <html>`);
    router.push(targetHref);
    setTimeout(() => {
      console.log(`[Nav] removing data-swipe, pathname now="${window.location.pathname}"`);
      document.documentElement.removeAttribute('data-swipe');
    }, 350);
  };

  // Log every pathname change as React sees it
  useEffect(() => {
    console.log(`[Nav] pathname changed to "${pathname}", currentIndex=${currentIndex}`);
  }, [pathname, currentIndex]);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/75 backdrop-blur-md border-t border-white/[0.07] safe-area-bottom">
        <div ref={navRef} className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2">

          {/* Sliding glow — imperative position via ref, avoids React re-render lag */}
          <span
            ref={glowRef}
            className="absolute bottom-0 h-full pointer-events-none opacity-0"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 100%, hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.07) 60%, transparent 100%)',
            }}
          />

          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={(e) => handleNavClick(e, item.href, index)}
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
