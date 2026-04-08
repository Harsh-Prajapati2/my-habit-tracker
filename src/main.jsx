import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const DEV_SW_RESET_KEY = 'habit-tracker-dev-sw-reset';
const CACHE_PREFIXES = ['habit-tracker-v', 'habit-tracker-runtime'];

async function clearHabitTrackerCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const cacheKeys = await caches.keys();
  await Promise.all(
    cacheKeys
      .filter((cacheName) => CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)))
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function resetServiceWorkerForDevelopment() {
  if (!('serviceWorker' in navigator)) return true;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const hadRegistrations = registrations.length > 0;

    await Promise.all(registrations.map((registration) => registration.unregister()));
    await clearHabitTrackerCaches();

    if (hadRegistrations && navigator.serviceWorker.controller) {
      if (sessionStorage.getItem(DEV_SW_RESET_KEY) !== 'done') {
        sessionStorage.setItem(DEV_SW_RESET_KEY, 'done');
        window.location.reload();
        return false;
      }
    } else {
      sessionStorage.removeItem(DEV_SW_RESET_KEY);
    }
  } catch (error) {
    console.warn('Failed to clean up service worker in development:', error);
  }

  return true;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content available');
            }
          });
        });
      })
      .catch((error) => console.log('SW registration failed:', error));

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_REQUESTED') {
        window.dispatchEvent(new CustomEvent('sw-sync-requested'));
      }
    });
  });
}

async function bootstrap() {
  if (import.meta.env.DEV) {
    const shouldRender = await resetServiceWorkerForDevelopment();
    if (!shouldRender) return;
  } else {
    registerServiceWorker();
  }

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
