import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { completionsAPI, statsAPI } from '../services/api';
import {
  AlertTriangle,
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
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useHabits from '../hooks/useHabits';
import useSync from '../hooks/useSync';
import HabitList from '../components/HabitList';
import AddHabitModal from '../components/AddHabitModal';

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

  // Always prioritize missed pending tasks from earlier today.
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

export default function Dashboard() {
  const { user, logout, habitCardStyle } = useAuth();
  const { habits, loading: habitsLoading, error: habitsError, createHabit, updateHabit, deleteHabit, fetchHabits } =
    useHabits();
  const { isOnline, pendingActions } = useSync();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [completedHabitIds, setCompletedHabitIds] = useState(new Set());
  const [completionByHabitId, setCompletionByHabitId] = useState({});
  const [activeHabitId, setActiveHabitId] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [submittingHabit, setSubmittingHabit] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeTick, setTimeTick] = useState(Date.now());
  const workingTaskToastKeyRef = useRef('');

  const navigate = useNavigate();

  const showToast = useCallback((type, title, message = '') => {
    setToast({ id: Date.now(), type, title, message });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await statsAPI.dashboard();
      setStats(response.data.data);
    } catch (err) {
      setError('Failed to load dashboard stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchTodayCompletions = useCallback(async () => {
    try {
      const response = await completionsAPI.getToday();
      const completions = response?.data?.data || [];

      const nextCompleted = new Set();
      const nextCompletionMap = {};

      completions.forEach((item) => {
        const habitId = typeof item.habitId === 'string' ? item.habitId : item.habitId?._id;
        if (!habitId) return;

        nextCompleted.add(habitId);
        nextCompletionMap[habitId] = item._id;
      });

      setCompletedHabitIds(nextCompleted);
      setCompletionByHabitId(nextCompletionMap);
    } catch {
      setCompletedHabitIds(new Set());
      setCompletionByHabitId({});
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setError('');
    await Promise.all([fetchStats(), fetchTodayCompletions(), fetchHabits()]);
  }, [fetchHabits, fetchStats, fetchTodayCompletions]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(timer);
  }, [fetchStats]);

  useEffect(() => {
    const minuteTimer = setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);

    return () => clearInterval(minuteTimer);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

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
        showToast('success', 'Habit updated', habitName);
      } else {
        await createHabit(payload);
        showToast('success', 'Habit created', habitName);
      }

      closeModal();
      await refreshDashboard();
    } catch (err) {
      showToast('error', 'Save failed', err?.response?.data?.message || 'Failed to save habit');
    } finally {
      setSubmittingHabit(false);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    const habitName = habits.find((habit) => habit._id === habitId)?.name || 'Habit';

    try {
      await deleteHabit(habitId);
      showToast('success', 'Habit deleted', habitName);
      await refreshDashboard();
    } catch (err) {
      showToast('error', 'Delete failed', err?.response?.data?.message || 'Failed to delete habit');
    }
  };

  const handleCompleteHabit = async (habitId) => {
    const habitName = habits.find((habit) => habit._id === habitId)?.name || 'Habit';

    try {
      setActiveHabitId(habitId);

      const response = await completionsAPI.mark({ habitId });
      const completionId = response?.data?.data?._id;

      setCompletedHabitIds((prev) => {
        const next = new Set(prev);
        next.add(habitId);
        return next;
      });

      if (completionId) {
        setCompletionByHabitId((prev) => ({
          ...prev,
          [habitId]: completionId,
        }));
      }

      showToast(
        response?.data?.alreadyCompleted ? 'info' : 'success',
        response?.data?.alreadyCompleted ? 'Already completed' : 'Habit completed',
        habitName
      );
      await fetchStats();
    } catch (err) {
      showToast('error', 'Complete failed', err?.response?.data?.message || 'Failed to mark habit complete');
    } finally {
      setActiveHabitId('');
    }
  };

  const handleUndoCompletion = async (habitId) => {
    const habitName = habits.find((habit) => habit._id === habitId)?.name || 'Habit';

    try {
      const completionId = completionByHabitId[habitId];
      if (!completionId) return;

      await completionsAPI.undo(completionId);

      setCompletedHabitIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });

      setCompletionByHabitId((prev) => {
        const next = { ...prev };
        delete next[habitId];
        return next;
      });

      showToast('info', 'Completion undone', habitName);
      await fetchStats();
    } catch (err) {
      showToast('error', 'Undo failed', err?.response?.data?.message || 'Failed to undo completion');
    }
  };

  const screenLoading = habitsLoading || statsLoading;
  const streakByHabitId = stats?.streaks || {};

  const completionRate = useMemo(() => {
    if (!stats?.totalHabits) return 0;
    return Math.round((stats.completedToday / stats.totalHabits) * 100);
  }, [stats?.completedToday, stats?.totalHabits]);

  const focusScore = useMemo(() => {
    const weekly = stats?.weeklyProgress || 0;
    return Math.round(completionRate * 0.65 + weekly * 0.35);
  }, [completionRate, stats?.weeklyProgress]);

  const filteredHabits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return habits.filter((habit) => {
      const status = getHabitStatus(habit, completedHabitIds);
      const matchesQuery = !query || habit.name.toLowerCase().includes(query) || habit.category.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [completedHabitIds, habits, searchQuery, statusFilter]);

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
    () =>
      new Date(timeTick).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [timeTick]
  );

  const todayTaskSummary = useMemo(() => {
    const total = timelineEntries.length;
    const completed = timelineEntries.filter((entry) => entry.isCompleted).length;
    const overdue = timelineEntries.filter((entry) => entry.isOverdue).length;

    return {
      total,
      completed,
      overdue,
      pending: Math.max(total - completed, 0),
    };
  }, [timelineEntries]);

  const workingTaskMeta = useMemo(() => {
    if (!workingTask) return null;

    if (workingTask.state === 'working') {
      return {
        badge: 'Do This Now',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        helperText:
          workingTask.deltaMinutes === 0
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

  useEffect(() => {
    const workingTaskKey = workingTask ? `${workingTask.state}:${workingTask.habit._id}:${workingTask.time}` : 'none';

    if (!workingTaskToastKeyRef.current) {
      workingTaskToastKeyRef.current = workingTaskKey;
      return;
    }

    if (workingTaskToastKeyRef.current !== workingTaskKey && workingTask && workingTaskMeta) {
      const titleByState = {
        overdue: 'Overdue task highlighted',
        working: 'Focus task updated',
        upcoming: 'Next task changed',
        done: 'All tasks completed',
      };

      showToast(
        'info',
        titleByState[workingTask.state] || 'Task update',
        `${workingTask.habit.name} • ${formatScheduleTime(workingTask.time)}`
      );
    }

    workingTaskToastKeyRef.current = workingTaskKey;
  }, [workingTask, workingTaskMeta, showToast]);

  const headerBadge = useMemo(() => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        label: `Offline${pendingActions ? ` (${pendingActions} queued)` : ''}`,
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }

    return {
      icon: <Wifi className="h-4 w-4" />,
      label: 'Online',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  }, [isOnline, pendingActions]);

  const workingTaskCompletionId = workingTask ? completionByHabitId[workingTask.habit._id] : null;
  const toastClassName =
    toast?.type === 'success'
      ? 'border-emerald-300/70 bg-emerald-100/95 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/90 dark:text-emerald-100'
      : toast?.type === 'error'
        ? 'border-rose-300/70 bg-rose-100/95 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/90 dark:text-rose-100'
        : 'border-sky-300/70 bg-sky-100/95 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/90 dark:text-sky-100';

  return (
    <div className="min-h-screen">
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">StreakUp</h1>
            <p className="text-slate-600 dark:text-slate-300">Welcome, {user?.name}</p>
          </div>

          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${headerBadge.className}`}>
            {headerBadge.icon}
            {headerBadge.label}
          </span>

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
              Settings
            </button>
            <button
              onClick={() => navigate('/task-manager')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ListTodo className="h-4 w-4" />
              Task Manager
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-100/70 px-4 py-2 text-rose-700 transition hover:bg-rose-200/70 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/45"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={refreshDashboard}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

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

              {workingTaskMeta ? (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${workingTaskMeta.badgeClass}`}>
                  {workingTaskMeta.badge}
                </span>
              ) : null}
            </div>

            {workingTask && workingTaskMeta ? (
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{workingTask.habit.name}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {workingTask.habit.category} • {formatScheduleTime(workingTask.time)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{workingTaskMeta.helperText}</p>

                  {workingTask.habit.goal ? (
                    <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                      Goal: <span className="font-medium">{workingTask.habit.goal}</span>
                    </p>
                  ) : null}

                  {workingTask.habit.notes ? (
                    <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Motivation: {workingTask.habit.notes}
                    </p>
                  ) : null}
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
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-200 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                    >
                      Undo Last Completion
                    </button>
                  ) : (
                    <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                      Nice work. You have completed today&apos;s scheduled tasks.
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

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Today Timeline</p>

              {timelineEntries.length ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {timelineEntries.map((entry, index) => {
                    const isFocusedTask =
                      workingTask &&
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
                        className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs ${chipClass}`}
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

        {habitsError ? (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-100/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300">
            {habitsError}
          </div>
        ) : null}

        {screenLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
              <p className="mt-4 text-slate-600 dark:text-slate-300">Loading your dashboard...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-300/60 bg-rose-100/60 p-4 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/30 dark:text-rose-300">
            <p>{error}</p>
            <button
              onClick={refreshDashboard}
              className="mt-2 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        ) : stats ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="premium-panel rounded-2xl p-5">
                <div className="inline-flex rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <Target className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Remaining Today</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.remainingToday}</p>
              </div>

              <div className="premium-panel rounded-2xl p-5">
                <div className="inline-flex rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Completed Today</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.completedToday}/{stats.totalHabits}
                </p>
              </div>

              <div className="premium-panel rounded-2xl p-5">
                <div className="inline-flex rounded-xl bg-orange-100 p-2 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  <Flame className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Current Streak</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.longestStreak}</p>
              </div>

              <div className="premium-panel rounded-2xl p-5">
                <div className="inline-flex rounded-xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Weekly Progress</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.weeklyProgress}%</p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="premium-panel rounded-2xl p-5">
                <p className="text-sm text-slate-700 dark:text-slate-300">Daily Completion Rate</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{completionRate}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-(--brand-1) to-(--brand-2)"
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
                  <div className="h-full rounded-full bg-linear-to-r from-(--brand-1) to-(--brand-2)" style={{ width: `${Math.min(100, focusScore)}%` }} />
                </div>
              </div>
            </div>

            <div className="premium-panel rounded-2xl p-6">
              <h2 className="font-display mb-4 text-xl font-bold text-slate-900 dark:text-slate-100">
                Habit Studio
              </h2>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-55 flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
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
                loading={habitsLoading}
                habitCardStyle={habitCardStyle}
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
        ) : null}
      </main>

      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-60 w-[min(92vw,22rem)]">
          <div className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${toastClassName}`}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : toast.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-0.5 text-xs opacity-90">{toast.message}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
