import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      setPasswordStrength(getPasswordStrength(value));
    }

    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!termsAccepted) {
      setError('Please accept the terms and conditions');
      setLoading(false);
      return;
    }

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.confirmPassword
    );

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-8 lg:justify-between">
        <section className="hidden max-w-md lg:block">
          <p className="font-display text-sm uppercase tracking-[0.22em] text-violet-500">Performance loop</p>
          <h1 className="font-display mt-3 text-5xl font-bold text-slate-900 dark:text-slate-100">
            Turn routines into results.
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Join StreakUp and track habits with clean visuals, focused workflows, and smart daily execution.
          </p>
        </section>

        <div className="premium-panel w-full max-w-md rounded-3xl p-8">
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-100/60 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/35 dark:text-violet-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              New account
            </div>
            <h2 className="font-display mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">Create account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Start building habits with a premium dashboard.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-rose-300/60 bg-rose-100/60 p-3 text-sm text-rose-800 dark:border-rose-700/40 dark:bg-rose-900/25 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-3 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Your name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-3 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
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
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-10 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Create a password"
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
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < passwordStrength ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {passwordStrength === 0 ? 'Very weak' : passwordStrength < 2 ? 'Weak' : passwordStrength < 4 ? 'Good' : 'Strong'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 py-2.5 pl-10 pr-10 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  placeholder="Confirm password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="terms" className="text-xs">
                I agree to the Terms & Conditions
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
