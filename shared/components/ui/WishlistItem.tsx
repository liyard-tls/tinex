/**
 * Wishlist Item Component
 * Reusable wishlist item for lists
 */

"use client";

import { WishlistItem as WishlistItemType, Category } from "@/core/models";
import { CATEGORY_ICONS } from "@/shared/config/icons";
import { MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { CURRENCIES } from "@/core/models";

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string) => {
  return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
};

interface WishlistItemProps {
  item: WishlistItemType;
  category?: Category;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
}

export default function WishlistItem({
  item,
  category,
  onClick,
  onEdit,
}: WishlistItemProps) {
  const IconComponent = category
    ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] ||
      MoreHorizontal
    : MoreHorizontal;

  const currencySymbol = getCurrencySymbol(item.currency);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 relative overflow-hidden transition-colors cursor-pointer",
        item.isConfirmed
          ? "hover:bg-success/10 bg-success/5"
          : "hover:bg-muted/30"
      )}
    >
      {/* Side gradient bar */}
      {category && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{
            background: item.isConfirmed
              ? `linear-gradient(to bottom, #10b981, #10b98180)`
              : `linear-gradient(to bottom, ${category.color}, ${category.color}80)`,
          }}
        />
      )}

      {/* Category icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
        style={{
          backgroundColor: category ? `${category.color}20` : "#6b728020",
        }}
      >
        <IconComponent
          className="h-5 w-5"
          style={{ color: category?.color || "#6b7280" }}
        />
      </div>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            item.isConfirmed && "text-success"
          )}
        >
          {item.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {category && (
            <p className="text-xs text-muted-foreground">{category.name}</p>
          )}
        </div>
      </div>

      {/* Amount */}
      <p
        className={cn(
          "text-sm font-semibold flex-shrink-0",
          item.isConfirmed && "text-success"
        )}
      >
        {currencySymbol} {item.amount.toFixed(2)}
      </p>

      {/* Edit Button */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 hover:bg-muted rounded transition-colors"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
