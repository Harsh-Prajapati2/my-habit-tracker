import React from 'react';
import { Check, CircleAlert, CircleCheckBig, Clock3, Flame, Pencil, RotateCcw, Trash2 } from 'lucide-react';

const getStatus = (habit, isCompleted) => {
  if (isCompleted) {
    return {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: <CircleCheckBig className="h-3.5 w-3.5" />,
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sortedTimes = [...(habit.scheduledTimes || [])].sort();

  if (!sortedTimes.length) {
    return {
      label: 'Pending',
      className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
      icon: <Clock3 className="h-3.5 w-3.5" />,
    };
  }

  const firstTime = sortedTimes[0];
  const [hh, mm] = firstTime.split(':').map(Number);
  const scheduledMinutes = hh * 60 + mm;

  if (currentMinutes > scheduledMinutes) {
    return {
      label: 'Overdue',
      className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      icon: <CircleAlert className="h-3.5 w-3.5" />,
    };
  }

  return {
    label: 'Upcoming',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Clock3 className="h-3.5 w-3.5" />,
  };
};

export default function HabitCard({
  habit,
  cardStyle = 'glass',
  streak,
  isCompleted,
  isMarking,
  hasUndo,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
}) {
  const status = getStatus(habit, isCompleted);
  const cardClassByStyle = {
    glass: 'premium-panel rounded-2xl p-4 transition hover:-translate-y-0.5',
    solid:
      'rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900',
    outline:
      'rounded-2xl border-2 border-slate-300 bg-transparent p-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 dark:border-slate-600',
  };
  const cardClass = cardClassByStyle[cardStyle] || cardClassByStyle.glass;

  return (
    <article
      className={cardClass}
      style={{ borderTop: `4px solid ${habit.color || '#3b82f6'}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{habit.name}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{habit.category}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {habit.description ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{habit.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {(habit.scheduledTimes || []).map((time) => (
          <span
            key={time}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
          >
            <Clock3 className="h-3.5 w-3.5" />
            {time}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-300">
          <Flame className="h-3.5 w-3.5" />
          Streak {streak}
        </span>
        {habit.goal ? (
          <span className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            Goal: {habit.goal}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(habit)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(habit._id)}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800/50 dark:text-rose-300 dark:hover:bg-rose-900/30"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>

        <button
          type="button"
          disabled={(!hasUndo && isCompleted) || isMarking}
          onClick={() => (hasUndo && isCompleted ? onUndo(habit._id) : onComplete(habit._id))}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
          }`}
        >
          {hasUndo && isCompleted ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {hasUndo && isCompleted ? 'Undo' : isCompleted ? 'Done' : isMarking ? 'Marking...' : 'Mark'}
        </button>
      </div>
    </article>
  );
}
