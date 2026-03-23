import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresNickname, setRequiresNickname] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
          setRequiresNickname(!userData.nickname_set);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Register with email/password
  const registerEmail = useCallback(async (email, password, confirmPassword) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
    });

    // Check for duplicate email BEFORE parsing body — prevents "body stream already read" issues
    if (response.status === 409) {
      const error = new Error('This email is already registered. Please log in instead.');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error('Registration failed. Please try again.');
      }
      throw new Error('Something went wrong. Please try again.');
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Registration failed. Please try again.');
    }

    setUser(data.user);
    setIsAuthenticated(true);
    setRequiresNickname(data.requires_nickname);

    return data;
  }, []);

  // Login with email/password
  const loginEmail = useCallback(async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error('Email or password is incorrect.');
      }
      throw new Error('Something went wrong. Please try again.');
    }

    if (!response.ok) {
      const msg = data?.detail;
      // Map technical/generic backend errors to user-friendly message
      if (response.status === 401 || response.status === 400 || !msg) {
        throw new Error('Email or password is incorrect.');
      }
      throw new Error(msg);
    }

    setUser(data.user);
    setIsAuthenticated(true);
    setRequiresNickname(data.requires_nickname);

    return data;
  }, []);

  // Handle Google OAuth callback
  const handleGoogleCallback = useCallback(async (sessionId) => {
    const response = await fetch(`${API_URL}/api/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error('Google authentication failed. Please try again.');
      }
      throw new Error('Something went wrong. Please try again.');
    }

    if (!response.ok) {
      throw new Error('Google authentication failed. Please try again.');
    }

    setUser(data.user);
    setIsAuthenticated(true);
    setRequiresNickname(data.requires_nickname);

    return data;
  }, []);

  // Initiate Google login
  const loginGoogle = useCallback(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  }, []);

  // Set nickname
  const setNickname = useCallback(async (nickname) => {
    const response = await fetch(`${API_URL}/api/auth/nickname`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nickname }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error('Could not set nickname. Please try again.');
      }
      throw new Error('Something went wrong. Please try again.');
    }

    if (!response.ok) {
      // Extract error message and suggestions
      const errorDetail = data?.detail;
      if (typeof errorDetail === 'object') {
        const error = new Error(errorDetail.message || 'Could not set nickname. Please try again.');
        error.suggestions = errorDetail.suggestions;
        throw error;
      }
      throw new Error(errorDetail || 'Could not set nickname. Please try again.');
    }

    setUser(data.user);
    setRequiresNickname(false);

    return data;
  }, []);

  // Check nickname availability
  const checkNickname = useCallback(async (nickname) => {
    const response = await fetch(`${API_URL}/api/auth/nickname/check?nickname=${encodeURIComponent(nickname)}`, {
      credentials: 'include',
    });

    return await response.json();
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setUser(null);
    setIsAuthenticated(false);
    setRequiresNickname(false);
  }, []);

  // Update user data (for refreshing)
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setRequiresNickname(!userData.nickname_set);
        return userData;
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
    return null;
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    requiresNickname,
    registerEmail,
    loginEmail,
    loginGoogle,
    handleGoogleCallback,
    setNickname,
    checkNickname,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
