import React from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function ConnectionStatus({ 
  isOnline, 
  isSyncing, 
  pendingActions = 0,
  className = '' 
}) {
  if (isSyncing) {
    return (
      <span 
        className={`badge badge-info badge-pill ${className}`}
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Syncing
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span 
        className={`badge badge-warning badge-pill ${className}`}
      >
        <WifiOff className="h-3.5 w-3.5" />
        Offline
        {pendingActions > 0 && (
          <span className="ml-1 rounded-full bg-[var(--warning)] px-1.5 py-0.5 text-[10px] text-white">
            {pendingActions}
          </span>
        )}
      </span>
    );
  }

  return (
    <span 
      className={`badge badge-success badge-pill ${className}`}
    >
      <Wifi className="h-3.5 w-3.5" />
      Online
    </span>
  );
}
