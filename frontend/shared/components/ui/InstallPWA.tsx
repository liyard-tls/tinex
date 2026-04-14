'use client';

import { useEffect, useState } from 'react';
import Button from './Button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show the install banner after a delay
      setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Check if banner was dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('pwa-banner-dismissed') === 'true') {
      setShowInstallBanner(false);
    }
  }, []);

  if (isInstalled || !showInstallBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground p-3 z-50 shadow-lg animate-in slide-in-from-top">
      <div className="flex items-center justify-between max-w-screen-lg mx-auto">
        <div className="flex items-center gap-3">
          <Download className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Install TineX App</p>
            <p className="text-xs opacity-90">Add to home screen for better experience</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleInstallClick}
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
