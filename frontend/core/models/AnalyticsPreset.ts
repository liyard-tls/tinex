export interface AnalyticsPreset {
  id: string;
  userId: string;
  name: string;
  categoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnalyticsPresetInput {
  name: string;
  categoryIds: string[];
}

export interface UpdateAnalyticsPresetInput {
  id: string;
  name?: string;
  categoryIds?: string[];
}

// Special constant for "All Categories" preset
export const ALL_CATEGORIES_PRESET_ID = '__all__';
