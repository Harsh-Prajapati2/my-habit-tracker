import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  Flame,
  ListTodo,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useDashboard from '../hooks/useDashboard';
import { useDebouncedValue } from '../hooks/useDebounce';
import { useToast } from '../components/Toast';
import HabitList from '../components/HabitList';
import AddHabitModal from '../components/AddHabitModal';
import ConnectionStatus from '../components/ConnectionStatus';
import { DashboardSkeleton } from '../components/Skeleton';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORKING_WINDOW_MINUTES = 12;
const UPCOMING_SOON_MINUTES = 25;

const toMinutes = (time) => {
  if (typeof time !== 'string') return null;
  const [hh, mm] = time.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const formatScheduleTime = (time) => {
  if (typeof time !== 'string') return time;
  const [hh, mm] = time.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return time;
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  return `${hour12}:${String(mm).padStart(2, '0')} ${period}`;
};

const formatMinutesDiff = (minutes) => {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!remaining) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
};

const getTodayTaskEntries = (habits, completedHabitIds, nowDate) => {
  const today = WEEK_DAYS[nowDate.getDay()];
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  return habits
    .flatMap((habit) =>
      (habit.scheduledTimes || []).map((time) => ({
        habit,
        time,
        minutes: toMinutes(time),
      }))
    )
    .filter((entry) => {
      if (entry.minutes === null) return false;
      const repeatDays = entry.habit.repeatDays || [];
      if (!repeatDays.length) return true;
      return repeatDays.includes(today);
    })
    .sort((a, b) => a.minutes - b.minutes)
    .map((entry) => {
      const isCompleted = completedHabitIds.has(entry.habit._id);
      return {
        ...entry,
        isCompleted,
        isOverdue: !isCompleted && entry.minutes < nowMinutes,
      };
    });
};

const getWorkingTaskByTime = (timelineEntries, nowMinutes) => {
  if (!timelineEntries.length) return null;
  const pendingEntries = timelineEntries.filter((entry) => !entry.isCompleted);

  if (!pendingEntries.length) {
    return {
      ...timelineEntries[timelineEntries.length - 1],
      state: 'done',
      deltaMinutes: 0,
    };
  }

  const overdueEntries = pendingEntries.filter((entry) => entry.minutes <= nowMinutes);
  if (overdueEntries.length) {
    const overdueEntry = overdueEntries[overdueEntries.length - 1];
    return {
      ...overdueEntry,
      state: 'overdue',
      deltaMinutes: nowMinutes - overdueEntry.minutes,
    };
  }

  const nowEntry = pendingEntries.find((entry) => Math.abs(entry.minutes - nowMinutes) <= WORKING_WINDOW_MINUTES);
  if (nowEntry) {
    return {
      ...nowEntry,
      state: 'working',
      deltaMinutes: Math.abs(nowEntry.minutes - nowMinutes),
    };
  }

  const upcomingEntry = pendingEntries[0];
  if (upcomingEntry) {
    const deltaMinutes = upcomingEntry.minutes - nowMinutes;
    return {
      ...upcomingEntry,
      state: deltaMinutes <= UPCOMING_SOON_MINUTES ? 'working' : 'upcoming',
      deltaMinutes,
    };
  }

  return {
    ...timelineEntries[timelineEntries.length - 1],
    state: 'done',
    deltaMinutes: 0,
  };
};

const getHabitStatus = (habit, completedHabitIds) => {
  if (completedHabitIds.has(habit._id)) return 'completed';
  const firstTime = [...(habit?.scheduledTimes || [])].sort()[0];
  if (!firstTime) return 'pending';
  const scheduledMinutes = toMinutes(firstTime);
  if (scheduledMinutes === null) return 'pending';
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes > scheduledMinutes) return 'overdue';
  return 'upcoming';
};

export default function DashboardOptimized() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Unified dashboard hook - single source of truth
  const {
    habits,
    stats,
    completedHabitIds,
    completionByHabitId,
    loading,
    error,
    isOnline,
    isSyncing,
    pendingActions,
    fetchDashboard,
    completeHabit,
    undoCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
  } = useDashboard();

  // Local UI state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [submittingHabit, setSubmittingHabit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeTick, setTimeTick] = useState(Date.now());
  const [activeHabitId, setActiveHabitId] = useState('');

  const workingTaskToastKeyRef = useRef('');

  // Debounced search for better performance
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Time ticker (every minute)
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openCreateModal = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  const openEditModal = (habit) => {
    setEditingHabit(habit);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingHabit(null);
  };

  const handleSaveHabit = async (payload) => {
    const habitName = payload?.name?.trim() || 'Habit';
    try {
      setSubmittingHabit(true);
      if (editingHabit?._id) {
        await updateHabit(editingHabit._id, payload);
        toast.success('Habit updated', habitName);
      } else {
        await createHabit(payload);
        toast.success('Habit created', habitName);
      }
      closeModal();
    } catch (err) {
      toast.error('Save failed', err?.response?.data?.message || 'Failed to save habit');
    } finally {
      setSubmittingHabit(false);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    const habit = habits.find((h) => h._id === habitId);
    const habitName = habit?.name || 'Habit';
    try {
      await deleteHabit(habitId);
      toast.success('Habit deleted', habitName, {
        undoAction: () => {
          // Undo would need to re-create - for simplicity we just show info
          toast.info('Undo not available', 'Please recreate the habit');
        },
      });
    } catch (err) {
      toast.error('Delete failed', err?.response?.data?.message || 'Failed to delete habit');
    }
  };

  const handleCompleteHabit = async (habitId) => {
    const habit = habits.find((h) => h._id === habitId);
    const habitName = habit?.name || 'Habit';
    try {
      setActiveHabitId(habitId);
      const result = await completeHabit(habitId);
      
      if (result.alreadyCompleted) {
        toast.info('Already completed', habitName);
      } else if (result.queued) {
        toast.info('Queued for sync', `${habitName} will sync when online`);
      } else {
        toast.success('Habit completed! 🎉', habitName);
      }
    } catch (err) {
      toast.error('Complete failed', err?.response?.data?.message || 'Failed to mark habit complete');
    } finally {
      setActiveHabitId('');
    }
  };

  const handleUndoCompletion = async (habitId) => {
    const habit = habits.find((h) => h._id === habitId);
    const habitName = habit?.name || 'Habit';
    try {
      await undoCompletion(habitId);
      toast.info('Completion undone', habitName);
    } catch (err) {
      toast.error('Undo failed', err?.response?.data?.message || 'Failed to undo completion');
    }
  };

  // Computed values
  const completionRate = useMemo(() => {
    if (!stats.totalHabits) return 0;
    return Math.round((stats.completedToday / stats.totalHabits) * 100);
  }, [stats.completedToday, stats.totalHabits]);

  const focusScore = useMemo(() => {
    const weekly = stats.weeklyProgress || 0;
    return Math.round(completionRate * 0.65 + weekly * 0.35);
  }, [completionRate, stats.weeklyProgress]);

  const filteredHabits = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return habits.filter((habit) => {
      const status = getHabitStatus(habit, completedHabitIds);
      const matchesQuery = !query || 
        habit.name.toLowerCase().includes(query) || 
        habit.category.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [completedHabitIds, habits, debouncedSearch, statusFilter]);

  const { timelineEntries, workingTask } = useMemo(() => {
    const currentDate = new Date(timeTick);
    const nowMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const todayEntries = getTodayTaskEntries(habits, completedHabitIds, currentDate);
    return {
      timelineEntries: todayEntries,
      workingTask: getWorkingTaskByTime(todayEntries, nowMinutes),
    };
  }, [habits, completedHabitIds, timeTick]);

  const currentTimeLabel = useMemo(
    () => new Date(timeTick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [timeTick]
  );

  const todayTaskSummary = useMemo(() => {
    const total = timelineEntries.length;
    const completed = timelineEntries.filter((entry) => entry.isCompleted).length;
    const overdue = timelineEntries.filter((entry) => entry.isOverdue).length;
    return { total, completed, overdue, pending: Math.max(total - completed, 0) };
  }, [timelineEntries]);

  const workingTaskMeta = useMemo(() => {
    if (!workingTask) return null;
    if (workingTask.state === 'working') {
      return {
        badge: 'Do This Now',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        helperText: workingTask.deltaMinutes === 0
          ? 'Scheduled for this exact moment'
          : `Starts in ${formatMinutesDiff(workingTask.deltaMinutes)}`,
      };
    }
    if (workingTask.state === 'upcoming') {
      return {
        badge: 'Upcoming Task',
        badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
        helperText: `Starts in ${formatMinutesDiff(workingTask.deltaMinutes)}`,
      };
    }
    if (workingTask.state === 'overdue') {
      return {
        badge: 'Overdue Task',
        badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        helperText: `Overdue by ${formatMinutesDiff(workingTask.deltaMinutes)}`,
      };
    }
    return {
      badge: 'All Done Today',
      badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      helperText: 'All pending habits for today are completed',
    };
  }, [workingTask]);

  // Working task change notification
  useEffect(() => {
    const workingTaskKey = workingTask 
      ? `${workingTask.state}:${workingTask.habit._id}:${workingTask.time}` 
      : 'none';

    if (!workingTaskToastKeyRef.current) {
      workingTaskToastKeyRef.current = workingTaskKey;
      return;
    }

    if (workingTaskToastKeyRef.current !== workingTaskKey && workingTask && workingTaskMeta) {
      const titleByState = {
        overdue: 'Overdue task highlighted',
        working: 'Focus task updated',
        upcoming: 'Next task changed',
        done: 'All tasks completed! 🎉',
      };
      toast.info(
        titleByState[workingTask.state] || 'Task update',
        `${workingTask.habit.name} • ${formatScheduleTime(workingTask.time)}`
      );
    }
    workingTaskToastKeyRef.current = workingTaskKey;
  }, [workingTask, workingTaskMeta, toast]);

  const workingTaskCompletionId = workingTask ? completionByHabitId[workingTask.habit._id] : null;
  const streakByHabitId = stats.streaks || {};

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">StreakUp</h1>
            <p className="text-slate-600 dark:text-slate-300">Welcome, {user?.name}</p>
          </div>

          <ConnectionStatus 
            isOnline={isOnline} 
            isSyncing={isSyncing} 
            pendingActions={pendingActions} 
          />

          <div className="flex gap-2">
            <button
              onClick={openCreateModal}
              className="btn-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 transition"
            >
              <Plus className="h-4 w-4" />
              Add Habit
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/task-manager')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ListTodo className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/goals')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Target className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-100/70 px-4 py-2 text-rose-700 transition hover:bg-rose-200/70 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/45"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Refresh Button */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchDashboard({ force: true })}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Show skeleton while loading (first load only) */}
        {loading && !habits.length ? (
          <DashboardSkeleton />
        ) : error && !habits.length ? (
          <div className="rounded-xl border border-rose-300/60 bg-rose-100/60 p-4 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/30 dark:text-rose-300">
            <p>{error}</p>
            <button
              onClick={() => fetchDashboard({ force: true })}
              className="mt-2 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Working Task Section */}
            <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.14)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/70">
              <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/25" />
              <div className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/25" />

              <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <Sparkles className="h-4 w-4" />
                      Smart Working Task
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Current time {currentTimeLabel}</p>
                  </div>
                  {workingTaskMeta && (
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${workingTaskMeta.badgeClass}`}>
                      {workingTaskMeta.badge}
                    </span>
                  )}
                </div>

                {workingTask && workingTaskMeta ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{workingTask.habit.name}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {workingTask.habit.category} • {formatScheduleTime(workingTask.time)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{workingTaskMeta.helperText}</p>
                      {workingTask.habit.goal && (
                        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                          Goal: <span className="font-medium">{workingTask.habit.goal}</span>
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Quick Action</p>
                      {workingTask.state !== 'done' ? (
                        <button
                          type="button"
                          onClick={() => handleCompleteHabit(workingTask.habit._id)}
                          disabled={activeHabitId === workingTask.habit._id}
                          className="btn-brand mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {activeHabitId === workingTask.habit._id ? 'Marking...' : 'Mark as Completed'}
                        </button>
                      ) : workingTaskCompletionId ? (
                        <button
                          type="button"
                          onClick={() => handleUndoCompletion(workingTask.habit._id)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-200 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        >
                          Undo Last Completion
                        </button>
                      ) : (
                        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                          Nice work. You have completed today's scheduled tasks.
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-100 px-2 py-2 dark:bg-slate-800/70">
                          <p className="text-xs text-slate-500 dark:text-slate-300">Pending</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{todayTaskSummary.pending}</p>
                        </div>
                        <div className="rounded-xl bg-rose-100/80 px-2 py-2 dark:bg-rose-900/25">
                          <p className="text-xs text-rose-600 dark:text-rose-300">Overdue</p>
                          <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">{todayTaskSummary.overdue}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-100/80 px-2 py-2 dark:bg-emerald-900/25">
                          <p className="text-xs text-emerald-600 dark:text-emerald-300">Done</p>
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">{todayTaskSummary.completed}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    No scheduled habit for today. Add habit times and repeat days to enable smart task tracking.
                  </p>
                )}

                {/* Timeline */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Today Timeline</p>
                  {timelineEntries.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {timelineEntries.map((entry, index) => {
                        const isFocusedTask = workingTask && 
                          workingTask.habit._id === entry.habit._id && 
                          workingTask.time === entry.time;

                        const chipClass = entry.isCompleted
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : entry.isOverdue
                            ? 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300'
                            : isFocusedTask
                              ? 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700/60 dark:bg-sky-900/30 dark:text-sky-300'
                              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

                        return (
                          <span
                            key={`${entry.habit._id}-${entry.time}-${index}`}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition-all ${chipClass}`}
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatScheduleTime(entry.time)} · {entry.habit.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-300">No entries available for today.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Stats Cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="premium-panel rounded-2xl p-5 transition-transform hover:scale-[1.02]">
                <div className="inline-flex rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <Target className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Remaining Today</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.remainingToday}</p>
              </div>

              <div className="premium-panel rounded-2xl p-5 transition-transform hover:scale-[1.02]">
                <div className="inline-flex rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Completed Today</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.completedToday}/{stats.totalHabits}
                </p>
              </div>

              <div className="premium-panel rounded-2xl p-5 transition-transform hover:scale-[1.02]">
                <div className="inline-flex rounded-xl bg-orange-100 p-2 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  <Flame className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Current Streak</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.longestStreak}</p>
              </div>

              <div className="premium-panel rounded-2xl p-5 transition-transform hover:scale-[1.02]">
                <div className="inline-flex rounded-xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Weekly Progress</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.weeklyProgress}%</p>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="premium-panel rounded-2xl p-5">
                <p className="text-sm text-slate-700 dark:text-slate-300">Daily Completion Rate</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{completionRate}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500"
                    style={{ width: `${Math.min(100, completionRate)}%` }}
                  />
                </div>
              </div>

              <div className="premium-panel rounded-2xl p-5">
                <p className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                  <TrendingUp className="h-4 w-4" />
                  Focus Score
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{focusScore}/100</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500"
                    style={{ width: `${Math.min(100, focusScore)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Habit Studio */}
            <div className="premium-panel rounded-2xl p-6">
              <h2 className="font-display mb-4 text-xl font-bold text-slate-900 dark:text-slate-100">
                Habit Studio
              </h2>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-\[220px] flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/80 py-2.5 pl-10 pr-3 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder="Search habits"
                  />
                </div>

                <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                  <Filter className="ml-2 mr-1 h-4 w-4 text-slate-400" />
                  {['all', 'pending', 'upcoming', 'overdue', 'completed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                        statusFilter === status
                          ? 'btn-brand text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <HabitList
                habits={filteredHabits}
                loading={false}
                completedHabitIds={completedHabitIds}
                completionByHabitId={completionByHabitId}
                streakByHabitId={streakByHabitId}
                activeHabitId={activeHabitId}
                onComplete={handleCompleteHabit}
                onUndo={handleUndoCompletion}
                onEdit={openEditModal}
                onDelete={handleDeleteHabit}
                onCreateFirst={openCreateModal}
              />
            </div>
          </>
        )}
      </main>

      {/* Toast Container */}
      <toast.ToastContainer />

      {/* Add/Edit Modal */}
      <AddHabitModal
        isOpen={modalOpen}
        initialHabit={editingHabit}
        isSubmitting={submittingHabit}
        onClose={closeModal}
        onSubmit={handleSaveHabit}
      />
    </div>
  );
}
