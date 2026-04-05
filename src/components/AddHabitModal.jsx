import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Palette, Tag, X } from 'lucide-react';

const CATEGORIES = ['Health', 'Fitness', 'Learning', 'Work', 'Personal', 'Other'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const defaultForm = {
  name: '',
  description: '',
  category: 'Health',
  color: '#18181B',
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
        color: initialHabit.color || '#18181B',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-black/70">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {isEditMode ? 'Edit Habit' : 'Add New Habit'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Keep it clear and easy to complete daily.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-5 lg:col-span-2">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <Tag className="h-4 w-4" />
                Habit Name
              </label>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="input"
                placeholder="Morning walk"
                maxLength={50}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="input min-h-[80px] resize-y"
                rows={3}
                placeholder="Why this habit matters to you"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="input"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.category}</p>}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <Palette className="h-4 w-4" />
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => updateField('color', e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-zinc-300 bg-white dark:border-zinc-700"
                  />
                  <div className="h-10 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700" style={colorPreview} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <CalendarClock className="h-4 w-4" />
                  Scheduled Times
                </label>
                <button
                  type="button"
                  onClick={addTime}
                  className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
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
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeTime(index)}
                      className="btn btn-secondary btn-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {errors.scheduledTimes && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.scheduledTimes}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Repeat Days</label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map((day) => {
                  const selected = form.repeatDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                        selected
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {errors.repeatDays && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.repeatDays}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Goal</label>
                <input
                  value={form.goal}
                  onChange={(e) => updateField('goal', e.target.value)}
                  className="input"
                  placeholder="30 mins"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="input"
                  placeholder="Keep showing up"
                />
              </div>
            </div>
          </section>

          <aside className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Live Preview</p>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900" style={{ borderTop: `3px solid ${form.color}` }}>
              {form.scheduledTimes?.[0] && (
                <p className="mb-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {form.scheduledTimes[0]}
                </p>
              )}
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{form.name || 'Habit name'}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{form.category}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {form.scheduledTimes.map((time, index) => (
                  <span key={`${time}-${index}`} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {time}
                  </span>
                ))}
              </div>

              {form.goal && (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Goal: {form.goal}</p>
              )}

              {form.notes && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{form.notes}</p>
              )}
            </div>
          </aside>

          <div className="flex justify-end gap-3 lg:col-span-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Habit' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
