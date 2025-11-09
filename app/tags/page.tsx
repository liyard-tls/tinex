'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import FAB from '@/shared/components/ui/FAB';
import { Plus, Tag as TagIcon, Trash2, Edit } from 'lucide-react';
import { tagRepository } from '@/core/repositories/TagRepository';
import { Tag, CreateTagInput, TAG_COLORS } from '@/core/models';

export default function TagsPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadTags(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadTags = async (userId: string) => {
    try {
      const userTags = await tagRepository.getByUserId(userId);
      setTags(userTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddTag = async (data: CreateTagInput) => {
    if (!user) return;

    try {
      await tagRepository.create(user.uid, data);
      await loadTags(user.uid);
      setShowAddTag(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw error;
    }
  };

  const handleUpdateTag = async (data: CreateTagInput) => {
    if (!user || !editingTag) return;

    try {
      await tagRepository.update({ id: editingTag.id, ...data });
      await loadTags(user.uid);
      setEditingTag(null);
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this tag?')) return;

    try {
      await tagRepository.delete(tagId);
      await loadTags(user.uid);
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Tags</h1>
          <p className="text-xs text-muted-foreground">Label and organize your transactions</p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {tags.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <TagIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No Tags Yet</CardTitle>
              <CardDescription className="mb-4">
                Create tags to label and organize your transactions
              </CardDescription>
              <Button onClick={() => setShowAddTag(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Tag
              </Button>
            </CardContent>
          </Card>
        )}

        {tags.length > 0 && (
          <div className="grid gap-2">
            {tags.map((tag) => (
              <Card key={tag.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-3 h-8 rounded"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex items-center gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingTag(tag)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <FAB className="bottom-24 right-4" onClick={() => setShowAddTag(true)}>
        <Plus className="h-6 w-6" />
      </FAB>

      <Modal
        isOpen={showAddTag}
        onClose={() => setShowAddTag(false)}
        title="Create Tag"
      >
        <TagForm onSubmit={handleAddTag} onCancel={() => setShowAddTag(false)} />
      </Modal>

      <Modal
        isOpen={!!editingTag}
        onClose={() => setEditingTag(null)}
        title="Edit Tag"
      >
        {editingTag && (
          <TagForm
            initialData={editingTag}
            onSubmit={handleUpdateTag}
            onCancel={() => setEditingTag(null)}
          />
        )}
      </Modal>

      <BottomNav />
    </div>
  );
}

function TagForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData?: Tag;
  onSubmit: (data: CreateTagInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || TAG_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), color });
      setName('');
      setColor(TAG_COLORS[0]);
    } catch (error) {
      console.error('Failed to save tag:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Tag Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter tag name"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="grid grid-cols-7 gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-md transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading || !name.trim()}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
