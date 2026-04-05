import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { completionsAPI, habitsAPI, statsAPI } from '../services/api';
import {
  cacheDashboard,
  cacheHabits,
  getCachedDashboard,
  getCachedHabits,
  queueOfflineAction,
  syncOfflineActions,
} from '../utils/offlineDb';

// Unified dashboard hook - single source of truth for all habit data
export default function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState(0);
  
  const lastFetchRef = useRef(0);
  const fetchInProgressRef = useRef(false);

  // Derived state from unified data
  const habits = useMemo(() => data?.habits || [], [data]);
  const stats = useMemo(
    () => ({
      totalHabits: data?.totalHabits || 0,
      completedToday: data?.completedToday || 0,
      remainingToday: data?.remainingToday || 0,
      longestStreak: data?.longestStreak || 0,
      weeklyProgress: data?.weeklyProgress || 0,
      streaks: data?.streaks || {},
    }),
    [data]
  );
  
  const completedHabitIds = useMemo(() => {
    const set = new Set();
    habits.forEach((h) => {
      if (h.isCompleted) set.add(h._id);
    });
    return set;
  }, [habits]);

  const completionByHabitId = useMemo(() => {
    const map = {};
    habits.forEach((h) => {
      if (h.completionId) map[h._id] = h.completionId;
    });
    return map;
  }, [habits]);

  // Fetch dashboard data (with cache-first strategy)
  const fetchDashboard = useCallback(async (options = {}) => {
    const { force = false, silent = false } = options;

    // Prevent duplicate fetches
    if (fetchInProgressRef.current && !force) return;
    
    // Throttle fetches (min 5 seconds between)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 5000) return;

    fetchInProgressRef.current = true;
    if (!silent) setLoading(true);
    setError('');

    try {
      // Try cache first for instant load
      const cached = await getCachedDashboard();
      if (cached && !force) {
        setData(cached);
        setLoading(false);
        // Continue to fetch fresh data in background
        if (!cached.stale && now - (cached.timestamp || 0) < 15000) {
          fetchInProgressRef.current = false;
          lastFetchRef.current = now;
          return;
        }
      }

      // Fetch from server
      if (navigator.onLine) {
        const response = await statsAPI.dashboard();
        const freshData = response.data.data;
        
        setData(freshData);
        await cacheDashboard(freshData);
        await cacheHabits(freshData.habits || []);
        
        lastFetchRef.current = now;
      } else if (!cached) {
        // Offline with no cache - try to build from habits cache
        const cachedHabits = await getCachedHabits();
        if (cachedHabits.length) {
          setData({
            habits: cachedHabits,
            totalHabits: cachedHabits.length,
            completedToday: 0,
            remainingToday: cachedHabits.length,
            longestStreak: 0,
            weeklyProgress: 0,
            streaks: {},
          });
        }
        setError('Offline - showing cached data');
      }
    } catch (err) {
      // On error, try to use cache
      const cached = await getCachedDashboard(Infinity); // Accept any age
      if (cached) {
        setData(cached);
        setError('Using cached data - sync failed');
      } else {
        setError(err?.response?.data?.message || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []);

  // Optimistic habit completion
  const completeHabit = useCallback(
    async (habitId) => {
      const habit = habits.find((h) => h._id === habitId);
      if (!habit || habit.isCompleted) return { success: false };

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const updatedHabits = prev.habits.map((h) =>
          h._id === habitId
            ? { ...h, isCompleted: true, streak: (h.streak || 0) + 1 }
            : h
        );
        return {
          ...prev,
          habits: updatedHabits,
          completedToday: prev.completedToday + 1,
          remainingToday: Math.max(0, prev.remainingToday - 1),
        };
      });

      try {
        if (navigator.onLine) {
          const response = await completionsAPI.mark({ habitId });
          const completionId = response?.data?.data?._id;
          
          // Update with real completion ID
          if (completionId) {
            setData((prev) => {
              if (!prev) return prev;
              const updatedHabits = prev.habits.map((h) =>
                h._id === habitId ? { ...h, completionId } : h
              );
              return { ...prev, habits: updatedHabits };
            });
          }
          
          return { 
            success: true, 
            alreadyCompleted: response?.data?.alreadyCompleted,
            completionId 
          };
        } else {
          // Queue for later sync
          await queueOfflineAction({
            type: 'COMPLETE_HABIT',
            payload: { habitId },
          });
          setPendingActions((p) => p + 1);
          return { success: true, queued: true };
        }
      } catch (err) {
        // Rollback optimistic update
        setData((prev) => {
          if (!prev) return prev;
          const updatedHabits = prev.habits.map((h) =>
            h._id === habitId
              ? { ...h, isCompleted: false, streak: Math.max(0, (h.streak || 1) - 1) }
              : h
          );
          return {
            ...prev,
            habits: updatedHabits,
            completedToday: Math.max(0, prev.completedToday - 1),
            remainingToday: prev.remainingToday + 1,
          };
        });
        throw err;
      }
    },
    [habits]
  );

  // Optimistic undo completion
  const undoCompletion = useCallback(
    async (habitId) => {
      const habit = habits.find((h) => h._id === habitId);
      if (!habit || !habit.completionId) return { success: false };

      const completionId = habit.completionId;

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const updatedHabits = prev.habits.map((h) =>
          h._id === habitId
            ? { ...h, isCompleted: false, completionId: null, streak: Math.max(0, (h.streak || 1) - 1) }
            : h
        );
        return {
          ...prev,
          habits: updatedHabits,
          completedToday: Math.max(0, prev.completedToday - 1),
          remainingToday: prev.remainingToday + 1,
        };
      });

      try {
        if (navigator.onLine) {
          await completionsAPI.undo(completionId);
          return { success: true };
        } else {
          await queueOfflineAction({
            type: 'UNDO_COMPLETION',
            payload: { completionId },
          });
          setPendingActions((p) => p + 1);
          return { success: true, queued: true };
        }
      } catch (err) {
        // Rollback
        setData((prev) => {
          if (!prev) return prev;
          const updatedHabits = prev.habits.map((h) =>
            h._id === habitId
              ? { ...h, isCompleted: true, completionId, streak: (h.streak || 0) + 1 }
              : h
          );
          return {
            ...prev,
            habits: updatedHabits,
            completedToday: prev.completedToday + 1,
            remainingToday: Math.max(0, prev.remainingToday - 1),
          };
        });
        throw err;
      }
    },
    [habits]
  );

  // Create habit with optimistic update
  const createHabit = useCallback(async (payload) => {
    const tempId = `temp-${Date.now()}`;
    const tempHabit = {
      _id: tempId,
      ...payload,
      isCompleted: false,
      streak: 0,
      isActive: true,
    };

    // Optimistic add
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        habits: [tempHabit, ...prev.habits],
        totalHabits: prev.totalHabits + 1,
        remainingToday: prev.remainingToday + 1,
      };
    });

    try {
      const response = await habitsAPI.create(payload);
      const created = response?.data?.data;

      // Replace temp with real habit
      setData((prev) => {
        if (!prev) return prev;
        const updatedHabits = prev.habits.map((h) =>
          h._id === tempId ? { ...created, isCompleted: false, streak: 0 } : h
        );
        return { ...prev, habits: updatedHabits };
      });

      return created;
    } catch (err) {
      // Rollback
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          habits: prev.habits.filter((h) => h._id !== tempId),
          totalHabits: Math.max(0, prev.totalHabits - 1),
          remainingToday: Math.max(0, prev.remainingToday - 1),
        };
      });
      throw err;
    }
  }, []);

  // Update habit
  const updateHabit = useCallback(async (id, payload) => {
    const original = habits.find((h) => h._id === id);
    if (!original) return null;

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const updatedHabits = prev.habits.map((h) =>
        h._id === id ? { ...h, ...payload } : h
      );
      return { ...prev, habits: updatedHabits };
    });

    try {
      const response = await habitsAPI.update(id, payload);
      return response?.data?.data;
    } catch (err) {
      // Rollback
      setData((prev) => {
        if (!prev) return prev;
        const updatedHabits = prev.habits.map((h) =>
          h._id === id ? original : h
        );
        return { ...prev, habits: updatedHabits };
      });
      throw err;
    }
  }, [habits]);

  // Delete habit
  const deleteHabit = useCallback(async (id) => {
    const habit = habits.find((h) => h._id === id);
    const index = habits.findIndex((h) => h._id === id);
    
    // Optimistic delete
    setData((prev) => {
      if (!prev) return prev;
      const updatedHabits = prev.habits.filter((h) => h._id !== id);
      const wasCompleted = habit?.isCompleted;
      return {
        ...prev,
        habits: updatedHabits,
        totalHabits: Math.max(0, prev.totalHabits - 1),
        completedToday: wasCompleted ? Math.max(0, prev.completedToday - 1) : prev.completedToday,
        remainingToday: wasCompleted ? prev.remainingToday : Math.max(0, prev.remainingToday - 1),
      };
    });

    try {
      await habitsAPI.delete(id);
    } catch (err) {
      // Rollback
      if (habit) {
        setData((prev) => {
          if (!prev) return prev;
          const updatedHabits = [...prev.habits];
          updatedHabits.splice(index, 0, habit);
          return {
            ...prev,
            habits: updatedHabits,
            totalHabits: prev.totalHabits + 1,
            completedToday: habit.isCompleted ? prev.completedToday + 1 : prev.completedToday,
            remainingToday: habit.isCompleted ? prev.remainingToday : prev.remainingToday + 1,
          };
        });
      }
      throw err;
    }
  }, [habits]);

  // Sync offline actions
  const syncOffline = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await syncOfflineActions({
        COMPLETE_HABIT: (payload) => completionsAPI.mark(payload),
        UNDO_COMPLETION: (payload) => completionsAPI.undo(payload.completionId),
      });
      
      if (result.synced > 0) {
        setPendingActions(0);
        await fetchDashboard({ force: true, silent: true });
      }
      
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDashboard, isSyncing]);

  // Online/offline handlers
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOffline();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOffline]);

  // Initial fetch
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Refresh on tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboard]);

  return {
    // Data
    data,
    habits,
    stats,
    completedHabitIds,
    completionByHabitId,
    
    // State
    loading,
    error,
    isOnline,
    isSyncing,
    pendingActions,
    
    // Actions
    fetchDashboard,
    completeHabit,
    undoCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
    syncOffline,
  };
}
