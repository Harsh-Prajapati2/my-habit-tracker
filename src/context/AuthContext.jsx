import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const THEME_KEY = 'theme';
const VALID_THEMES = ['light', 'dark'];

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return VALID_THEMES.includes(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function getStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem('authToken') || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    const storedTheme = getStoredTheme();

    if (storedToken && storedUser) {
      setUser(storedUser);
      setToken(storedToken);
    }

    setTheme(storedTheme);
    applyTheme(storedTheme);
    setLoading(false);
  }, []);

  const saveUser = useCallback((userData) => {
    setUser(userData);
    try {
      localStorage.setItem('user', JSON.stringify(userData));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { data, token: authToken } = response.data;

      saveUser(data);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);

      // Apply user's theme preference if available
      const userTheme = VALID_THEMES.includes(data?.theme) ? data.theme : theme;
      setTheme(userTheme);
      localStorage.setItem(THEME_KEY, userTheme);
      applyTheme(userTheme);

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
  }, [saveUser, theme]);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    try {
      const response = await authAPI.register({ name, email, password, confirmPassword });
      const { data, token: authToken } = response.data;

      saveUser(data);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Registration failed' };
    }
  }, [saveUser]);

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }, []);

  const saveProfile = useCallback(async (payload) => {
    try {
      const response = await authAPI.updateProfile(payload);
      const nextUser = response?.data?.data;

      if (nextUser) {
        saveUser(nextUser);

        if (VALID_THEMES.includes(nextUser.theme)) {
          setTheme(nextUser.theme);
          localStorage.setItem(THEME_KEY, nextUser.theme);
          applyTheme(nextUser.theme);
        }
      }

      return { success: true, data: nextUser };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update profile' };
    }
  }, [saveUser]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);

    if (token) {
      await saveProfile({ theme: newTheme });
    }
  }, [theme, token, saveProfile]);

  const value = {
    user,
    token,
    theme,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    saveProfile,
    toggleTheme,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { AuthContext };

