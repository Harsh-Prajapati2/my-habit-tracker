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
  deleteTaskItem,
  isTaskCompleted,
  listTaskItems,
  updateTaskItem,
} from '../utils/taskManagerDb';

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
      if (!repeatDays.length) return true;
      return repeatDays.includes(today);
    })
    .sort((a, b) => a.minutes - b.minutes);

  if (!entries.length) return null;

  const pendingEntries = entries.filter((entry) => !completedHabitIds.has(entry.habit._id));

  if (!pendingEntries.length) {
    return {
      ...entries[entries.length - 1],
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
    ...entries[entries.length - 1],
    state: 'done',
    deltaMinutes: 0,
  };
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

export default function TaskManager() {
  const navigate = useNavigate();
  const { habits } = useHabits();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeTick, setTimeTick] = useState(Date.now());
  const [completedHabitIds, setCompletedHabitIds] = useState(new Set());

  const [mainTaskTitle, setMainTaskTitle] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [draftSubtasks, setDraftSubtasks] = useState([]);

  const [toast, setToast] = useState(null);
  
  // Collapsible sections state
  const [habitFocusExpanded, setHabitFocusExpanded] = useState(true);
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
    fetchTodayCompletions();
  }, [fetchTasks, fetchTodayCompletions]);

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

  const addDraftSubtask = () => {
    const value = subtaskInput.trim();
    if (!value) return;

    setDraftSubtasks((prev) => [...prev, value]);
    setSubtaskInput('');
  };

  const removeDraftSubtask = (index) => {
    setDraftSubtasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    const title = mainTaskTitle.trim();
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
        title,
        subtasks: draftSubtasks.map((subtask) => ({ title: subtask, completed: false })),
      });

      setTasks((prev) => [created, ...prev]);
      setMainTaskTitle('');
      setSubtaskInput('');
      setDraftSubtasks([]);
      showToast('success', 'Task created', title);
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
        showToast('success', 'Task moved to completed', saved.title);
      } else if (before && !after) {
        showToast('info', 'Task moved to todo', saved.title);
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

    return (
      <article key={task.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/75">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {doneCount}/{task.subtasks.length} subtasks completed
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDeleteTask(task.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-300/80 bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        <div className="mt-3 space-y-2">
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
              <span className={`text-sm ${subtask.completed ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                {subtask.title}
              </span>
            </label>
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="premium-panel border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">Task Manager</h1>
            <p className="text-slate-600 dark:text-slate-300">Plan by subtasks and track completion cleanly.</p>
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
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_24px_50px_rgba(15,23,42,0.14)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/70">
          <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/25" />
          <div className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/25" />

          <div className="relative z-10">
            <div 
              className="flex cursor-pointer items-center justify-between p-5"
              onClick={() => setHabitFocusExpanded(!habitFocusExpanded)}
            >
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Sparkles className="h-4 w-4" />
                  Habit Focus at This Time
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Current time {currentTimeLabel}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {habitFocusExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {habitFocusExpanded && (
              <div className="px-5 pb-5">
                {workingHabit && workingHabitMeta ? (
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{workingHabit.habit.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${workingHabitMeta.badgeClass}`}>
                        {workingHabitMeta.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {workingHabit.habit.category} • {formatScheduleTime(workingHabit.time)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{workingHabitMeta.helper}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No habit is scheduled for today right now.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="premium-panel mb-6 rounded-2xl">
          <div 
            className="flex cursor-pointer items-center justify-between p-5"
            onClick={() => setAddTaskExpanded(!addTaskExpanded)}
          >
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Add Main Task</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tasks are saved to IndexedDB in your browser.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {addTaskExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {addTaskExpanded && (
            <form onSubmit={handleCreateTask} className="px-5 pb-5 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Main Task</label>
              <input
                value={mainTaskTitle}
                onChange={(event) => setMainTaskTitle(event.target.value)}
                placeholder="Launch project plan"
                className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Subtask</label>
              <div className="flex gap-2">
                <input
                  value={subtaskInput}
                  onChange={(event) => setSubtaskInput(event.target.value)}
                  placeholder="Create wireframe"
                  className="flex-1 rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addDraftSubtask}
                  className="btn-brand inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            {draftSubtasks.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/65">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Subtasks to add</p>
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
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

              <button
                type="submit"
                className="btn-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
              >
                <ListTodo className="h-4 w-4" />
                Create Task
              </button>
            </form>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="premium-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">To Do</h3>
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
            ) : todoTasks.length ? (
              <div className="space-y-3">{todoTasks.map(renderTaskCard)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                No pending tasks. Add a main task and subtasks above.
              </p>
            )}
          </div>

          <div className="premium-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Completed</h3>
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
            ) : completedTasks.length ? (
              <div className="space-y-3">{completedTasks.map(renderTaskCard)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Completed tasks will appear here when all subtasks are checked.
              </p>
            )}
          </div>
        </section>
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
    </div>
  );
}
