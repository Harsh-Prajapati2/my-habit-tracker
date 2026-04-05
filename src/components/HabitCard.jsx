import React from 'react';
import { Check, CircleAlert, CircleCheckBig, Clock3, FileText, Flame, Pencil, RotateCcw, Target, Trash2 } from 'lucide-react';

const getStatus = (habit, isCompleted) => {
  if (isCompleted) {
    return {
      label: 'Completed',
      className: 'status-completed',
      icon: <CircleCheckBig className="h-3.5 w-3.5" />,
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sortedTimes = [...(habit.scheduledTimes || [])].sort();

  if (!sortedTimes.length) {
    return {
      label: 'Pending',
      className: 'status-pending',
      icon: <Clock3 className="h-3.5 w-3.5" />,
    };
  }

  const firstTime = sortedTimes[0];
  const [hh, mm] = firstTime.split(':').map(Number);
  const scheduledMinutes = hh * 60 + mm;

  if (currentMinutes > scheduledMinutes) {
    return {
      label: 'Overdue',
      className: 'status-overdue',
      icon: <CircleAlert className="h-3.5 w-3.5" />,
    };
  }

  return {
    label: 'Upcoming',
    className: 'status-upcoming',
    icon: <Clock3 className="h-3.5 w-3.5" />,
  };
};

export default function HabitCard({
  habit,
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
  const sortedTimes = [...(habit.scheduledTimes || [])].sort();
  const primaryTime = sortedTimes[0] || '';

  // Format time to 12-hour format
  const formatTime = (time) => {
    if (!time) return '';
    const [hh, mm] = time.split(':').map(Number);
    const period = hh >= 12 ? 'PM' : 'AM';
    const hour12 = hh % 12 || 12;
    return `${hour12}:${String(mm).padStart(2, '0')} ${period}`;
  };

  return (
    <article 
      className="card group relative"
      style={{ 
        borderTop: `3px solid ${habit.color || 'var(--accent)'}` 
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {primaryTime && (
            <span className="badge badge-neutral badge-pill mb-2 inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatTime(primaryTime)}
            </span>
          )}
          <h3 className="text-lg font-semibold text-[var(--text-primary)] truncate">
            {habit.name}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {habit.category}
          </p>
        </div>
        
        <span className={`badge badge-pill flex-shrink-0 ${status.className}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Description */}
      {habit.description && (
        <p className="mt-3 text-sm text-[var(--text-secondary)] line-clamp-2">
          {habit.description}
        </p>
      )}

      {/* Schedule Times */}
      {sortedTimes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sortedTimes.map((time) => (
            <span
              key={time}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              <Clock3 className="h-3 w-3" />
              {formatTime(time)}
            </span>
          ))}
        </div>
      )}

      {/* Streak */}
      <div className="mt-3 flex items-center">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--warning)]">
          <Flame className="h-4 w-4" />
          {streak} day streak
        </span>
      </div>

      {/* Goal & Notes */}
      {(habit.goal || habit.notes) && (
        <div className="mt-3 space-y-2">
          {habit.goal && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--info)]">
              <Target className="h-3.5 w-3.5" />
              Goal: {habit.goal}
            </div>
          )}
          {habit.notes && (
            <div className="flex items-start gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs text-[var(--text-secondary)]">
              <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-2">{habit.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(habit)}
            className="btn btn-ghost btn-sm"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(habit._id)}
            className="btn btn-sm text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={(!hasUndo && isCompleted) || isMarking}
          onClick={() => (hasUndo && isCompleted ? onUndo(habit._id) : onComplete(habit._id))}
          className={`btn btn-sm press-effect ${
            isCompleted
              ? 'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]'
              : 'btn-primary'
          }`}
        >
          {hasUndo && isCompleted ? (
            <>
              <RotateCcw className="h-4 w-4" />
              Undo
            </>
          ) : isCompleted ? (
            <>
              <Check className="h-4 w-4" />
              Done
            </>
          ) : isMarking ? (
            'Marking...'
          ) : (
            <>
              <Check className="h-4 w-4" />
              Complete
            </>
          )}
        </button>
      </div>
    </article>
  );
}
