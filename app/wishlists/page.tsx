'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import AddWishlistForm from '@/modules/wishlists/AddWishlistForm';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';
import PageHeader from '@/shared/components/layout/PageHeader';
import { wishlistRepository } from '@/core/repositories/WishlistRepository';
import { wishlistItemRepository } from '@/core/repositories/WishlistItemRepository';
import {
  Wishlist,
  WishlistItem,
  CreateWishlistInput,
  CURRENCIES,
} from '@/core/models';
import { calculateTotalAmount } from '@/shared/utils/wishlistCalculations';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';

export default function WishlistsPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const { userSettings, dataLoading } = useAppData();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Record<string, WishlistItem[]>>({});
  const [wishlistTotals, setWishlistTotals] = useState<Record<string, number>>({});
  const [wishlistsLoading, setWishlistsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedWishlists, setExpandedWishlists] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.uid) {
      loadData(user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const loadData = async (userId: string) => {
    setWishlistsLoading(true);
    try {
      const wishlistsData = await wishlistRepository.getAll(userId);
      setWishlists(wishlistsData);

      // Load items for each wishlist
      const itemsMap: Record<string, WishlistItem[]> = {};
      const totalsMap: Record<string, number> = {};

      for (const wishlist of wishlistsData) {
        const items = await wishlistItemRepository.getByWishlistId(wishlist.id);
        itemsMap[wishlist.id] = items;

        const userCurrency = userSettings?.baseCurrency || 'USD';
        const total = await calculateTotalAmount(items, userCurrency);
        totalsMap[wishlist.id] = total;
      }

      setWishlistItems(itemsMap);
      setWishlistTotals(totalsMap);
    } catch (error) {
      console.error('Failed to load wishlists:', error);
    } finally {
      setWishlistsLoading(false);
    }
  };

  const handleAddWishlist = async (data: CreateWishlistInput) => {
    if (!user) return;

    try {
      await wishlistRepository.create(user.uid, data);
      await loadData(user.uid);
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to create wishlist:', error);
    }
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  const toggleExpanded = (wishlistId: string) => {
    const newExpanded = new Set(expandedWishlists);
    if (newExpanded.has(wishlistId)) {
      newExpanded.delete(wishlistId);
    } else {
      newExpanded.add(wishlistId);
    }
    setExpandedWishlists(newExpanded);
  };

  if (authLoading || dataLoading || wishlistsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20 flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const userCurrency = userSettings?.baseCurrency || 'USD';
  const currencySymbol = getCurrencySymbol(userCurrency);

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Wishlists"
        description="Track items you want to buy"
        rightElement={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        }
      />
      <div className="container max-w-2xl mx-auto p-4">

        {/* Wishlists */}
        {wishlists.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No wishlists yet</p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first wishlist
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {wishlists.map((wishlist) => {
              const items = wishlistItems[wishlist.id] || [];
              const total = wishlistTotals[wishlist.id] || 0;
              const isExpanded = expandedWishlists.has(wishlist.id);
              const displayItems = isExpanded ? items : items.slice(0, 3);
              const hasMore = items.length > 3;

              return (
                <Card key={wishlist.id} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/wishlists/${wishlist.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{wishlist.name}</CardTitle>
                      <p className="text-lg font-semibold text-primary">
                        {currencySymbol}
                        {total.toFixed(2)}
                      </p>
                    </div>
                  </CardHeader>

                  {items.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {displayItems.map((item) => {
                          const itemCurrencySymbol = getCurrencySymbol(item.currency);

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                            >
                              <span className="text-foreground">{item.name}</span>
                              <span className="text-muted-foreground">
                                {itemCurrencySymbol}
                                {item.amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {hasMore && !isExpanded && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(wishlist.id);
                          }}
                          className="w-full mt-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                        >
                          Show more ({items.length - 3} more)
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Add Wishlist Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Create Wishlist</h2>
          <AddWishlistForm onSubmit={handleAddWishlist} />
        </div>
      </Modal>
    </div>
  );
}
