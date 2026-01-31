'use client';

import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: Check,
    bgColor: 'bg-emerald-950',
    borderColor: 'border-emerald-700',
    textColor: 'text-emerald-400',
  },
  error: {
    icon: X,
    bgColor: 'bg-red-950',
    borderColor: 'border-red-700',
    textColor: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-amber-950',
    borderColor: 'border-amber-700',
    textColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-950',
    borderColor: 'border-blue-700',
    textColor: 'text-blue-400',
  },
};

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = toastConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border text-sm font-medium',
          config.bgColor,
          config.borderColor,
          config.textColor
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
