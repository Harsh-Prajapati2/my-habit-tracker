// IndexedDB-based storage for offline-first functionality
// Uses native IndexedDB API (no dependencies)

const DB_NAME = 'habit-tracker-db';
const DB_VERSION = 1;

const STORES = {
  HABITS: 'habits',
  DASHBOARD: 'dashboard',
  OFFLINE_QUEUE: 'offlineQueue',
};

let db = null;

// Initialize the database
export function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Habits store
      if (!database.objectStoreNames.contains(STORES.HABITS)) {
        database.createObjectStore(STORES.HABITS, { keyPath: '_id' });
      }

      // Dashboard cache store
      if (!database.objectStoreNames.contains(STORES.DASHBOARD)) {
        database.createObjectStore(STORES.DASHBOARD, { keyPath: 'key' });
      }

      // Offline action queue
      if (!database.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        const queueStore = database.createObjectStore(STORES.OFFLINE_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

// Generic store operations
async function getStore(storeName, mode = 'readonly') {
  if (!db) await initDB();
  if (!db) return null;
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// Dashboard cache operations
export async function cacheDashboard(data) {
  try {
    const store = await getStore(STORES.DASHBOARD, 'readwrite');
    if (!store) return;
    const record = {
      key: 'dashboard',
      data,
      timestamp: Date.now(),
    };
    store.put(record);
  } catch (err) {
    console.warn('Failed to cache dashboard:', err);
  }
}

export async function getCachedDashboard(maxAge = 5 * 60 * 1000) {
  try {
    const store = await getStore(STORES.DASHBOARD);
    if (!store) return null;
    return new Promise((resolve) => {
      const request = store.get('dashboard');
      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }
        // Check if cache is stale
        if (Date.now() - record.timestamp > maxAge) {
          resolve({ ...record.data, stale: true });
          return;
        }
        resolve(record.data);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Habits cache operations
export async function cacheHabits(habits) {
  try {
    const store = await getStore(STORES.HABITS, 'readwrite');
    if (!store) return;
    // Clear existing and add new
    store.clear();
    for (const habit of habits) {
      store.put(habit);
    }
  } catch (err) {
    console.warn('Failed to cache habits:', err);
  }
}

export async function getCachedHabits() {
  try {
    const store = await getStore(STORES.HABITS);
    if (!store) return [];
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Offline queue operations
export async function queueOfflineAction(action) {
  try {
    const store = await getStore(STORES.OFFLINE_QUEUE, 'readwrite');
    if (!store) return false;
    const record = {
      ...action,
      timestamp: Date.now(),
      retries: 0,
    };
    store.add(record);
    return true;
  } catch (err) {
    console.warn('Failed to queue offline action:', err);
    return false;
  }
}

export async function getOfflineQueue() {
  try {
    const store = await getStore(STORES.OFFLINE_QUEUE);
    if (!store) return [];
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeFromQueue(id) {
  try {
    const store = await getStore(STORES.OFFLINE_QUEUE, 'readwrite');
    if (!store) return;
    store.delete(id);
  } catch (err) {
    console.warn('Failed to remove from queue:', err);
  }
}

export async function clearOfflineQueue() {
  try {
    const store = await getStore(STORES.OFFLINE_QUEUE, 'readwrite');
    if (!store) return;
    store.clear();
  } catch (err) {
    console.warn('Failed to clear queue:', err);
  }
}

// Sync offline actions when back online
export async function syncOfflineActions(apiHandlers) {
  const queue = await getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      const handler = apiHandlers[action.type];
      if (handler) {
        await handler(action.payload);
        await removeFromQueue(action.id);
        synced++;
      }
    } catch (err) {
      console.warn('Failed to sync action:', action, err);
      failed++;
    }
  }

  return { synced, failed };
}

// Initialize DB on module load
initDB().catch(console.warn);

export default {
  initDB,
  cacheDashboard,
  getCachedDashboard,
  cacheHabits,
  getCachedHabits,
  queueOfflineAction,
  getOfflineQueue,
  removeFromQueue,
  clearOfflineQueue,
  syncOfflineActions,
};
