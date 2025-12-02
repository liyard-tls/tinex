/**
 * AccountSelect Component
 * Custom dropdown for selecting accounts with icons and visual indicators
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Account } from '@/core/models';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { CURRENCIES } from '@/core/models/account';
import { cn } from '@/shared/utils/cn';
import { MoreHorizontal } from 'lucide-react';

interface AccountSelectProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  error,
  label = 'Account',
  required = false,
}: AccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedAccount = accounts.find((acc) => acc.id === value);

  const getAccountIcon = (account: Account) => {
    const iconName = account.icon || 'Wallet';
    return CATEGORY_ICONS[iconName as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="text-xs font-medium mb-1.5 block">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors',
          error ? 'border-destructive' : 'border-input',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        disabled={disabled}
      >
        {selectedAccount ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Account Icon */}
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${selectedAccount.color || '#6b7280'}20` }}
            >
              {(() => {
                const IconComponent = getAccountIcon(selectedAccount);
                return (
                  <IconComponent
                    className="h-3 w-3"
                    style={{ color: selectedAccount.color || '#6b7280' }}
                  />
                );
              })()}
            </div>

            {/* Account Info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{selectedAccount.name}</span>
              <span className="text-muted-foreground text-xs flex-shrink-0">
                ({getCurrencySymbol(selectedAccount.currency)})
              </span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select account</span>
        )}

        {/* Dropdown Arrow */}
        <svg
          className={cn(
            'h-4 w-4 transition-transform flex-shrink-0 ml-2',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-60 overflow-auto">
          {accounts.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">No accounts available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create an account first
              </p>
            </div>
          ) : (
            accounts.map((account) => {
              const IconComponent = getAccountIcon(account);
              const isSelected = account.id === value;

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    onChange(account.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-muted transition-colors',
                    isSelected && 'bg-muted'
                  )}
                >
                  {/* Account Icon */}
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${account.color || '#6b7280'}20` }}
                  >
                    <IconComponent
                      className="h-4 w-4"
                      style={{ color: account.color || '#6b7280' }}
                    />
                  </div>

                  {/* Account Details */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{account.name}</span>
                      {account.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getCurrencySymbol(account.currency)} {account.balance.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Error Message */}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
