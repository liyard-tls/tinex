'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import AddWishlistForm from '@/modules/wishlists/AddWishlistForm';
import { Plus, ChevronDown } from 'lucide-react';
import { wishlistRepository } from '@/core/repositories/WishlistRepository';
import { wishlistItemRepository } from '@/core/repositories/WishlistItemRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import {
  Wishlist,
  WishlistItem,
  CreateWishlistInput,
  UserSettings,
  CURRENCIES,
} from '@/core/models';
import { calculateTotalAmount } from '@/shared/utils/wishlistCalculations';

export default function WishlistsPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Record<string, WishlistItem[]>>({});
  const [wishlistTotals, setWishlistTotals] = useState<Record<string, number>>({});
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedWishlists, setExpandedWishlists] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadData(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const [wishlistsData, settingsData] = await Promise.all([
        wishlistRepository.getAll(userId),
        userSettingsRepository.get(userId),
      ]);

      setWishlists(wishlistsData);
      setUserSettings(settingsData);

      // Load items for each wishlist
      const itemsMap: Record<string, WishlistItem[]> = {};
      const totalsMap: Record<string, number> = {};

      for (const wishlist of wishlistsData) {
        const items = await wishlistItemRepository.getByWishlistId(wishlist.id);
        itemsMap[wishlist.id] = items;

        // Calculate total
        const userCurrency = settingsData?.baseCurrency || 'USD';
        const total = await calculateTotalAmount(items, userCurrency);
        totalsMap[wishlist.id] = total;
      }

      setWishlistItems(itemsMap);
      setWishlistTotals(totalsMap);
    } catch (error) {
      console.error('Failed to load wishlists:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const userCurrency = userSettings?.baseCurrency || 'USD';
  const currencySymbol = getCurrencySymbol(userCurrency);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Wishlists</h1>
            <p className="text-sm text-muted-foreground">Track items you want to buy</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

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
