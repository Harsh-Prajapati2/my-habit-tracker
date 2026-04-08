import { goalsAPI } from '../services/api';

const LEGACY_DB_NAME = 'GoalsDatabase';
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE_NAME = 'goals';
const MIGRATION_KEY_PREFIX = 'habit-tracker-goal-migration-v2';

let legacyDbInstance = null;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getMigrationStorageKey = () => {
  try {
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const userKey = user?.id || user?.email || 'anonymous';
    return `${MIGRATION_KEY_PREFIX}:${userKey}`;
  } catch {
    return `${MIGRATION_KEY_PREFIX}:anonymous`;
  }
};

const hasMigratedLegacyGoals = () => {
  try {
    return localStorage.getItem(getMigrationStorageKey()) === 'done';
  } catch {
    return false;
  }
};

const markLegacyGoalsMigrated = () => {
  try {
    localStorage.setItem(getMigrationStorageKey(), 'done');
  } catch {
    // Ignore storage failures and retry migration later if needed.
  }
};

const openLegacyDatabase = () =>
  new Promise((resolve, reject) => {
    if (legacyDbInstance) {
      resolve(legacyDbInstance);
      return;
    }

    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open legacy goals database'));

    request.onsuccess = (event) => {
      legacyDbInstance = event.target.result;
      resolve(legacyDbInstance);
    };
  });

const getLegacyGoals = async () => {
  const db = await openLegacyDatabase();
  if (!db || !db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LEGACY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LEGACY_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(new Error('Failed to read legacy goals'));
  });
};

const normalizeGoalTasks = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : [])
    .map((task, index) => ({
      id: typeof task?.id === 'string' && task.id.trim() ? task.id : createId(),
      title: typeof task?.title === 'string' ? task.title.trim() : '',
      completed: Boolean(task?.completed),
      order: Number.isFinite(task?.order) ? task.order : index,
    }))
    .filter((task) => task.title);

const getMainTopicValue = (goal) => {
  const rawValue =
    typeof goal?.mainTopic === 'string' && goal.mainTopic.trim()
      ? goal.mainTopic
      : typeof goal?.category === 'string' && goal.category.trim()
        ? goal.category
        : 'General';

  return rawValue.trim();
};

const toDateInputString = (value, fallbackOffsetDays = 0) => {
  const date = value ? new Date(value) : null;
  if (!date) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + fallbackOffsetDays);
    fallback.setMinutes(fallback.getMinutes() - fallback.getTimezoneOffset());
    return fallback.toISOString().slice(0, 10);
  }

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + fallbackOffsetDays);
    fallback.setMinutes(fallback.getMinutes() - fallback.getTimezoneOffset());
    return fallback.toISOString().slice(0, 10);
  }

  const normalized = new Date(date);
  normalized.setMinutes(normalized.getMinutes() - normalized.getTimezoneOffset());
  return normalized.toISOString().slice(0, 10);
};

const normalizeGoalPayload = (goal) => ({
  title: typeof goal?.title === 'string' ? goal.title.trim() : '',
  description: typeof goal?.description === 'string' ? goal.description.trim() : '',
  mainTopic: getMainTopicValue(goal),
  category: getMainTopicValue(goal),
  priority: ['high', 'medium', 'low'].includes(goal?.priority) ? goal.priority : 'medium',
  startDate: toDateInputString(goal?.startDate),
  endDate: toDateInputString(goal?.endDate, 7),
  tasks: normalizeGoalTasks(goal?.tasks),
});

const migrateLegacyGoalsIfNeeded = async (remoteItems) => {
  if (hasMigratedLegacyGoals()) {
    return remoteItems;
  }

  if (remoteItems.length > 0) {
    markLegacyGoalsMigrated();
    return remoteItems;
  }

  const legacyGoals = await getLegacyGoals();
  if (!legacyGoals.length) {
    markLegacyGoalsMigrated();
    return [];
  }

  const migratedGoals = [];
  for (const goal of legacyGoals) {
    const payload = normalizeGoalPayload(goal);
    if (!payload.title || !payload.tasks.length) continue;

    const response = await goalsAPI.create(payload);
    if (response?.data?.data) {
      migratedGoals.push(response.data.data);
    }
  }

  markLegacyGoalsMigrated();
  return migratedGoals;
};

export const createGoal = async (goalData) => {
  const payload = normalizeGoalPayload(goalData);
  const response = await goalsAPI.create(payload);
  return response?.data?.data;
};

export const listGoalTopics = async () => {
  const response = await goalsAPI.getTopics();
  return response?.data?.data || [];
};

export const createGoalTopic = async (topicData) => {
  const response = await goalsAPI.createTopic(topicData);
  return response?.data?.data;
};

export const listGoals = async () => {
  const response = await goalsAPI.getAll();
  const items = response?.data?.data || [];
  return migrateLegacyGoalsIfNeeded(items);
};

export const updateGoal = async (goal) => {
  const payload = normalizeGoalPayload(goal);
  const response = await goalsAPI.update(goal.id, payload);
  return response?.data?.data;
};

export const deleteGoal = async (goalId) => {
  await goalsAPI.delete(goalId);
};

export const toggleGoalCompletion = async (goalId) => {
  const response = await goalsAPI.toggleComplete(goalId);
  return response?.data?.data;
};

export const isGoalCompleted = (goal) => {
  if (!goal.tasks || goal.tasks.length === 0) return false;
  return Boolean(goal.completed) || goal.tasks.every((task) => task.completed);
};

export const getGoalProgress = (goal) => {
  if (!goal.tasks || goal.tasks.length === 0) return 0;
  const completedTasks = goal.tasks.filter((task) => task.completed).length;
  return Math.round((completedTasks / goal.tasks.length) * 100);
};

export const getDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
};

export const isGoalOverdue = (goal) => {
  const days = getDaysRemaining(goal.endDate);
  return days !== null && days < 0 && !isGoalCompleted(goal);
};
