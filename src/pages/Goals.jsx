import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  createGoal,
  deleteGoal,
  getDaysRemaining,
  getGoalProgress,
  isGoalCompleted,
  isGoalOverdue,
  listGoals,
  updateGoal,
} from '../utils/goalsDb';

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300', icon: '🔴' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300', icon: '🟡' },
  low: { label: 'Low', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300', icon: '🟢' },
};

const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

export default function Goals() {
  const navigate = useNavigate();

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState(new Set());

  // Form states
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalPriority, setGoalPriority] = useState('medium');
  const [goalStartDate, setGoalStartDate] = useState('');
  const [goalEndDate, setGoalEndDate] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [draftTasks, setDraftTasks] = useState([]);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, title, message = '') => {
    setToast({ id: Date.now(), type, title, message });
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const items = await listGoals();
      setGoals(items);
    } catch (error) {
      showToast('error', 'Failed to load goals', error?.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const addDraftTask = () => {
    const value = taskInput.trim();
    if (!value) return;
    setDraftTasks((prev) => [...prev, value]);
    setTaskInput('');
  };

  const removeDraftTask = (index) => {
    setDraftTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateGoal = async (event) => {
    event.preventDefault();

    const title = goalTitle.trim();
    if (!title) {
      showToast('error', 'Goal title is required');
      return;
    }

    if (!goalStartDate || !goalEndDate) {
      showToast('error', 'Start and end dates are required');
      return;
    }

    if (new Date(goalEndDate) < new Date(goalStartDate)) {
      showToast('error', 'End date must be after start date');
      return;
    }

    if (!draftTasks.length) {
      showToast('error', 'Add at least one task');
      return;
    }

    try {
      const created = await createGoal({
        title,
        description: goalDescription.trim(),
        priority: goalPriority,
        startDate: goalStartDate,
        endDate: goalEndDate,
        tasks: draftTasks.map((task) => ({
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: task,
          completed: false,
        })),
      });

      setGoals((prev) => [created, ...prev]);
      setGoalTitle('');
      setGoalDescription('');
      setGoalPriority('medium');
      setGoalStartDate('');
      setGoalEndDate('');
      setTaskInput('');
      setDraftTasks([]);
      setShowAddForm(false);
      showToast('success', 'Goal created', title);
    } catch (error) {
      showToast('error', 'Create failed', error?.message);
    }
  };

  const handleToggleTask = async (goalId, taskId) => {
    const currentGoal = goals.find((goal) => goal.id === goalId);
    if (!currentGoal) return;

    const updatedGoal = {
      ...currentGoal,
      tasks: currentGoal.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    };

    try {
      const before = isGoalCompleted(currentGoal);
      const saved = await updateGoal(updatedGoal);
      const after = isGoalCompleted(saved);

      setGoals((prev) => prev.map((goal) => (goal.id === goalId ? saved : goal)));

      if (!before && after) {
        showToast('success', '🎉 Goal completed!', saved.title);
      }
    } catch (error) {
      showToast('error', 'Update failed', error?.message);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    const currentGoal = goals.find((goal) => goal.id === goalId);
    if (!currentGoal) return;

    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
      showToast('success', 'Goal deleted', currentGoal.title);
    } catch (error) {
      showToast('error', 'Delete failed', error?.message);
    }
  };

  const toggleGoalExpanded = (goalId) => {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      // First sort by completion status (incomplete first)
      const aCompleted = isGoalCompleted(a);
      const bCompleted = isGoalCompleted(b);
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

      // Then by priority
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by end date (sooner first)
      const aDate = new Date(a.endDate);
      const bDate = new Date(b.endDate);
      return aDate - bDate;
    });
  }, [goals]);

  const toastClassName =
    toast?.type === 'success'
      ? 'border-emerald-300/70 bg-emerald-100/95 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/90 dark:text-emerald-100'
      : toast?.type === 'error'
        ? 'border-rose-300/70 bg-rose-100/95 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/90 dark:text-rose-100'
        : 'border-sky-300/70 bg-sky-100/95 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/90 dark:text-sky-100';

  const renderGoalCard = (goal) => {
    const progress = getGoalProgress(goal);
    const daysRemaining = getDaysRemaining(goal.endDate);
    const isOverdue = isGoalOverdue(goal);
    const isComplete = isGoalCompleted(goal);
    const isExpanded = expandedGoalIds.has(goal.id);
    const priorityConfig = PRIORITY_CONFIG[goal.priority];

    const completedCount = goal.tasks.filter((t) => t.completed).length;

    return (
      <article
        key={goal.id}
        className={`rounded-2xl border p-5 transition ${
          isComplete
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : isOverdue
              ? 'border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30'
              : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/75'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`text-lg font-semibold ${isComplete ? 'text-emerald-800 dark:text-emerald-200 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                {goal.title}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityConfig.color}`}>
                {priorityConfig.icon} {priorityConfig.label}
              </span>
              {isComplete && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  ✅ Completed
                </span>
              )}
              {isOverdue && !isComplete && (
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  ⚠️ Overdue
                </span>
              )}
            </div>

            {goal.description && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{goal.description}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}
              </div>
              {daysRemaining !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {daysRemaining > 0 ? `${daysRemaining} days left` : daysRemaining === 0 ? 'Due today' : `${Math.abs(daysRemaining)} days overdue`}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {completedCount}/{goal.tasks.length} tasks
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                <span>Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isComplete
                      ? 'bg-emerald-500'
                      : isOverdue
                        ? 'bg-rose-500'
                        : 'bg-indigo-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleGoalExpanded(goal.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteGoal(goal.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300/80 bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tasks List (Collapsible) */}
        {isExpanded && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {goal.tasks.map((task) => (
              <label
                key={task.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(goal.id, task.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className={`text-sm ${
                    task.completed
                      ? 'text-slate-400 line-through dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {task.title}
                </span>
              </label>
            ))}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">Goals</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Set goals with deadlines and track progress
            </p>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Add Goal Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Cancel' : 'Add New Goal'}
          </button>
        </div>

        {/* Add Goal Form */}
        {showAddForm && (
          <section className="premium-panel mb-6 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-indigo-600" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Create New Goal</h2>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Goal Title *
                  </label>
                  <input
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="Launch my product"
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Priority *
                  </label>
                  <select
                    value={goalPriority}
                    onChange={(e) => setGoalPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  >
                    <option value="high">🔴 High Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="low">🟢 Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Description
                </label>
                <textarea
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  placeholder="Brief description of your goal..."
                  rows="2"
                  className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={goalStartDate}
                    onChange={(e) => setGoalStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={goalEndDate}
                    onChange={(e) => setGoalEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Add Tasks *
                </label>
                <div className="flex gap-2">
                  <input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDraftTask())}
                    placeholder="Research competitors"
                    className="flex-1 rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addDraftTask}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {draftTasks.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/65">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Tasks ({draftTasks.length})
                  </p>
                  <div className="space-y-1.5">
                    {draftTasks.map((task, index) => (
                      <div
                        key={`${task}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-200">{task}</span>
                        <button
                          type="button"
                          onClick={() => removeDraftTask(index)}
                          className="text-rose-600 hover:text-rose-700 dark:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Flag className="h-4 w-4" />
                  Create Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setGoalTitle('');
                    setGoalDescription('');
                    setGoalPriority('medium');
                    setGoalStartDate('');
                    setGoalEndDate('');
                    setTaskInput('');
                    setDraftTasks([]);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Goals List */}
        <section>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
              ))}
            </div>
          ) : sortedGoals.length > 0 ? (
            <div className="space-y-4">
              {sortedGoals.map(renderGoalCard)}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
              <Target className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">No goals yet</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Create your first goal to start tracking progress with deadlines
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(92vw,22rem)]">
          <div className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${toastClassName}`}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : toast.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-0.5 text-xs opacity-90">{toast.message}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
