/**
 * Category Select Component
 * Reusable dropdown for selecting categories with icons
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Category } from '@/core/models';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface CategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function CategorySelect({
  categories,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Select category',
  label = 'Category',
  required = false,
}: CategorySelectProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const selectedCategory = categories.find((c) => c.id === value);

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-xs font-medium mb-1.5 block">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-destructive' : 'border-input'
        )}
        disabled={disabled}
      >
        {selectedCategory ? (
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent =
                CATEGORY_ICONS[selectedCategory.icon as keyof typeof CATEGORY_ICONS] ||
                MoreHorizontal;
              return (
                <>
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${selectedCategory.color}20` }}
                  >
                    <IconComponent
                      className="h-3 w-3"
                      style={{ color: selectedCategory.color }}
                    />
                  </div>
                  <span>{selectedCategory.name}</span>
                </>
              );
            })()}
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <svg
          className={cn('h-4 w-4 transition-transform', showDropdown && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-60 overflow-auto">
          {categories.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No categories available
            </div>
          ) : (
            categories.map((cat) => {
              const IconComponent =
                CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat.id)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors',
                    value === cat.id && 'bg-muted'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <IconComponent className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <span>{cat.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
