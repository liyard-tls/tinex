'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button } from './';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg bg-card border border-border shadow-lg',
          'max-h-[100vh] mb-20',
          'rounded-t-xl sm:rounded-xl',
          'animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300',
          'flex flex-col',
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 pb-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
