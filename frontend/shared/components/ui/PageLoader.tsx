import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

/**
 * Full-page loading state that preserves the <main> element so that
 * CSS slide-in animations (targeting `html[data-swipe] main`) always
 * have a DOM target during page transitions.
 */
export default function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  useEffect(() => {
    const swipe = document.documentElement.getAttribute('data-swipe');
    console.log(`[PageLoader] mounted, data-swipe="${swipe}", message="${message}"`);
    return () => {
      const swipe = document.documentElement.getAttribute('data-swipe');
      console.log(`[PageLoader] unmounted, data-swipe="${swipe}"`);
    };
  }, [message]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
