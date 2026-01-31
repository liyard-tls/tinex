'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Wrench, Bug, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import BottomNav from '@/shared/components/layout/BottomNav';
import { CHANGELOG, APP_VERSION, getChangeTypeConfig } from '@/shared/config/version';
import { cn } from '@/shared/utils/cn';
import { format, parseISO } from 'date-fns';

const typeIcons = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
  breaking: AlertTriangle,
};

export default function ChangelogPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Changelog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Current version: {APP_VERSION}
          </p>
        </div>

        {/* Changelog Entries */}
        <div className="space-y-6">
          {CHANGELOG.map((entry, index) => (
            <div
              key={entry.version}
              className={cn(
                'bg-card rounded-xl border border-border overflow-hidden',
                index === 0 && 'border-primary/50'
              )}
            >
              {/* Version Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">v{entry.version}</span>
                    {index === 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Latest
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(entry.date), 'MMM d, yyyy')}
                  </span>
                </div>
                {entry.title && (
                  <p className="text-sm text-muted-foreground mt-1">{entry.title}</p>
                )}
              </div>

              {/* Changes List */}
              <div className="p-4 space-y-2">
                {entry.changes.map((change, changeIndex) => {
                  const config = getChangeTypeConfig(change.type);
                  const Icon = typeIcons[change.type];

                  return (
                    <div
                      key={changeIndex}
                      className="flex items-start gap-3"
                    >
                      <div className={cn(
                        'flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 mt-0.5',
                        config.color
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{change.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {CHANGELOG.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No changelog entries yet.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
