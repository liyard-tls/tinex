'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import { CreateWishlistInput } from '@/core/models';

interface AddWishlistFormProps {
  onSubmit: (data: CreateWishlistInput) => Promise<void>;
}

export default function AddWishlistForm({ onSubmit }: AddWishlistFormProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateWishlistInput>();

  const handleFormSubmit = async (data: CreateWishlistInput) => {
    setLoading(true);
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error('Failed to add wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name *
        </label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g., Travel Gear, New Setup"
        />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Input
          id="description"
          {...register('description')}
          placeholder="Optional description"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : 'Create Wishlist'}
      </Button>
    </form>
  );
}
