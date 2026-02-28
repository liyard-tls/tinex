'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Drag state — use state (not just ref) so transitions update on drag start/end
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setDragY(0);
      setIsDragging(false);
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setDragY(0);
      setIsDragging(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  }, []);

  const onPointerUp = useCallback((currentDragY: number) => {
    setIsDragging(false);
    dragStartY.current = null;

    const threshold = (sheetRef.current?.offsetHeight ?? 300) * 0.3;
    if (currentDragY > threshold) {
      onClose();
    } else {
      setDragY(0);
    }
  }, [onClose]);

  if (!mounted) return null;

  // While dragging, disable CSS transition so it follows the finger exactly
  const sheetStyle: React.CSSProperties = isDragging
    ? { transform: `translateY(${dragY}px)`, transition: 'none' }
    : { transform: visible ? `translateY(${dragY}px)` : 'translateY(100%)', transition: 'transform 300ms ease-out' };

  // Backdrop opacity dims as you drag down
  const sheetHeight = sheetRef.current?.offsetHeight ?? 1;
  const backdropOpacity = visible ? Math.max(0, 1 - dragY / sheetHeight) * 0.6 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
          transition: isDragging ? 'none' : 'background-color 300ms ease-out',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 w-full bg-background rounded-t-2xl border-t border-white/[0.08] shadow-2xl',
          'max-h-[92vh] flex flex-col',
          className
        )}
        style={sheetStyle}
      >
        {/* Drag handle — touch target */}
        <div
          className="flex justify-center pt-3 pb-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(dragY)}
          onPointerCancel={(e) => onPointerUp(dragY)}
        >
          <div className={cn(
            'w-10 h-1 rounded-full transition-colors duration-150',
            dragY > 0 ? 'bg-white/40' : 'bg-white/20'
          )} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="overflow-y-auto flex-1 px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
