import React, { useMemo } from 'react';
import HabitCard from './HabitCard';
import { Plus } from 'lucide-react';

const getSortWeight = (habit, isCompleted) => {
  if (isCompleted) return 2;

  const firstTime = (habit.scheduledTimes || [])[0];
  if (!firstTime) return 1;

  const [h, m] = firstTime.split(':').map(Number);
  const scheduled = h * 60 + m;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return current > scheduled ? 0 : 1;
};

export default function HabitList({
  habits,
  loading,
  completedHabitIds,
  completionByHabitId,
  streakByHabitId,
  activeHabitId,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
  onCreateFirst,
}) {
  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => {
      const aDone = completedHabitIds.has(a._id);
      const bDone = completedHabitIds.has(b._id);

      const weightA = getSortWeight(a, aDone);
      const weightB = getSortWeight(b, bDone);

      if (weightA !== weightB) return weightA - weightB;
      return (a.scheduledTimes?.[0] || '').localeCompare(b.scheduledTimes?.[0] || '');
    });
  }, [habits, completedHabitIds]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-44 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (!sortedHabits.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Plus className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </div>
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No habits yet</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Start with one habit and build momentum every day.</p>
        <button
          type="button"
          onClick={onCreateFirst}
          className="btn btn-primary mt-4"
        >
          Create Your First Habit
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sortedHabits.map((habit) => (
        <HabitCard
          key={habit._id}
          habit={habit}
          streak={streakByHabitId?.[habit._id] || 0}
          isCompleted={completedHabitIds.has(habit._id)}
          hasUndo={Boolean(completionByHabitId?.[habit._id])}
          isMarking={activeHabitId === habit._id}
          onComplete={onComplete}
          onUndo={onUndo}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
