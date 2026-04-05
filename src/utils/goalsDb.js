// IndexedDB utility for Goals management

const DB_NAME = 'GoalsDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'goals';

let dbInstance = null;

const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB'));

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('priority', 'priority', { unique: false });
        objectStore.createIndex('endDate', 'endDate', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

export const createGoal = async (goalData) => {
  const db = await openDatabase();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const goal = {
    id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: goalData.title,
    description: goalData.description || '',
    priority: goalData.priority || 'medium',
    startDate: goalData.startDate,
    endDate: goalData.endDate,
    tasks: goalData.tasks || [],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(goal);
    request.onsuccess = () => resolve(goal);
    request.onerror = () => reject(new Error('Failed to create goal'));
  });
};

export const listGoals = async () => {
  const db = await openDatabase();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to list goals'));
  });
};

export const updateGoal = async (goal) => {
  const db = await openDatabase();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const updatedGoal = {
    ...goal,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(updatedGoal);
    request.onsuccess = () => resolve(updatedGoal);
    request.onerror = () => reject(new Error('Failed to update goal'));
  });
};

export const deleteGoal = async (goalId) => {
  const db = await openDatabase();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(goalId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete goal'));
  });
};

export const isGoalCompleted = (goal) => {
  if (!goal.tasks || goal.tasks.length === 0) return false;
  return goal.tasks.every((task) => task.completed);
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
