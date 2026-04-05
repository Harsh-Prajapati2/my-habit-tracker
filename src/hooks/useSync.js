import { useEffect, useMemo, useState } from 'react';
import { clearOfflineQueue, getOfflineQueue } from '../utils/syncManager';

export default function useSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(getOfflineQueue().length);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const queued = getOfflineQueue();
      if (queued.length > 0) {
        clearOfflineQueue();
      }
      setPendingActions(0);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingActions(getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return useMemo(
    () => ({
      isOnline,
      pendingActions,
    }),
    [isOnline, pendingActions]
  );
}
