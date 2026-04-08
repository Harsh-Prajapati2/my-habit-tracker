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
  createGoalTopic,
  deleteGoal,
  getDaysRemaining,
  getGoalProgress,
  isGoalCompleted,
  isGoalOverdue,
  listGoals,
  listGoalTopics,
  updateGoal,
} from '../utils/goalsDb';

const PRIORITY_CONFIG = {
  high: {
    label: 'High priority',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300',
  },
  medium: {
    label: 'Medium priority',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300',
  },
  low: {
    label: 'Low priority',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300',
  },
};

const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

const sortTopicsByName = (topics) =>
  [...topics].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const upsertTopic = (topics, nextTopic) =>
  sortTopicsByName([
    ...topics.filter((topic) => topic.id !== nextTopic.id && topic.name.toLowerCase() !== nextTopic.name.toLowerCase()),
    nextTopic,
  ]);

const getGoalMainTopic = (goal) => {
  const rawValue =
    typeof goal?.mainTopic === 'string' && goal.mainTopic.trim()
      ? goal.mainTopic
      : typeof goal?.category === 'string' && goal.category.trim()
        ? goal.category
        : 'General';

  return rawValue.trim();
};

const groupGoalsByMainTopic = (items) => {
  const groups = new Map();

  items.forEach((item) => {
    const topic = getGoalMainTopic(item);
    if (!groups.has(topic)) {
      groups.set(topic, []);
    }
    groups.get(topic).push(item);
  });

  return Array.from(groups.entries())
    .map(([topic, groupedItems]) => ({
      topic,
      items: groupedItems,
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
};

export default function Goals() {
  const navigate = useNavigate();

  const [goals, setGoals] = useState([]);
  const [goalTopics, setGoalTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoalTopicManager, setShowGoalTopicManager] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState(new Set());

  const [goalTitle, setGoalTitle] = useState('');
  const [goalTopicInput, setGoalTopicInput] = useState('');
  const [selectedGoalTopic, setSelectedGoalTopic] = useState('');
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

  const fetchGoalTopics = useCallback(async () => {
    try {
      const items = await listGoalTopics();
      setGoalTopics(sortTopicsByName(items));
    } catch (error) {
      showToast('error', 'Failed to load goal topics', error?.message);
    }
  }, [showToast]);

  useEffect(() => {
    fetchGoals();
    fetchGoalTopics();
  }, [fetchGoals, fetchGoalTopics]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (selectedGoalTopic && !goalTopics.some((topic) => topic.name === selectedGoalTopic)) {
      setSelectedGoalTopic('');
    }
  }, [goalTopics, selectedGoalTopic]);

  const addDraftTask = () => {
    const value = taskInput.trim();
    if (!value) return;
    setDraftTasks((prev) => [...prev, value]);
    setTaskInput('');
  };

  const removeDraftTask = (index) => {
    setDraftTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetGoalForm = ({ keepTopic = false } = {}) => {
    setGoalTitle('');
    if (!keepTopic) {
      setSelectedGoalTopic('');
    }
    setGoalDescription('');
    setGoalPriority('medium');
    setGoalStartDate('');
    setGoalEndDate('');
    setTaskInput('');
    setDraftTasks([]);
  };

  const handleCreateGoalTopic = async (event) => {
    event.preventDefault();

    const name = goalTopicInput.trim();
    if (!name) {
      showToast('error', 'Goal main topic name is required');
      return;
    }

    try {
      const created = await createGoalTopic({ name });
      setGoalTopics((prev) => upsertTopic(prev, created));
      setSelectedGoalTopic(created.name);
      setGoalTopicInput('');
      setShowGoalTopicManager(false);
      setShowAddForm(true);
      showToast('success', 'Goal main topic ready', `${created.name} is available for goals`);
    } catch (error) {
      showToast('error', 'Topic creation failed', error?.message);
    }
  };

  const handleCreateGoal = async (event) => {
    event.preventDefault();

    const title = goalTitle.trim();
    const mainTopic = selectedGoalTopic.trim();

    if (!title) {
      showToast('error', 'Goal title is required');
      return;
    }

    if (!goalTopics.length) {
      showToast('error', 'Create a goal main topic first');
      return;
    }

    if (!mainTopic) {
      showToast('error', 'Select a main topic');
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
        mainTopic,
        description: goalDescription.trim(),
        priority: goalPriority,
        startDate: goalStartDate,
        endDate: goalEndDate,
        tasks: draftTasks.map((task) => ({
          title: task,
          completed: false,
        })),
      });

      setGoals((prev) => [created, ...prev]);
      setExpandedGoalIds((prev) => new Set(prev).add(created.id));
      resetGoalForm({ keepTopic: true });
      setShowAddForm(false);
      showToast('success', 'Goal created', `${title} in ${getGoalMainTopic(created)}`);
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
        showToast('success', 'Goal moved to completed', `${saved.title} in ${getGoalMainTopic(saved)}`);
      } else if (before && !after) {
        showToast('info', 'Goal moved to todo', `${saved.title} in ${getGoalMainTopic(saved)}`);
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
      setExpandedGoalIds((prev) => {
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      });
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
      const aCompleted = isGoalCompleted(a);
      const bCompleted = isGoalCompleted(b);
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const aDate = new Date(a.endDate);
      const bDate = new Date(b.endDate);
      return aDate - bDate;
    });
  }, [goals]);

  const todoGoals = useMemo(() => sortedGoals.filter((goal) => !isGoalCompleted(goal)), [sortedGoals]);
  const completedGoals = useMemo(() => sortedGoals.filter((goal) => isGoalCompleted(goal)), [sortedGoals]);
  const overdueGoals = useMemo(
    () => sortedGoals.filter((goal) => !isGoalCompleted(goal) && isGoalOverdue(goal)),
    [sortedGoals]
  );
  const todoGoalGroups = useMemo(() => groupGoalsByMainTopic(todoGoals), [todoGoals]);
  const completedGoalGroups = useMemo(() => groupGoalsByMainTopic(completedGoals), [completedGoals]);

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
    const completedCount = goal.tasks.filter((task) => task.completed).length;
    const topic = getGoalMainTopic(goal);
    const previewTasks = goal.tasks.slice(0, 2).map((task) => task.title).join(', ');
    const remainingPreviewCount = Math.max(goal.tasks.length - 2, 0);

    return (
      <article
        key={goal.id}
        className={`flex h-full flex-col rounded-[1.35rem] border p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(15,23,42,0.12)] ${
          isComplete
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : isOverdue
              ? 'border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30'
              : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/75'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-lg font-semibold ${
                  isComplete
                    ? 'text-emerald-800 line-through dark:text-emerald-200'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {goal.title}
              </h3>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/35 dark:text-indigo-300">
                {topic}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
              {isComplete ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Completed
                </span>
              ) : null}
              {isOverdue && !isComplete ? (
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  Overdue
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {completedCount}/{goal.tasks.length} tasks complete
              </div>
              {daysRemaining !== null ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {daysRemaining > 0
                    ? `${daysRemaining} days left`
                    : daysRemaining === 0
                      ? 'Due today'
                      : `${Math.abs(daysRemaining)} days overdue`}
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    isComplete ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {!isExpanded && (goal.description || previewTasks) ? (
              <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {goal.description ? <p>{goal.description}</p> : null}
                {previewTasks ? (
                  <p>
                    Next steps: {previewTasks}{remainingPreviewCount ? ` +${remainingPreviewCount} more` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[10.5rem] sm:items-end">
            <button
              type="button"
              onClick={() => toggleGoalExpanded(goal.id)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isExpanded ? 'Hide full goal' : 'Show full goal'}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteGoal(goal.id)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-rose-300/80 bg-rose-100 px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-200 sm:w-auto dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            {goal.description ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">{goal.description}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                {priorityConfig.label}
              </div>
            </div>

            <div className="space-y-2">
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
          </div>
        ) : null}
      </article>
    );
  };

  const renderGoalGroups = (groups, emptyMessage, accentClassName) => {
    if (!groups.length) {
      return (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.topic}
            className="rounded-[1.65rem] border border-slate-200/90 bg-slate-50/75 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950/25"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Main Topic
                </p>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{group.topic}</h4>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${accentClassName}`}>
                {group.items.length}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">{group.items.map(renderGoalCard)}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderOverviewStrip = () => {
    const overviewCards = [
      {
        title: 'Goal Topics',
        value: goalTopics.length,
        helper: selectedGoalTopic ? `Selected: ${selectedGoalTopic}` : 'Create a goal topic to begin',
        icon: Target,
      },
      {
        title: 'Active Goals',
        value: todoGoals.length,
        helper: `${todoGoalGroups.length} active sections`,
        icon: TrendingUp,
      },
      {
        title: 'Completed',
        value: completedGoals.length,
        helper: `${completedGoalGroups.length} finished sections`,
        icon: CheckCircle2,
      },
      {
        title: 'Overdue',
        value: overdueGoals.length,
        helper: overdueGoals.length ? 'Needs attention soon' : 'Everything is on track',
        icon: Clock,
      },
    ];

    return (
      <section className="mb-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="premium-panel rounded-[1.4rem] border border-slate-200/90 bg-white/90 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/75"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {card.title}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.helper}</p>
                </div>
                <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          );
        })}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8 2xl:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Workspace</p>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">Goals</h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
              Create goal topics first, then add goals under the right section.
            </p>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-5 lg:px-8 2xl:px-10">
        {renderOverviewStrip()}
        <section className="mb-6">
          <button
            type="button"
            onClick={() => setShowGoalTopicManager((prev) => !prev)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {showGoalTopicManager ? 'Hide Goal Topic' : 'Add New Goal Topic'}
          </button>

          {showGoalTopicManager ? (
            <section className="premium-panel mt-4 rounded-[1.6rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="mb-4">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Create Goal Main Topic</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Goal topics stay separate from task topics. Create a goal topic here, then select it when adding goals.
                </p>
              </div>

              <form onSubmit={handleCreateGoalTopic} className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={goalTopicInput}
                  onChange={(event) => setGoalTopicInput(event.target.value)}
                  placeholder="Career, Finance, Health"
                  className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Topic
                </button>
              </form>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Saved Goal Topics
                  </p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {goalTopics.length}
                  </span>
                </div>

                {goalTopics.length ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                    {goalTopics.map((topic) => {
                      const isSelected = selectedGoalTopic === topic.name;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setSelectedGoalTopic(topic.name);
                            setShowAddForm(true);
                          }}
                          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/35 dark:text-indigo-200'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          {topic.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    No goal topics yet. Create your first goal main topic to start organizing sections.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </section>

        <div className="mb-6">
          <button
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Cancel' : 'Add New Goal'}
          </button>
        </div>

        {showAddForm ? (
          <section className="premium-panel mb-6 rounded-[1.7rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Create New Goal</h2>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              {!goalTopics.length ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                  Create a goal main topic first, then add goals inside that section.
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Goal Title *
                  </label>
                  <input
                    value={goalTitle}
                    onChange={(event) => setGoalTitle(event.target.value)}
                    placeholder="Launch my product"
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Main Topic *
                  </label>
                  <select
                    value={selectedGoalTopic}
                    onChange={(event) => setSelectedGoalTopic(event.target.value)}
                    disabled={!goalTopics.length}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  >
                    <option value="">Select a goal main topic</option>
                    {goalTopics.map((topic) => (
                      <option key={topic.id} value={topic.name}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Priority *
                  </label>
                  <select
                    value={goalPriority}
                    onChange={(event) => setGoalPriority(event.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  >
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Description
                </label>
                <textarea
                  value={goalDescription}
                  onChange={(event) => setGoalDescription(event.target.value)}
                  placeholder="Brief description of your goal"
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
                    onChange={(event) => setGoalStartDate(event.target.value)}
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
                    onChange={(event) => setGoalEndDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Add Tasks *
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={taskInput}
                    onChange={(event) => setTaskInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addDraftTask();
                      }
                    }}
                    placeholder="Research competitors"
                    className="flex-1 rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addDraftTask}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-medium text-white hover:bg-indigo-700 sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {draftTasks.length ? (
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
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!goalTopics.length}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium sm:w-auto ${
                    goalTopics.length
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'cursor-not-allowed border border-slate-300 bg-slate-200 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  Create Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetGoalForm();
                    setShowAddForm(false);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="premium-panel rounded-[1.7rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">To Do</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {todoGoals.length}
              </span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                ))}
              </div>
            ) : (
              renderGoalGroups(
                todoGoalGroups,
                'No active goals yet. Create a goal topic and add one above.',
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              )
            )}
          </div>

          <div className="premium-panel rounded-[1.7rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">Completed</h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {completedGoals.length}
              </span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                ))}
              </div>
            ) : (
              renderGoalGroups(
                completedGoalGroups,
                'Completed goals will appear here under their goal topics.',
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              )
            )}
          </div>
        </section>
      </main>

      {toast ? (
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
                {toast.message ? <p className="mt-0.5 text-xs opacity-90">{toast.message}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
