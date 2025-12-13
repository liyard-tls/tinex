'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import AddWishlistItemForm from '@/modules/wishlists/AddWishlistItemForm';
import EditWishlistItemForm from '@/modules/wishlists/EditWishlistItemForm';
import WishlistItemComponent from '@/shared/components/ui/WishlistItem';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { wishlistRepository } from '@/core/repositories/WishlistRepository';
import { wishlistItemRepository } from '@/core/repositories/WishlistItemRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import {
  Wishlist,
  WishlistItem,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
  Category,
  UserSettings,
  CURRENCIES,
} from '@/core/models';
import {
  calculateTotalAmount,
  calculateConfirmedAmount,
} from '@/shared/utils/wishlistCalculations';

export default function WishlistDetailPage() {
  const params = useParams();
  const wishlistId = params.id as string;
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, wishlistId]);

  const loadData = async (userId: string) => {
    try {
      const [wishlistData, itemsData, categoriesData, settingsData] = await Promise.all([
        wishlistRepository.getById(wishlistId),
        wishlistItemRepository.getByWishlistId(wishlistId),
        categoryRepository.getByUserId(userId),
        userSettingsRepository.get(userId),
      ]);

      if (!wishlistData || wishlistData.userId !== userId) {
        router.push('/wishlists');
        return;
      }

      setWishlist(wishlistData);
      setItems(itemsData);
      setCategories(categoriesData);
      setUserSettings(settingsData);
      setNewName(wishlistData.name);

      // Calculate totals
      const userCurrency = settingsData?.baseCurrency || 'USD';
      const total = await calculateTotalAmount(itemsData, userCurrency);
      const confirmed = await calculateConfirmedAmount(itemsData, userCurrency);
      setTotalAmount(total);
      setConfirmedAmount(confirmed);
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    }
  };

  const handleAddItem = async (data: CreateWishlistItemInput) => {
    if (!user) return;

    try {
      await wishlistItemRepository.create(user.uid, wishlistId, data);
      await loadData(user.uid);
      setShowAddItemModal(false);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleToggleConfirmed = async (itemId: string) => {
    if (!user) return;

    try {
      await wishlistItemRepository.toggleConfirmed(itemId);
      await loadData(user.uid);
    } catch (error) {
      console.error('Failed to toggle confirmed:', error);
    }
  };

  const handleEditItem = async (data: UpdateWishlistItemInput) => {
    if (!user || !editingItem) return;

    try {
      await wishlistItemRepository.update(editingItem.id, data);
      await loadData(user.uid);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !editingItem) return;

    try {
      await wishlistItemRepository.delete(editingItem.id);
      await loadData(user.uid);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleSaveName = async () => {
    if (!user || !wishlist) return;

    try {
      await wishlistRepository.update(wishlist.id, { name: newName });
      await loadData(user.uid);
      setEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  const handleDeleteWishlist = async () => {
    if (!user || !wishlist) return;
    if (!confirm('Are you sure you want to delete this wishlist? All items will be deleted.'))
      return;

    try {
      await wishlistItemRepository.deleteAllForWishlist(wishlist.id);
      await wishlistRepository.delete(wishlist.id);
      router.push('/wishlists');
    } catch (error) {
      console.error('Failed to delete wishlist:', error);
    }
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
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

  if (!wishlist) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20">
          <p className="text-center text-muted-foreground">Wishlist not found</p>
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
        <div className="mb-6">
          <button
            onClick={() => router.push('/wishlists')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wishlists
          </button>

          <div className="flex items-start justify-between gap-3">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <Check className="h-5 w-5 text-success" />
                </button>
                <button
                  onClick={() => {
                    setNewName(wishlist.name);
                    setEditingName(false);
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-destructive" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-1">{wishlist.name}</h1>
                  {wishlist.description && (
                    <p className="text-sm text-muted-foreground">{wishlist.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleDeleteWishlist}
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Total Amount</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {currencySymbol}
                {totalAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Confirmed</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">
                {currencySymbol}
                {confirmedAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Item Button */}
        <Button onClick={() => setShowAddItemModal(true)} className="w-full mb-4">
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>

        {/* Items List */}
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No items yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Confirmed Items Section */}
            {items.filter(item => item.isConfirmed).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-success mb-2 px-1">Confirmed</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {items
                        .filter(item => item.isConfirmed)
                        .map((item) => {
                          const category = categories.find((c) => c.id === item.categoryId);
                          return (
                            <WishlistItemComponent
                              key={item.id}
                              item={item}
                              category={category}
                              onClick={() => handleToggleConfirmed(item.id)}
                              onEdit={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                              }}
                            />
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other Items Section */}
            {items.filter(item => !item.isConfirmed).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Wishlist</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {items
                        .filter(item => !item.isConfirmed)
                        .map((item) => {
                          const category = categories.find((c) => c.id === item.categoryId);
                          return (
                            <WishlistItemComponent
                              key={item.id}
                              item={item}
                              category={category}
                              onClick={() => handleToggleConfirmed(item.id)}
                              onEdit={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                              }}
                            />
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Add Item Modal */}
      <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add Item</h2>
          <AddWishlistItemForm
            categories={categories}
            onSubmit={handleAddItem}
            defaultCurrency={userCurrency}
          />
        </div>
      </Modal>

      {/* Edit Item Modal */}
      <Modal isOpen={editingItem !== null} onClose={() => setEditingItem(null)}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Edit Item</h2>
          {editingItem && (
            <EditWishlistItemForm
              item={editingItem}
              categories={categories}
              onSubmit={handleEditItem}
              onDelete={handleDeleteItem}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
