import { tasksAPI } from '../services/api';

const LEGACY_DB_NAME = 'streakup-app-db';
const LEGACY_DB_VERSION = 1;
const LEGACY_TASK_STORE = 'task-manager-items';
const MIGRATION_KEY_PREFIX = 'habit-tracker-task-migration-v2';

let legacyDbPromise = null;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

const hasMigratedLegacyTasks = () => {
  try {
    return localStorage.getItem(getMigrationStorageKey()) === 'done';
  } catch {
    return false;
  }
};

const markLegacyTasksMigrated = () => {
  try {
    localStorage.setItem(getMigrationStorageKey(), 'done');
  } catch {
    // Ignore storage failures, migration will simply be checked again.
  }
};

const openLegacyDatabase = () => {
  if (legacyDbPromise) return legacyDbPromise;

  legacyDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

  return legacyDbPromise;
};

const getLegacyTaskItems = async () => {
  const db = await openLegacyDatabase();
  if (!db || !db.objectStoreNames.contains(LEGACY_TASK_STORE)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LEGACY_TASK_STORE, 'readonly');
    const store = transaction.objectStore(LEGACY_TASK_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = Array.isArray(request.result) ? request.result : [];
      resolve(items);
    };
    request.onerror = () => reject(request.error || new Error('Failed to read legacy tasks'));
  });
};

const normalizeSubtasks = (subtasks = []) =>
  (Array.isArray(subtasks) ? subtasks : [])
    .map((subtask, index) => ({
      id: typeof subtask?.id === 'string' && subtask.id.trim() ? subtask.id : createId(),
      title: typeof subtask?.title === 'string' ? subtask.title.trim() : '',
      completed: Boolean(subtask?.completed),
      order: Number.isFinite(subtask?.order) ? subtask.order : index,
    }))
    .filter((subtask) => subtask.title);

const getMainTopicValue = (task) => {
  const rawValue =
    typeof task?.mainTopic === 'string' && task.mainTopic.trim()
      ? task.mainTopic
      : typeof task?.category === 'string' && task.category.trim()
        ? task.category
        : 'General';

  return rawValue.trim();
};

const normalizeTaskPayload = (task) => ({
  title: typeof task?.title === 'string' ? task.title.trim() : '',
  mainTopic: getMainTopicValue(task),
  category: getMainTopicValue(task),
  subtasks: normalizeSubtasks(task?.subtasks),
});

const migrateLegacyTasksIfNeeded = async (remoteItems) => {
  if (hasMigratedLegacyTasks()) {
    return remoteItems;
  }

  if (remoteItems.length > 0) {
    markLegacyTasksMigrated();
    return remoteItems;
  }

  const legacyItems = await getLegacyTaskItems();
  if (!legacyItems.length) {
    markLegacyTasksMigrated();
    return [];
  }

  const migratedItems = [];
  for (const item of legacyItems) {
    const payload = normalizeTaskPayload(item);
    if (!payload.title || !payload.subtasks.length) continue;

    const response = await tasksAPI.create(payload);
    if (response?.data?.data) {
      migratedItems.push(response.data.data);
    }
  }

  markLegacyTasksMigrated();
  return migratedItems;
};

export const isTaskCompleted = (task) => {
  if (!task?.subtasks?.length) return false;
  return Boolean(task.completed) || task.subtasks.every((subtask) => subtask.completed);
};

export async function listTaskItems() {
  const response = await tasksAPI.getAll();
  const items = response?.data?.data || [];
  return migrateLegacyTasksIfNeeded(items);
}

export async function listTaskTopics() {
  const response = await tasksAPI.getTopics();
  return response?.data?.data || [];
}

export async function createTaskTopic(topicData) {
  const response = await tasksAPI.createTopic(topicData);
  return response?.data?.data;
}

export async function updateTaskTopic(topicId, topicData) {
  const response = await tasksAPI.updateTopic(topicId, topicData);
  return response?.data?.data;
}

export async function deleteTaskTopic(topicId) {
  const response = await tasksAPI.deleteTopic(topicId);
  return response?.data?.data;
}

export async function createTaskItem(taskData) {
  const payload = normalizeTaskPayload(taskData);
  const response = await tasksAPI.create(payload);
  return response?.data?.data;
}

export async function updateTaskItem(task) {
  const payload = normalizeTaskPayload(task);
  const response = await tasksAPI.update(task.id, payload);
  return response?.data?.data;
}

export async function deleteTaskItem(taskId) {
  await tasksAPI.delete(taskId);
}

export async function toggleTaskCompletion(taskId) {
  const response = await tasksAPI.toggleComplete(taskId);
  return response?.data?.data;
}
