'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Pencil, Check, MoreHorizontal } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import { AnalyticsPreset, Category, ALL_CATEGORIES_PRESET_ID } from '@/core/models';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS } from '@/shared/config/icons';

interface PresetSelectorProps {
  presets: AnalyticsPreset[];
  activePresetId: string | null;
  categories: Category[];
  onSelectPreset: (presetId: string | null) => void;
  onCreatePreset: (name: string, categoryIds: string[]) => Promise<void>;
  onUpdatePreset: (id: string, name: string, categoryIds: string[]) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
}

export default function PresetSelector({
  presets,
  activePresetId,
  categories,
  onSelectPreset,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
}: PresetSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AnalyticsPreset | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Get active preset name
  const getActivePresetName = () => {
    if (!activePresetId || activePresetId === ALL_CATEGORIES_PRESET_ID) {
      return 'All Categories';
    }
    const preset = presets.find((p) => p.id === activePresetId);
    return preset?.name || 'All Categories';
  };

  // Filter categories for selection (only expense categories typically matter for analytics)
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const handleSelectPreset = (presetId: string | null) => {
    onSelectPreset(presetId);
    setIsExpanded(false);
  };

  const openAddModal = () => {
    setNewPresetName('');
    setSelectedCategoryIds([]);
    setEditingPreset(null);
    setShowAddModal(true);
  };

  const openEditModal = (preset: AnalyticsPreset) => {
    setNewPresetName(preset.name);
    setSelectedCategoryIds(preset.categoryIds);
    setEditingPreset(preset);
    setShowAddModal(true);
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectAllExpense = () => {
    const allExpenseIds = expenseCategories.map((c) => c.id);
    const allSelected = allExpenseIds.every((id) => selectedCategoryIds.includes(id));
    if (allSelected) {
      setSelectedCategoryIds((prev) => prev.filter((id) => !allExpenseIds.includes(id)));
    } else {
      setSelectedCategoryIds((prev) => [...new Set([...prev, ...allExpenseIds])]);
    }
  };

  const handleSelectAllIncome = () => {
    const allIncomeIds = incomeCategories.map((c) => c.id);
    const allSelected = allIncomeIds.every((id) => selectedCategoryIds.includes(id));
    if (allSelected) {
      setSelectedCategoryIds((prev) => prev.filter((id) => !allIncomeIds.includes(id)));
    } else {
      setSelectedCategoryIds((prev) => [...new Set([...prev, ...allIncomeIds])]);
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim() || selectedCategoryIds.length === 0) return;

    setLoading(true);
    try {
      if (editingPreset) {
        await onUpdatePreset(editingPreset.id, newPresetName.trim(), selectedCategoryIds);
      } else {
        await onCreatePreset(newPresetName.trim(), selectedCategoryIds);
      }
      setShowAddModal(false);
      setNewPresetName('');
      setSelectedCategoryIds([]);
      setEditingPreset(null);
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      await onDeletePreset(presetId);
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
  };

  return (
    <>
      {/* Preset Selector Card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Preset</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{getActivePresetName()}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Hint text */}
        {!isExpanded && (
          <div className="px-4 pb-2 -mt-1">
            <p className="text-xs text-muted-foreground/60">Tap to select</p>
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border">
            {/* All Categories option */}
            <button
              onClick={() => handleSelectPreset(null)}
              className={cn(
                'w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors',
                (!activePresetId || activePresetId === ALL_CATEGORIES_PRESET_ID) && 'bg-primary/10'
              )}
            >
              <span className="text-sm">All Categories</span>
              {(!activePresetId || activePresetId === ALL_CATEGORIES_PRESET_ID) && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>

            {/* User presets */}
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  'flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-t border-border/50',
                  activePresetId === preset.id && 'bg-primary/10'
                )}
              >
                <button
                  onClick={() => handleSelectPreset(preset.id)}
                  className="flex-1 text-left"
                >
                  <span className="text-sm">{preset.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({preset.categoryIds.length} categories)
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {activePresetId === preset.id && (
                    <Check className="h-4 w-4 text-primary mr-2" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(preset);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePreset(preset.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add preset button */}
            <button
              onClick={openAddModal}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/30 transition-colors border-t border-border/50 text-primary"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Preset</span>
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Preset Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingPreset(null);
        }}
        title={editingPreset ? 'Edit Preset' : 'Create Preset'}
      >
        <div className="space-y-4">
          {/* Preset Name */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Preset Name</label>
            <input
              type="text"
              placeholder="e.g., Daily Expenses"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Categories</label>

            <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-1">
            {/* Expense Categories */}
            {expenseCategories.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Expense Categories
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllExpense}
                    className="text-xs text-primary hover:underline"
                  >
                    {expenseCategories.every((c) => selectedCategoryIds.includes(c.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {expenseCategories.map((category) => {
                    const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          'px-3 py-2 rounded-md text-sm text-left transition-colors border',
                          selectedCategoryIds.includes(category.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <IconComponent className="h-3.5 w-3.5" style={{ color: category.color }} />
                          </div>
                          <span className="truncate">{category.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Income Categories */}
            {incomeCategories.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Income Categories
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllIncome}
                    className="text-xs text-primary hover:underline"
                  >
                    {incomeCategories.every((c) => selectedCategoryIds.includes(c.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {incomeCategories.map((category) => {
                    const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          'px-3 py-2 rounded-md text-sm text-left transition-colors border',
                          selectedCategoryIds.includes(category.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <IconComponent className="h-3.5 w-3.5" style={{ color: category.color }} />
                          </div>
                          <span className="truncate">{category.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Selected count */}
          <p className="text-xs text-muted-foreground">
            {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? 'y' : 'ies'} selected
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddModal(false);
                setEditingPreset(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSavePreset}
              disabled={loading || !newPresetName.trim() || selectedCategoryIds.length === 0}
            >
              {loading ? 'Saving...' : editingPreset ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
