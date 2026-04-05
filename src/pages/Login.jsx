import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-8 lg:justify-between">
        <section className="hidden max-w-md lg:block">
          <p className="font-display text-sm uppercase tracking-[0.22em] text-indigo-500">Daily excellence</p>
          <h1 className="font-display mt-3 text-5xl font-bold text-slate-900 dark:text-slate-100">
            Build repeatable momentum.
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            StreakUp helps you stay consistent with habits, streak intelligence, and execution-first workflow.
          </p>
        </section>

        <div className="premium-panel w-full max-w-md rounded-3xl p-8">
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/50 bg-indigo-100/70 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-700/40 dark:bg-indigo-900/35 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure Sign-In
            </div>
            <h2 className="font-display mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sign in to continue your habit streak.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-rose-300/60 bg-rose-100/60 p-3 text-sm text-rose-800 dark:border-rose-700/40 dark:bg-rose-900/25 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-3 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-10 text-slate-900 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Keep me signed in
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
