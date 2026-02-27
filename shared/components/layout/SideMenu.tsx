'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  Home,
  Wallet,
  PieChart,
  BarChart3,
  ArrowLeftRight,
  Upload,
  FolderOpen,
  Tag,
  Settings,
  X,
  Heart,
  Sparkles,
  FileText,
  Banknote,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { AIChatSidebar } from '@/modules/ai-chat';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const mainMenuItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/accounts', icon: Wallet, label: 'Accounts' },
  { href: '/budgets', icon: PieChart, label: 'Budgets' },
  { href: '/wishlists', icon: Heart, label: 'Wishlists' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/transfer-analytics', icon: Banknote, label: 'Transfer Analytics' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/import', icon: Upload, label: 'Import' },
];

const otherMenuItems = [
  { href: '/categories', icon: FolderOpen, label: 'Categories' },
  { href: '/tags', icon: Tag, label: 'Tags' },
  { href: '/changelog', icon: FileText, label: 'Changelog' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const pathname = usePathname();
  const [showAIChat, setShowAIChat] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Close menu on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Side Menu */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-card border-l border-border z-50 transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto">
            {/* Main Section */}
            <div className="p-4">
              <div className="space-y-1">
                {mainMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2" />

            {/* AI Assistant Button */}
            <div className="px-4">
              <button
                onClick={() => {
                  onClose();
                  setShowAIChat(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 text-primary border border-primary/20"
              >
                <Sparkles className="h-5 w-5" />
                <span className="font-medium">AI Assistant</span>
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2" />

            {/* Other Section */}
            <div className="p-4">
              <div className="space-y-1">
                {otherMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        userId={userId}
      />
    </>
  );
}
