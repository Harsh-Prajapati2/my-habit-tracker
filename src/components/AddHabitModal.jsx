import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Palette, Tag, X } from 'lucide-react';

const CATEGORIES = ['Health', 'Fitness', 'Learning', 'Work', 'Personal', 'Other'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const defaultForm = {
  name: '',
  description: '',
  category: 'Health',
  color: '#3b82f6',
  scheduledTimes: ['08:00'],
  repeatDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  goal: '',
  notes: '',
};

export default function AddHabitModal({
  isOpen,
  isSubmitting,
  initialHabit,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(initialHabit);

  useEffect(() => {
    if (!isOpen) return;

    if (initialHabit) {
      setForm({
        name: initialHabit.name || '',
        description: initialHabit.description || '',
        category: initialHabit.category || 'Health',
        color: initialHabit.color || '#3b82f6',
        scheduledTimes:
          Array.isArray(initialHabit.scheduledTimes) && initialHabit.scheduledTimes.length
            ? initialHabit.scheduledTimes
            : ['08:00'],
        repeatDays:
          Array.isArray(initialHabit.repeatDays) && initialHabit.repeatDays.length
            ? initialHabit.repeatDays
            : ['Monday'],
        goal: initialHabit.goal || '',
        notes: initialHabit.notes || '',
      });
    } else {
      setForm(defaultForm);
    }

    setErrors({});
  }, [initialHabit, isOpen]);

  const colorPreview = useMemo(() => ({ backgroundColor: form.color }), [form.color]);

  if (!isOpen) return null;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const updateTime = (index, value) => {
    const next = [...form.scheduledTimes];
    next[index] = value;
    updateField('scheduledTimes', next);
  };

  const addTime = () => updateField('scheduledTimes', [...form.scheduledTimes, '12:00']);

  const removeTime = (index) => {
    if (form.scheduledTimes.length === 1) return;
    updateField(
      'scheduledTimes',
      form.scheduledTimes.filter((_, idx) => idx !== index)
    );
  };

  const toggleDay = (day) => {
    const exists = form.repeatDays.includes(day);
    const next = exists
      ? form.repeatDays.filter((d) => d !== day)
      : [...form.repeatDays, day];
    updateField('repeatDays', next);
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Habit name is required.';
    } else if (form.name.trim().length > 50) {
      nextErrors.name = 'Habit name must be 50 characters or less.';
    }

    if (!form.category) {
      nextErrors.category = 'Please select a category.';
    }

    if (!form.scheduledTimes.length) {
      nextErrors.scheduledTimes = 'At least one time is required.';
    } else if (!form.scheduledTimes.every((time) => TIME_REGEX.test(time))) {
      nextErrors.scheduledTimes = 'Each time must be in HH:MM format.';
    }

    if (!form.repeatDays.length) {
      nextErrors.repeatDays = 'Select at least one repeat day.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (event) => {
    event.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      goal: form.goal.trim(),
      notes: form.notes.trim(),
      scheduledTimes: form.scheduledTimes.sort(),
      repeatDays: form.repeatDays,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
      <div className="premium-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-5 md:p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {isEditMode ? 'Edit Habit' : 'Add New Habit'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Keep it clear and easy to complete daily.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            <div>
              <label className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Tag className="h-4 w-4" />
                Habit Name
              </label>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                placeholder="Morning walk"
                maxLength={50}
              />
              {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                rows={3}
                placeholder="Why this habit matters to you"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category ? <p className="mt-1 text-xs text-rose-600">{errors.category}</p> : null}
              </div>

              <div>
                <label className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Palette className="h-4 w-4" />
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => updateField('color', e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white dark:border-slate-700"
                  />
                  <div className="h-10 flex-1 rounded-lg border border-slate-200 dark:border-slate-700" style={colorPreview} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CalendarClock className="h-4 w-4" />
                  Scheduled Times
                </label>
                <button
                  type="button"
                  onClick={addTime}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add time
                </button>
              </div>
              <div className="space-y-2">
                {form.scheduledTimes.map((time, index) => (
                  <div key={`${time}-${index}`} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => updateTime(index, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeTime(index)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {errors.scheduledTimes ? (
                <p className="mt-1 text-xs text-rose-600">{errors.scheduledTimes}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Repeat Days</label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {DAYS.map((day) => {
                  const selected = form.repeatDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {errors.repeatDays ? <p className="mt-1 text-xs text-rose-600">{errors.repeatDays}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Goal</label>
                <input
                  value={form.goal}
                  onChange={(e) => updateField('goal', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="30 mins"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Notes / Motivation</label>
                <input
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Keep showing up"
                />
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Live Preview</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70" style={{ borderTop: `4px solid ${form.color}` }}>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{form.name || 'Habit name'}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{form.category}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.scheduledTimes.map((time, index) => (
                  <span key={`${time}-${index}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {time}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex justify-end gap-3 lg:col-span-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Habit' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
