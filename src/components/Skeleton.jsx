import React from 'react';
import clsx from 'clsx';

export function Skeleton({ className }) {
  return <div className={clsx('shimmer-bg rounded-lg', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border-soft rounded-2xl p-5 flex flex-col gap-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-soft">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <Skeleton className="h-3 flex-1 max-w-[140px]" />
      <Skeleton className="h-3 flex-1 max-w-[100px]" />
      <Skeleton className="h-3 flex-1 max-w-[80px]" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border-soft rounded-2xl p-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
