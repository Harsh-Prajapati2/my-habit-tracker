import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppWindow,
  ArrowLeft,
  Bell,
  Download,
  Layers,
  Loader2,
  Moon,
  PanelsTopLeft,
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
    accent,
    habitCardStyle,
    notificationsEnabled,
    setThemePreference,
    setAccentPreference,
    setHabitCardStylePreference,
    saveProfile,
  } = useAuth();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [notifications, setNotifications] = useState(Boolean(notificationsEnabled));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const accentPresets = [
    { id: 'indigo', label: 'Indigo', swatch: 'from-indigo-500 to-violet-500' },
    { id: 'cyan', label: 'Cyan', swatch: 'from-cyan-500 to-blue-500' },
    { id: 'emerald', label: 'Emerald', swatch: 'from-emerald-500 to-teal-500' },
    { id: 'rose', label: 'Rose', swatch: 'from-rose-500 to-pink-500' },
  ];
  const cardStyles = [
    { id: 'glass', label: 'Glass', icon: PanelsTopLeft, preview: 'from-slate-200/80 to-white/80 dark:from-slate-700/50 dark:to-slate-800/50' },
    { id: 'solid', label: 'Solid', icon: AppWindow, preview: 'from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600' },
    { id: 'outline', label: 'Outline', icon: Layers, preview: 'from-transparent to-transparent border-2 border-slate-400 dark:border-slate-500' },
  ];

  useEffect(() => {
    setDisplayName(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    setNotifications(Boolean(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 2200);
    return () => clearTimeout(timeout);
  }, [message]);

  const handleThemeToggle = async () => {
    setError('');
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const result = await setThemePreference(nextTheme);
    if (!result.success) {
      setError(result.error || 'Failed to update theme');
      return;
    }
    setMessage(`Theme switched to ${nextTheme}`);
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

  const handleAccentChange = async (nextAccent) => {
    setError('');
    const result = await setAccentPreference(nextAccent);
    if (!result.success) {
      setError(result.error || 'Failed to update accent');
      return;
    }
    setMessage('Accent updated');
  };

  const handleCardStyleChange = async (nextStyle) => {
    setError('');
    const result = await setHabitCardStylePreference(nextStyle);
    if (!result.success) {
      setError(result.error || 'Failed to update card design');
      return;
    }
    setMessage('Habit card design updated');
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="premium-panel border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-300/60 bg-emerald-100/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-300/60 bg-rose-100/60 px-4 py-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="space-y-6">
          {/* Profile */}
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Profile</h2>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Display Name</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-3 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Your display name"
                />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="w-6 h-6 text-indigo-500" />
                ) : (
                  <Sun className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Theme</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Currently using {theme} mode</p>
                </div>
              </div>
              <button
                onClick={handleThemeToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform bg-white rounded-full transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Accent palette</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {accentPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAccentChange(preset.id)}
                    className={`rounded-xl border p-2 text-left transition ${
                      accent === preset.id
                        ? 'border-slate-900 dark:border-slate-100'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className={`mb-2 block h-5 rounded-lg bg-linear-to-r ${preset.swatch}`} />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Habit card design</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {cardStyles.map((style) => {
                  const Icon = style.icon;
                  const isActive = habitCardStyle === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => handleCardStyleChange(style.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isActive ? 'border-slate-900 dark:border-slate-100' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span className={`mb-2 block h-8 rounded-lg bg-linear-to-r ${style.preview}`} />
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                        <Icon className="h-3.5 w-3.5" />
                        {style.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Notifications</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-cyan-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Push Notifications</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Get reminders for your habits</p>
                </div>
              </div>
              <button
                onClick={() => setNotifications((value) => !value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-cyan-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform bg-white rounded-full transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Data Management */}
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Data Management</h2>
            <div className="space-y-3">
              <button
                onClick={handleExportData}
                className="inline-flex w-full items-center gap-2 rounded-xl px-4 py-2 text-left font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                <Download className="h-4 w-4" />
                Export My Data
              </button>
              <button
                onClick={handleClearCache}
                className="inline-flex w-full items-center gap-2 rounded-xl px-4 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" />
                Clear Local Cache
              </button>
              <button className="inline-flex w-full items-center gap-2 rounded-xl px-4 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30">
                <ShieldAlert className="h-4 w-4" />
                Delete Account (coming soon)
              </button>
            </div>
          </div>

          {/* About */}
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">About StreakUp</h2>
            <div className="text-slate-600 dark:text-slate-300 text-sm space-y-2">
              <p>
                <strong>Version:</strong> 1.0.0
              </p>
              <p>
                <strong>Built with:</strong> React, Node.js, MongoDB
              </p>
              <p>
                © 2026 StreakUp. All rights reserved.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
