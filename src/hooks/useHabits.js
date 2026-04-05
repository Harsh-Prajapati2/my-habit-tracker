import { useCallback, useEffect, useState } from 'react';
import { habitsAPI } from '../services/api';
import { cacheHabits, getCachedHabits } from '../utils/syncManager';

export default function useHabits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHabits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await habitsAPI.getAll();
      const list = response?.data?.data || [];
      setHabits(list);
      cacheHabits(list);
    } catch (err) {
      const cached = getCachedHabits();
      setHabits(cached);
      setError(err?.response?.data?.message || 'Failed to load habits. Showing cached data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createHabit = useCallback(async (payload) => {
    const response = await habitsAPI.create(payload);
    const created = response?.data?.data;
    setHabits((prev) => {
      const next = [created, ...prev];
      cacheHabits(next);
      return next;
    });
    return created;
  }, []);

  const updateHabit = useCallback(async (id, payload) => {
    const response = await habitsAPI.update(id, payload);
    const updated = response?.data?.data;
    setHabits((prev) => {
      const next = prev.map((habit) => (habit._id === id ? updated : habit));
      cacheHabits(next);
      return next;
    });
    return updated;
  }, []);

  const deleteHabit = useCallback(async (id) => {
    await habitsAPI.delete(id);
    setHabits((prev) => {
      const next = prev.filter((habit) => habit._id !== id);
      cacheHabits(next);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  return {
    habits,
    loading,
    error,
    fetchHabits,
    createHabit,
    updateHabit,
    deleteHabit,
  };
}
