const DB_NAME = 'streakup-app-db';
const DB_VERSION = 1;
const TASK_STORE = 'task-manager-items';

let dbPromise = null;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });

const openDatabase = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TASK_STORE)) {
        db.createObjectStore(TASK_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
};

const withStore = async (mode, executor) => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TASK_STORE, mode);
    const store = transaction.objectStore(TASK_STORE);

    let settled = false;

    transaction.oncomplete = () => {
      if (!settled) resolve(undefined);
    };

    transaction.onerror = () => {
      reject(transaction.error || new Error('IndexedDB transaction failed'));
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error('IndexedDB transaction aborted'));
    };

    Promise.resolve(executor(store))
      .then((result) => {
        settled = true;
        resolve(result);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const isTaskCompleted = (task) => {
  if (!task?.subtasks?.length) return false;
  return task.subtasks.every((subtask) => subtask.completed);
};

export async function listTaskItems() {
  const result = await withStore('readonly', async (store) => {
    const items = await toPromise(store.getAll());
    return (items || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  });

  return result || [];
}

export async function createTaskItem({ title, subtasks }) {
  const now = Date.now();

  const item = {
    id: createId(),
    title,
    subtasks: (subtasks || []).map((subtask) => ({
      id: subtask.id || createId(),
      title: subtask.title,
      completed: Boolean(subtask.completed),
    })),
    createdAt: now,
    updatedAt: now,
  };

  await withStore('readwrite', async (store) => {
    await toPromise(store.put(item));
  });

  return item;
}

export async function updateTaskItem(task) {
  const nextTask = {
    ...task,
    updatedAt: Date.now(),
  };

  await withStore('readwrite', async (store) => {
    await toPromise(store.put(nextTask));
  });

  return nextTask;
}

export async function deleteTaskItem(taskId) {
  await withStore('readwrite', async (store) => {
    await toPromise(store.delete(taskId));
  });
}
