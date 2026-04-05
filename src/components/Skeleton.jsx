import React from 'react';

// Skeleton base component with shimmer animation
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`}
      {...props}
    />
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="mt-4 h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-16" />
    </div>
  );
}

// Habit card skeleton
export function HabitCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="mt-3 h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
      
      <div className="mt-4">
        <Skeleton className="h-4 w-24" />
      </div>
      
      <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-10" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

// Working task section skeleton
export function WorkingTaskSkeleton() {
  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-36" />
          <Skeleton className="mt-2 h-4 w-52" />
          <Skeleton className="mt-4 h-12 w-full" />
        </div>
        
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-10 w-full" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      </div>
      
      <div className="mt-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          <Skeleton className="h-8 w-36 flex-shrink-0" />
          <Skeleton className="h-8 w-36 flex-shrink-0" />
          <Skeleton className="h-8 w-36 flex-shrink-0" />
        </div>
      </div>
    </section>
  );
}

// Dashboard stats skeleton (4 cards)
export function DashboardStatsSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

// Habit list skeleton
export function HabitListSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <HabitCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Full dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <WorkingTaskSkeleton />
      <DashboardStatsSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Skeleton className="mb-4 h-7 w-32" />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <HabitListSkeleton count={6} />
      </div>
    </div>
  );
}

export default {
  Skeleton,
  StatCardSkeleton,
  HabitCardSkeleton,
  WorkingTaskSkeleton,
  DashboardStatsSkeleton,
  HabitListSkeleton,
  DashboardSkeleton,
};
