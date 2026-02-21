'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, Wrench, Bug, AlertTriangle } from 'lucide-react';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
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
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Changelog"
        description={`Current version: ${APP_VERSION}`}
        onBack={() => router.back()}
      />
      <div className="container max-w-2xl mx-auto p-4">

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
