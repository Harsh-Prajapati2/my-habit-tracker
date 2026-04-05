import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { completionsAPI, statsAPI } from '../services/api';
import {
  BarChart3,
  CheckCircle2,
  Filter,
  Flame,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
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

  const firstTime = habit?.scheduledTimes?.[0];
  if (!firstTime) return 'pending';

  const [h, m] = firstTime.split(':').map(Number);
  const scheduledMinutes = h * 60 + m;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes > scheduledMinutes) return 'overdue';
  return 'upcoming';
};

export default function Dashboard() {
  const { user, logout, habitCardStyle } = useAuth();
  const { habits, loading: habitsLoading, error: habitsError, createHabit, updateHabit, deleteHabit, fetchHabits } =
    useHabits();
  const { isOnline, pendingActions } = useSync();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [completedHabitIds, setCompletedHabitIds] = useState(new Set());
  const [completionByHabitId, setCompletionByHabitId] = useState({});
  const [activeHabitId, setActiveHabitId] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [submittingHabit, setSubmittingHabit] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const navigate = useNavigate();

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
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(''), 2500);
    return () => clearTimeout(timeout);
  }, [successMessage]);

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
    try {
      setSubmittingHabit(true);
      setError('');

      if (editingHabit?._id) {
        await updateHabit(editingHabit._id, payload);
        setSuccessMessage('Habit updated');
      } else {
        await createHabit(payload);
        setSuccessMessage('Habit created');
      }

      closeModal();
      await refreshDashboard();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save habit');
    } finally {
      setSubmittingHabit(false);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      setError('');
      await deleteHabit(habitId);
      setSuccessMessage('Habit deleted');
      await refreshDashboard();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete habit');
    }
  };

  const handleCompleteHabit = async (habitId) => {
    try {
      setActiveHabitId(habitId);
      setError('');

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

      setSuccessMessage(response?.data?.alreadyCompleted ? 'Already completed for today' : 'Habit completed');
      await fetchStats();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to mark habit complete');
    } finally {
      setActiveHabitId('');
    }
  };

  const handleUndoCompletion = async (habitId) => {
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

      setSuccessMessage('Completion undone');
      await fetchStats();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to undo completion');
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

        {successMessage ? (
          <div className="mb-4 rounded-xl border border-emerald-300/60 bg-emerald-100/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300">
            {successMessage}
          </div>
        ) : null}

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
