'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/75 backdrop-blur-md border-t border-white/[0.07] safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200',
                  'active:scale-95',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-6 rounded-full transition-all duration-200',
                  isActive && 'bg-primary/15'
                )}>
                  <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                </div>
                <span className={cn('text-xs transition-all duration-200', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
              </Link>
            );
          })}

          {/* Menu Button */}
          <button
            onClick={() => setShowMenu(true)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200',
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
