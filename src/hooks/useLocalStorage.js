import { useCallback, useEffect, useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    localStorage.removeItem(key);
    setStoredValue(initialValue);
  }, [initialValue, key]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === key) {
        try {
          setStoredValue(event.newValue ? JSON.parse(event.newValue) : initialValue);
        } catch {
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [initialValue, key]);

  return [storedValue, setValue, removeValue];
}
