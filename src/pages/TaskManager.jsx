import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import useHabits from '../hooks/useHabits';
import { completionsAPI } from '../services/api';
import {
  createTaskItem,
  createTaskTopic,
  deleteTaskItem,
  isTaskCompleted,
  listTaskItems,
  listTaskTopics,
  updateTaskItem,
} from '../utils/taskManagerDb';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORKING_WINDOW_MINUTES = 12;
const UPCOMING_SOON_MINUTES = 25;

const sortTopicsByName = (topics) =>
  [...topics].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const upsertTopic = (topics, nextTopic) =>
  sortTopicsByName([
    ...topics.filter((topic) => topic.id !== nextTopic.id && topic.name.toLowerCase() !== nextTopic.name.toLowerCase()),
    nextTopic,
  ]);

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
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
};

const getWorkingHabitByTime = (habits, completedHabitIds, nowDate) => {
  const today = WEEK_DAYS[nowDate.getDay()];
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const entries = habits
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
      return !repeatDays.length || repeatDays.includes(today);
    })
    .sort((a, b) => a.minutes - b.minutes);

  if (!entries.length) return null;

  const pendingEntries = entries.filter((entry) => !completedHabitIds.has(entry.habit._id));
  if (!pendingEntries.length) {
    return { ...entries[entries.length - 1], state: 'done', deltaMinutes: 0 };
  }

  const overdueEntries = pendingEntries.filter((entry) => entry.minutes <= nowMinutes);
  if (overdueEntries.length) {
    const overdueEntry = overdueEntries[overdueEntries.length - 1];
    return { ...overdueEntry, state: 'overdue', deltaMinutes: nowMinutes - overdueEntry.minutes };
  }

  const nowEntry = pendingEntries.find((entry) => Math.abs(entry.minutes - nowMinutes) <= WORKING_WINDOW_MINUTES);
  if (nowEntry) {
    return { ...nowEntry, state: 'working', deltaMinutes: Math.abs(nowEntry.minutes - nowMinutes) };
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

  return { ...entries[entries.length - 1], state: 'done', deltaMinutes: 0 };
};

const getStateMeta = (state, deltaMinutes) => {
  if (state === 'overdue') {
    return {
      badge: 'Overdue Habit',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300',
      helper: `Overdue by ${formatMinutesDiff(deltaMinutes)}`,
    };
  }

  if (state === 'working') {
    return {
      badge: 'Focus Habit',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300',
      helper: deltaMinutes ? `Starts in ${formatMinutesDiff(deltaMinutes)}` : 'Scheduled right now',
    };
  }

  if (state === 'upcoming') {
    return {
      badge: 'Next Habit',
      badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-sky-300',
      helper: `Starts in ${formatMinutesDiff(deltaMinutes)}`,
    };
  }

  return {
    badge: 'All Habits Done',
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300',
    helper: 'You completed all pending habits for today',
  };
};

const getTaskMainTopic = (task) => {
  const rawValue =
    typeof task?.mainTopic === 'string' && task.mainTopic.trim()
      ? task.mainTopic
      : typeof task?.category === 'string' && task.category.trim()
        ? task.category
        : 'General';

  return rawValue.trim();
};

const groupTasksByMainTopic = (items) => {
  const groups = new Map();

  items.forEach((item) => {
    const topic = getTaskMainTopic(item);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(item);
  });

  return Array.from(groups.entries())
    .map(([topic, groupedItems]) => ({ topic, items: groupedItems }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
};

export default function TaskManager() {
  const navigate = useNavigate();
  const { habits } = useHabits();

  const [tasks, setTasks] = useState([]);
  const [taskTopics, setTaskTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeTick, setTimeTick] = useState(Date.now());
  const [completedHabitIds, setCompletedHabitIds] = useState(new Set());

  const [taskTopicInput, setTaskTopicInput] = useState('');
  const [selectedTaskTopic, setSelectedTaskTopic] = useState('');
  const [mainTaskTitle, setMainTaskTitle] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [draftSubtasks, setDraftSubtasks] = useState([]);

  const [toast, setToast] = useState(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  const [habitFocusExpanded, setHabitFocusExpanded] = useState(true);
  const [showTaskTopicManager, setShowTaskTopicManager] = useState(false);
  const [addTaskExpanded, setAddTaskExpanded] = useState(false);

  const showToast = useCallback((type, title, message = '') => {
    setToast({ id: Date.now(), type, title, message });
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const items = await listTaskItems();
      setTasks(items);
    } catch (error) {
      showToast('error', 'Task database unavailable', error?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchTaskTopics = useCallback(async () => {
    try {
      const items = await listTaskTopics();
      setTaskTopics(sortTopicsByName(items));
    } catch (error) {
      showToast('error', 'Could not load task topics', error?.message || 'Failed to load task topics');
    }
  }, [showToast]);

  const fetchTodayCompletions = useCallback(async () => {
    try {
      const response = await completionsAPI.getToday();
      const completions = response?.data?.data || [];
      const nextCompleted = new Set();

      completions.forEach((item) => {
        const habitId = typeof item.habitId === 'string' ? item.habitId : item.habitId?._id;
        if (habitId) nextCompleted.add(habitId);
      });

      setCompletedHabitIds(nextCompleted);
    } catch {
      setCompletedHabitIds(new Set());
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTaskTopics();
    fetchTodayCompletions();
  }, [fetchTasks, fetchTaskTopics, fetchTodayCompletions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
      fetchTodayCompletions();
    }, 60000);

    return () => clearInterval(timer);
  }, [fetchTodayCompletions]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (selectedTaskTopic && !taskTopics.some((topic) => topic.name === selectedTaskTopic)) {
      setSelectedTaskTopic('');
    }
  }, [selectedTaskTopic, taskTopics]);

  const currentTimeLabel = useMemo(
    () =>
      new Date(timeTick).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [timeTick]
  );

  const workingHabit = useMemo(
    () => getWorkingHabitByTime(habits, completedHabitIds, new Date(timeTick)),
    [habits, completedHabitIds, timeTick]
  );

  const workingHabitMeta = useMemo(() => {
    if (!workingHabit) return null;
    return getStateMeta(workingHabit.state, workingHabit.deltaMinutes);
  }, [workingHabit]);

  const todoTasks = useMemo(() => tasks.filter((task) => !isTaskCompleted(task)), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => isTaskCompleted(task)), [tasks]);
  const todoTaskGroups = useMemo(() => groupTasksByMainTopic(todoTasks), [todoTasks]);
  const completedTaskGroups = useMemo(() => groupTasksByMainTopic(completedTasks), [completedTasks]);

  const addDraftSubtask = () => {
    const value = subtaskInput.trim();
    if (!value) return;
    setDraftSubtasks((prev) => [...prev, value]);
    setSubtaskInput('');
  };

  const removeDraftSubtask = (index) => {
    setDraftSubtasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const resetTaskForm = ({ keepTopic = false } = {}) => {
    if (!keepTopic) setSelectedTaskTopic('');
    setMainTaskTitle('');
    setSubtaskInput('');
    setDraftSubtasks([]);
  };

  const handleCreateTaskTopic = async (event) => {
    event.preventDefault();

    const name = taskTopicInput.trim();
    if (!name) {
      showToast('error', 'Task main topic name is required');
      return;
    }

    try {
      const created = await createTaskTopic({ name });
      setTaskTopics((prev) => upsertTopic(prev, created));
      setSelectedTaskTopic(created.name);
      setTaskTopicInput('');
      setShowTaskTopicManager(false);
      setAddTaskExpanded(true);
      showToast('success', 'Task main topic ready', `${created.name} is available for new tasks`);
    } catch (error) {
      showToast('error', 'Topic creation failed', error?.message || 'Could not create task topic');
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    const topic = selectedTaskTopic.trim();
    const title = mainTaskTitle.trim();

    if (!taskTopics.length) {
      showToast('error', 'Create a task main topic first');
      return;
    }

    if (!topic) {
      showToast('error', 'Select a main topic');
      return;
    }

    if (!title) {
      showToast('error', 'Main task is required');
      return;
    }

    if (!draftSubtasks.length) {
      showToast('error', 'Add at least one subtask');
      return;
    }

    try {
      const created = await createTaskItem({
        mainTopic: topic,
        title,
        subtasks: draftSubtasks.map((subtask) => ({ title: subtask, completed: false })),
      });

      setTasks((prev) => [created, ...prev]);
      setExpandedTaskIds((prev) => new Set(prev).add(created.id));
      resetTaskForm({ keepTopic: true });
      setAddTaskExpanded(false);
      showToast('success', 'Task created', `${title} in ${getTaskMainTopic(created)}`);
    } catch (error) {
      showToast('error', 'Create failed', error?.message || 'Could not save task');
    }
  };

  const handleToggleSubtask = async (taskId, subtaskId) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const updatedTask = {
      ...currentTask,
      subtasks: currentTask.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
      ),
    };

    try {
      const before = isTaskCompleted(currentTask);
      const saved = await updateTaskItem(updatedTask);
      const after = isTaskCompleted(saved);

      setTasks((prev) => prev.map((task) => (task.id === taskId ? saved : task)));

      if (!before && after) {
        showToast('success', 'Task moved to completed', `${saved.title} in ${getTaskMainTopic(saved)}`);
      } else if (before && !after) {
        showToast('info', 'Task moved to todo', `${saved.title} in ${getTaskMainTopic(saved)}`);
      }
    } catch (error) {
      showToast('error', 'Update failed', error?.message || 'Could not update subtask');
    }
  };

  const handleDeleteTask = async (taskId) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    try {
      await deleteTaskItem(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      showToast('success', 'Task deleted', currentTask.title);
    } catch (error) {
      showToast('error', 'Delete failed', error?.message || 'Could not delete task');
    }
  };

  const toastClassName =
    toast?.type === 'success'
      ? 'border-emerald-300/70 bg-emerald-100/95 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/90 dark:text-emerald-100'
      : toast?.type === 'error'
        ? 'border-rose-300/70 bg-rose-100/95 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/90 dark:text-rose-100'
        : 'border-sky-300/70 bg-sky-100/95 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/90 dark:text-sky-100';

  const renderTaskCard = (task) => {
    const doneCount = task.subtasks.filter((subtask) => subtask.completed).length;
    const topic = getTaskMainTopic(task);
    const isExpanded = expandedTaskIds.has(task.id);
    const previewItems = task.subtasks.slice(0, 2).map((subtask) => subtask.title).join(', ');
    const remainingPreviewCount = Math.max(task.subtasks.length - 2, 0);

    return (
      <article
        key={task.id}
        className="flex h-full flex-col rounded-[1.35rem] border border-slate-200 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900/75"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{task.title}</h4>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/35 dark:text-indigo-300">
                {topic}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              {doneCount}/{task.subtasks.length} subtasks completed
            </p>
            {!isExpanded && previewItems ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Next steps: {previewItems}
                {remainingPreviewCount ? ` +${remainingPreviewCount} more` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[10.5rem] sm:items-end">
            <button
              type="button"
              onClick={() => toggleTaskExpanded(task.id)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isExpanded ? 'Hide full task' : 'Show full task'}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteTask(task.id)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-rose-300/80 bg-rose-100 px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-200 sm:w-auto dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {task.subtasks.map((subtask) => (
              <label
                key={subtask.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => handleToggleSubtask(task.id, subtask.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className={`text-sm ${
                    subtask.completed
                      ? 'text-slate-400 line-through dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {subtask.title}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  const renderTaskGroups = (groups, emptyMessage, accentClassName) => {
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
            <div className="grid gap-3 md:grid-cols-2">{group.items.map(renderTaskCard)}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderHabitFocus = () => (
    <section className="relative overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white/85 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/25" />
      <div className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/25" />

      <div className="relative z-10">
        <div
          className="flex cursor-pointer items-center justify-between gap-3 p-5 sm:p-6"
          onClick={() => setHabitFocusExpanded(!habitFocusExpanded)}
        >
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4" />
              Habit Focus at This Time
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Current time {currentTimeLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {habitFocusExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {habitFocusExpanded ? (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {workingHabit && workingHabitMeta ? (
              <div className="rounded-[1.35rem] border border-slate-200 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{workingHabit.habit.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${workingHabitMeta.badgeClass}`}>
                    {workingHabitMeta.badge}
                  </span>
                </div>
                <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
                  {workingHabit.habit.category} - {formatScheduleTime(workingHabit.time)}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{workingHabitMeta.helper}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">No habit is scheduled for today right now.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );

  const renderOverviewStrip = () => {
    const overviewCards = [
      {
        title: 'Task Topics',
        value: taskTopics.length,
        helper: selectedTaskTopic ? `Selected: ${selectedTaskTopic}` : 'Create a topic and start organizing',
        icon: Sparkles,
      },
      {
        title: 'To Do',
        value: todoTasks.length,
        helper: `${todoTaskGroups.length} active sections`,
        icon: ListTodo,
      },
      {
        title: 'Completed',
        value: completedTasks.length,
        helper: `${completedTaskGroups.length} finished sections`,
        icon: CheckCircle2,
      },
      {
        title: 'Focus Window',
        value: workingHabit ? workingHabit.habit.name : 'Clear',
        helper: workingHabitMeta?.helper || 'No scheduled habit right now',
        icon: Clock3,
      },
    ];

    return (
      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
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

  const renderTopicManager = () => (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setShowTaskTopicManager((prev) => !prev)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        {showTaskTopicManager ? 'Hide Task Topic' : 'Add New Task Topic'}
      </button>

      {showTaskTopicManager ? (
        <section className="premium-panel mt-4 rounded-[1.6rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Create Task Main Topic</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Task topics stay separate from goal topics. Create a task topic here, then select it when adding tasks.
            </p>
          </div>

          <form onSubmit={handleCreateTaskTopic} className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={taskTopicInput}
              onChange={(event) => setTaskTopicInput(event.target.value)}
              placeholder="Work, Study, Health"
              className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
            <button
              type="submit"
              className="btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Create Topic
            </button>
          </form>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Saved Task Topics
              </p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {taskTopics.length}
              </span>
            </div>

            {taskTopics.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                {taskTopics.map((topic) => {
                  const isSelected = selectedTaskTopic === topic.name;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskTopic(topic.name);
                        setAddTaskExpanded(true);
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
                No task topics yet. Create your first task main topic to start organizing sections.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );

  const renderAddTask = () => (
    <section className="premium-panel mb-6 rounded-[1.7rem] shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
      <div
        className="flex cursor-pointer flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        onClick={() => setAddTaskExpanded(!addTaskExpanded)}
      >
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Add Main Task</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Select an existing task topic, then add the task and subtasks under it.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {addTaskExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {addTaskExpanded ? (
        <form onSubmit={handleCreateTask} className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {!taskTopics.length ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
              Create a task main topic first, then come back here to add tasks inside that section.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Main Topic</label>
              <select
                value={selectedTaskTopic}
                onChange={(event) => setSelectedTaskTopic(event.target.value)}
                disabled={!taskTopics.length}
                className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              >
                <option value="">Select a task main topic</option>
                {taskTopics.map((topic) => (
                  <option key={topic.id} value={topic.name}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Main Task</label>
              <input
                value={mainTaskTitle}
                onChange={(event) => setMainTaskTitle(event.target.value)}
                placeholder="Launch project plan"
                className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Subtask</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={subtaskInput}
                onChange={(event) => setSubtaskInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addDraftSubtask();
                  }
                }}
                placeholder="Create wireframe"
                className="flex-1 rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={addDraftSubtask}
                className="btn-brand inline-flex w-full items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-medium sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {draftSubtasks.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/65">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Subtasks to add
              </p>
              <div className="flex flex-wrap gap-2">
                {draftSubtasks.map((subtask, index) => (
                  <span
                    key={`${subtask}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {subtask}
                    <button
                      type="button"
                      onClick={() => removeDraftSubtask(index)}
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!taskTopics.length}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium sm:w-auto ${
                taskTopics.length
                  ? 'btn-brand'
                  : 'cursor-not-allowed border border-slate-300 bg-slate-200 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <ListTodo className="h-4 w-4" />
              Create Task
            </button>
            <button
              type="button"
              onClick={() => {
                resetTaskForm();
                setAddTaskExpanded(false);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );

  const renderTaskColumns = () => (
    <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="premium-panel rounded-[1.7rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">To Do</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {todoTasks.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        ) : (
          renderTaskGroups(
            todoTaskGroups,
            'No pending tasks yet. Create a task topic and add a task above.',
            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
          )
        )}
      </div>

      <div className="premium-panel rounded-[1.7rem] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">Completed</h3>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {completedTasks.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        ) : (
          renderTaskGroups(
            completedTaskGroups,
            'Completed tasks will appear here under their task topics.',
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          )
        )}
      </div>
    </section>
  );

  const renderToast = () =>
    toast ? (
      <div className="pointer-events-none fixed right-4 top-4 z-60 w-[min(92vw,22rem)]">
        <div
          className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${toastClassName}`}
        >
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
    ) : null;

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8 2xl:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Workspace</p>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">Task Manager</h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
              Create task topics first, then add tasks under the right section.
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
        <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          {renderOverviewStrip()}
          {renderHabitFocus()}
        </section>
        <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
          {renderTopicManager()}
          {renderAddTask()}
        </section>
        {renderTaskColumns()}
      </main>

      {renderToast()}
    </div>
  );
}
