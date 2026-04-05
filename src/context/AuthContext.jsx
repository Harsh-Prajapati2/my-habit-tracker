import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

const THEME_STORAGE_KEY = 'themePreference';
const ACCENT_STORAGE_KEY = 'accentPreference';
const CARD_STYLE_STORAGE_KEY = 'habitCardStylePreference';
const VALID_THEMES = new Set(['light', 'dark']);
const VALID_ACCENTS = new Set(['indigo', 'cyan', 'emerald', 'rose']);
const VALID_CARD_STYLES = new Set(['glass', 'solid', 'outline']);

const applyThemeToDocument = (theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
};

const applyAccentToDocument = (accent) => {
  document.documentElement.setAttribute('data-accent', accent);
};

const applyCardStyleToDocument = (style) => {
  document.documentElement.setAttribute('data-card-style', style);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [accent, setAccent] = useState('indigo');
  const [habitCardStyle, setHabitCardStyle] = useState('glass');
  const [loading, setLoading] = useState(true);

  // Restore user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    let parsedUser = null;
    if (savedUser) {
      try {
        parsedUser = JSON.parse(savedUser);
      } catch {
        parsedUser = null;
      }
    }

    if (savedToken && parsedUser) {
      setToken(savedToken);
      setUser(parsedUser);
    }

    const persistedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const persistedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    const persistedCardStyle = localStorage.getItem(CARD_STYLE_STORAGE_KEY);
    const initialTheme = VALID_THEMES.has(persistedTheme)
      ? persistedTheme
      : parsedUser?.theme || 'dark';
    const initialAccent = VALID_ACCENTS.has(persistedAccent)
      ? persistedAccent
      : parsedUser?.accent || 'indigo';
    const initialCardStyle = VALID_CARD_STYLES.has(persistedCardStyle)
      ? persistedCardStyle
      : parsedUser?.habitCardStyle || 'glass';

    setTheme(initialTheme);
    setAccent(initialAccent);
    setHabitCardStyle(initialCardStyle);
    applyThemeToDocument(initialTheme);
    applyAccentToDocument(initialAccent);
    applyCardStyleToDocument(initialCardStyle);

    if (initialTheme !== persistedTheme) {
      localStorage.setItem(THEME_STORAGE_KEY, initialTheme);
    }

    if (initialAccent !== persistedAccent) {
      localStorage.setItem(ACCENT_STORAGE_KEY, initialAccent);
    }

    if (initialCardStyle !== persistedCardStyle) {
      localStorage.setItem(CARD_STYLE_STORAGE_KEY, initialCardStyle);
    }

    setLoading(false);
  }, []);

  const persistUser = useCallback((nextUser) => {
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { data, token: authToken } = response.data;

      persistUser(data);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);

      const nextTheme = data?.theme && VALID_THEMES.has(data.theme) ? data.theme : 'dark';
      const nextAccent = data?.accent && VALID_ACCENTS.has(data.accent) ? data.accent : 'indigo';
      const nextCardStyle =
        data?.habitCardStyle && VALID_CARD_STYLES.has(data.habitCardStyle)
          ? data.habitCardStyle
          : 'glass';
      setTheme(nextTheme);
      setAccent(nextAccent);
      setHabitCardStyle(nextCardStyle);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      localStorage.setItem(CARD_STYLE_STORAGE_KEY, nextCardStyle);
      applyThemeToDocument(nextTheme);
      applyAccentToDocument(nextAccent);
      applyCardStyleToDocument(nextCardStyle);
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
  }, [persistUser]);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    try {
      const response = await authAPI.register({ name, email, password, confirmPassword });
      const { data, token: authToken } = response.data;

      persistUser(data);
      setToken(authToken);
      localStorage.setItem('authToken', authToken);

      const nextTheme = data?.theme && VALID_THEMES.has(data.theme) ? data.theme : 'dark';
      const nextAccent = data?.accent && VALID_ACCENTS.has(data.accent) ? data.accent : 'indigo';
      const nextCardStyle =
        data?.habitCardStyle && VALID_CARD_STYLES.has(data.habitCardStyle)
          ? data.habitCardStyle
          : 'glass';
      setTheme(nextTheme);
      setAccent(nextAccent);
      setHabitCardStyle(nextCardStyle);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      localStorage.setItem(CARD_STYLE_STORAGE_KEY, nextCardStyle);
      applyThemeToDocument(nextTheme);
      applyAccentToDocument(nextAccent);
      applyCardStyleToDocument(nextCardStyle);
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Registration failed' };
    }
  }, [persistUser]);

  const saveProfile = useCallback(async (payload) => {
    try {
      const response = await authAPI.updateProfile(payload);
      const nextUser = response?.data?.data;

      if (nextUser) {
        persistUser(nextUser);

        if (VALID_THEMES.has(nextUser.theme)) {
          setTheme(nextUser.theme);
          localStorage.setItem(THEME_STORAGE_KEY, nextUser.theme);
          applyThemeToDocument(nextUser.theme);
        }

        if (VALID_ACCENTS.has(nextUser.accent)) {
          setAccent(nextUser.accent);
          localStorage.setItem(ACCENT_STORAGE_KEY, nextUser.accent);
          applyAccentToDocument(nextUser.accent);
        }

        if (VALID_CARD_STYLES.has(nextUser.habitCardStyle)) {
          setHabitCardStyle(nextUser.habitCardStyle);
          localStorage.setItem(CARD_STYLE_STORAGE_KEY, nextUser.habitCardStyle);
          applyCardStyleToDocument(nextUser.habitCardStyle);
        }
      }

      return { success: true, data: nextUser };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update profile' };
    }
  }, [persistUser]);

  const setThemePreference = useCallback(async (nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) {
      return { success: false, error: 'Invalid theme' };
    }

    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyThemeToDocument(nextTheme);

    if (token) {
      const response = await saveProfile({ theme: nextTheme });
      if (!response.success) {
        return { success: false, error: response.error };
      }
    }

    return { success: true };
  }, [saveProfile, token]);

  const setAccentPreference = useCallback(async (nextAccent) => {
    if (!VALID_ACCENTS.has(nextAccent)) {
      return { success: false, error: 'Invalid accent' };
    }

    setAccent(nextAccent);
    localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
    applyAccentToDocument(nextAccent);

    if (token) {
      const response = await saveProfile({ accent: nextAccent });
      if (!response.success) {
        return { success: false, error: response.error };
      }
    }

    return { success: true };
  }, [saveProfile, token]);

  const setHabitCardStylePreference = useCallback(async (nextStyle) => {
    if (!VALID_CARD_STYLES.has(nextStyle)) {
      return { success: false, error: 'Invalid habit card style' };
    }

    setHabitCardStyle(nextStyle);
    localStorage.setItem(CARD_STYLE_STORAGE_KEY, nextStyle);
    applyCardStyleToDocument(nextStyle);

    if (token) {
      const response = await saveProfile({ habitCardStyle: nextStyle });
      if (!response.success) {
        return { success: false, error: response.error };
      }
    }

    return { success: true };
  }, [saveProfile, token]);

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {
      // Ignore logout API failures in client logout flow.
    });
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }, []);

  const value = {
    user,
    token,
    theme,
    accent,
    habitCardStyle,
    notificationsEnabled: user?.notificationsEnabled ?? true,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    saveProfile,
    setThemePreference,
    setAccentPreference,
    setHabitCardStylePreference,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
