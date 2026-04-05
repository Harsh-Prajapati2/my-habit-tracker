import React, { useMemo } from 'react';
import HabitCard from './HabitCard';

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
  habitCardStyle = 'glass',
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
          <div key={idx} className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
        ))}
      </div>
    );
  }

  if (!sortedHabits.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-lg font-medium text-slate-700 dark:text-slate-100">You haven&apos;t created any habits yet.</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Start with one habit and build momentum every day.</p>
        <button
          type="button"
          onClick={onCreateFirst}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
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
          cardStyle={habitCardStyle}
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
