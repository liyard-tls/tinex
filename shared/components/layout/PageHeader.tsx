'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  onBack?: () => void;
  rightElement?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  backHref,
  onBack,
  rightElement,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    }
  };

  const showBack = !!(backHref || onBack);

  return (
    <header
      className={cn(
        'sticky top-0 z-40',
        'bg-background/70 backdrop-blur-md',
        'border-b border-white/[0.07]',
        // Subtle primary gradient accent line at top
        'before:absolute before:top-0 before:left-0 before:right-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-primary/30 before:to-transparent',
        'relative',
        className
      )}
    >
      <div className="px-4 py-3 flex items-center gap-3 min-h-[56px]">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.09] active:scale-95 transition-all text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{description}</p>
          )}
        </div>
        {rightElement && (
          <div className="flex-shrink-0 flex items-center gap-1.5">{rightElement}</div>
        )}
      </div>
    </header>
  );
}
