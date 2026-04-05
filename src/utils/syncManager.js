const OFFLINE_QUEUE_KEY = 'habit-tracker-offline-queue';
const HABITS_CACHE_KEY = 'habit-tracker-habits-cache';

export function saveToLocalStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getFromLocalStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function cacheHabits(habits) {
  saveToLocalStorage(HABITS_CACHE_KEY, habits);
}

export function getCachedHabits() {
  return getFromLocalStorage(HABITS_CACHE_KEY, []);
}

export function queueOfflineAction(action) {
  const queue = getFromLocalStorage(OFFLINE_QUEUE_KEY, []);
  queue.push({ ...action, queuedAt: new Date().toISOString() });
  saveToLocalStorage(OFFLINE_QUEUE_KEY, queue);
}

export function getOfflineQueue() {
  return getFromLocalStorage(OFFLINE_QUEUE_KEY, []);
}

export function clearOfflineQueue() {
  saveToLocalStorage(OFFLINE_QUEUE_KEY, []);
}
