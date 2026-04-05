import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Download,
  Loader2,
  Moon,
  Save,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const {
    user,
    theme,
    toggleTheme,
    saveProfile,
  } = useAuth();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [notifications, setNotifications] = useState(user?.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setDisplayName(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    setNotifications(user?.notificationsEnabled ?? true);
  }, [user?.notificationsEnabled]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 2200);
    return () => clearTimeout(timeout);
  }, [message]);

  const handleThemeToggle = async () => {
    setError('');
    await toggleTheme();
    setMessage(`Theme switched to ${theme === 'dark' ? 'light' : 'dark'}`);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const result = await saveProfile({
      name: displayName,
      notificationsEnabled: notifications,
    });

    if (!result.success) {
      setError(result.error || 'Failed to save settings');
    } else {
      setMessage('Settings saved');
    }

    setSaving(false);
  };

  const handleExportData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user,
      habitsCache: JSON.parse(localStorage.getItem('habit-tracker-habits-cache') || '[]'),
      offlineQueue: JSON.parse(localStorage.getItem('habit-tracker-offline-queue') || '[]'),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streakup-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Export downloaded');
  };

  const handleClearCache = () => {
    localStorage.removeItem('habit-tracker-habits-cache');
    localStorage.removeItem('habit-tracker-offline-queue');
    setMessage('Local cache cleared');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Profile</h2>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Display Name
              </label>
              <div className="relative">
                <UserRound className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input pl-10"
                  placeholder="Your display name"
                />
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-zinc-400" />
                ) : (
                  <Sun className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Theme</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Currently using {theme} mode
                  </p>
                </div>
              </div>
              <button
                onClick={handleThemeToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Push Notifications</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Get reminders for your habits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifications((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-green-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Data Management */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Data Management</h2>
            <div className="space-y-2">
              <button
                onClick={handleExportData}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Export My Data
              </button>
              <button
                onClick={handleClearCache}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Trash2 className="h-4 w-4" />
                Clear Local Cache
              </button>
              <button
                disabled
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-red-600 opacity-50 dark:text-red-400"
              >
                <ShieldAlert className="h-4 w-4" />
                Delete Account (coming soon)
              </button>
            </div>
          </section>

          {/* About */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">About StreakUp</h2>
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Built with:</strong> React, Node.js, MongoDB</p>
              <p className="pt-2">© 2026 StreakUp. All rights reserved.</p>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
