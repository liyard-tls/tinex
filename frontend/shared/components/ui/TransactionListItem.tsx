/**
 * Transaction List Item Component
 * Reusable transaction card for lists
 */

"use client";

import { useRouter } from "next/navigation";
import { Transaction, Category, Tag } from "@/core/models";
import { CATEGORY_ICONS } from "@/shared/config/icons";
import { MoreHorizontal, Clock } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { CURRENCIES } from "@/core/models";

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string) => {
  return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
};

interface TransactionListItemProps {
  transaction: Transaction;
  category?: Category;
  tags?: Tag[];
  accountName?: string;
  returnTo?: string;
  onClick?: (e: React.MouseEvent) => void;
  onCategoryIconClick?: (e: React.MouseEvent, transaction: Transaction) => void;
}

export default function TransactionListItem({
  transaction,
  category,
  tags = [],
  accountName,
  returnTo,
  onClick,
  onCategoryIconClick,
}: TransactionListItemProps) {
  const router = useRouter();
  const IconComponent = category
    ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] ||
      MoreHorizontal
    : MoreHorizontal;

  const txnDate = transaction.date instanceof Date
    ? transaction.date
    : (transaction.date as { toDate: () => Date }).toDate();
  const isFuture = txnDate > new Date();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    } else {
      const returnUrl = returnTo || "/transactions";
      router.push(
        `/transactions/${transaction.id}?returnTo=${encodeURIComponent(
          returnUrl
        )}`
      );
    }
  };

  const handleCategoryClick = (e: React.MouseEvent) => {
    if (onCategoryIconClick) {
      e.stopPropagation();
      onCategoryIconClick(e, transaction);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer",
        isFuture && "opacity-60"
      )}
    >
      {/* Side gradient bar */}
      {category && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{
            background: `linear-gradient(to bottom, ${category.color}, ${category.color}80)`,
          }}
        />
      )}

      {/* Category icon */}
      <div
        onClick={handleCategoryClick}
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2",
          onCategoryIconClick &&
            "hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
        )}
        style={{
          backgroundColor: category ? `${category.color}20` : "#6b728020",
        }}
        title={onCategoryIconClick ? "Click to change category" : undefined}
      >
        <IconComponent
          className="h-5 w-5"
          style={{ color: category?.color || "#6b7280" }}
        />
      </div>

      {/* Transaction details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {transaction.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {isFuture && <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          <p className="text-xs text-muted-foreground">
            {txnDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </p>
          {accountName && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <p className="text-xs text-muted-foreground">{accountName}</p>
            </>
          )}
          {category && <span className="text-xs text-muted-foreground">•</span>}
          {category && (
            <p className="text-xs text-muted-foreground">{category.name}</p>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Amount */}
      <p
        className={cn(
          "text-sm font-semibold flex-shrink-0",
          transaction.type === "income" ? "text-success" : "text-destructive"
        )}
      >
        {transaction.type === "income" ? "+" : "-"}
        {getCurrencySymbol(transaction.currency)}{" "}
        {transaction.amount.toFixed(2)}
      </p>
    </div>
  );
}
