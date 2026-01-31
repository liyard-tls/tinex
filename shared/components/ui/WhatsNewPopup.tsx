'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/utils/cn';
import {
  APP_VERSION,
  getLatestChangelog,
  getHighlightedChanges,
  getChangeTypeConfig,
} from '@/shared/config/version';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';

interface WhatsNewPopupProps {
  userId: string;
  onDismiss?: () => void;
}

export default function WhatsNewPopup({ userId, onDismiss }: WhatsNewPopupProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const latestChangelog = getLatestChangelog();
  const highlightedChanges = getHighlightedChanges();

  useEffect(() => {
    checkAndShowPopup();

    // Expose function to window for testing in console
    // Usage: window.__showWhatsNew?.()
    if (typeof window !== 'undefined') {
      (window as Window & { __showWhatsNew?: () => void }).__showWhatsNew = () => {
        setIsAnimating(true);
        setTimeout(() => setIsVisible(true), 50);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { __showWhatsNew?: () => void }).__showWhatsNew;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const checkAndShowPopup = async () => {
    if (!userId) return;

    try {
      const settings = await userSettingsRepository.get(userId);
      const seenVersion = settings?.seenVersion;

      // Show popup if user hasn't seen this version
      if (seenVersion !== APP_VERSION) {
        setIsAnimating(true);
        setTimeout(() => setIsVisible(true), 50);
      }
    } catch (error) {
      console.error('Failed to check seen version:', error);
    }
  };

  const handleDismiss = async () => {
    setIsVisible(false);
    setTimeout(async () => {
      setIsAnimating(false);

      // Save that user has seen this version
      try {
        await userSettingsRepository.update(userId, { seenVersion: APP_VERSION });
      } catch (error) {
        console.error('Failed to save seen version:', error);
      }

      onDismiss?.();
    }, 300);
  };

  const handleViewAll = async () => {
    await handleDismiss();
    router.push('/changelog');
  };

  if (!isAnimating || !latestChangelog) {
    return null;
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleDismiss}
      />

      {/* Popup */}
      <div
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90vw] max-w-md',
          'bg-card border border-border rounded-2xl shadow-2xl',
          'transition-all duration-300',
          isVisible
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95'
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 hover:bg-muted rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">What&apos;s New</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Version {APP_VERSION}
            </p>
          </div>

          {/* Highlighted Changes */}
          <div className="space-y-2.5 mb-6">
            {highlightedChanges.slice(0, 5).map((change, index) => {
              const config = getChangeTypeConfig(change.type);

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50"
                >
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded flex-shrink-0',
                    config.color
                  )}>
                    {config.label}
                  </span>
                  <span className="text-sm">{change.text}</span>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleDismiss}
              className="w-full"
            >
              Got it
            </Button>
            <button
              onClick={handleViewAll}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>View all changes</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
