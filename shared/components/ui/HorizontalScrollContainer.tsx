/**
 * Horizontal Scroll Container Component
 * Container with custom styled scrollbar for horizontal scrolling
 */

"use client";

import { cn } from "@/shared/utils/cn";

interface HorizontalScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Show subtle black gradient fades at left and right edges */
  edgeFade?: boolean;
}

export default function HorizontalScrollContainer({
  children,
  className,
  edgeFade = true,
}: HorizontalScrollContainerProps) {
  return (
    <div className={cn("relative", className)}>
      {edgeFade && (
        <>
          <div className="pointer-events-none absolute inset-y-0 -left-6 w-8 bg-gradient-to-r from-black/60 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 -right-6 w-8 bg-gradient-to-l from-black/80 to-transparent" />
        </>
      )}

      <div
        className={cn(
          "overflow-x-auto -mx-4 px-4 pb-2",
          // Custom scrollbar styles
          "[&::-webkit-scrollbar]:h-1.5",
          "[&::-webkit-scrollbar]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50"
        )}
      >
        {children}
      </div>
    </div>
  );
}
