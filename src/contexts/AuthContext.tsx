import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getData, setData, STORAGE_KEYS, initializeData } from '@/lib/data';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  register: (email: string, password: string, name: string, role: 'patient' | 'doctor') => Promise<{ success: boolean; message: string; session?: any; user?: any }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session key used in sessionStorage (survives page refresh, cleared on tab close)
const SESSION_USER_KEY = 'medicare_session_user';

export const AuthProvider = ({ children }: { children: ReactNode }) => {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    // Initialize mock data
    initializeData();

    // Clear any old localStorage session (we now use sessionStorage only)
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

    // Check sessionStorage for current session (survives page refresh, cleared on tab close)
    const sessionUserStr = sessionStorage.getItem(SESSION_USER_KEY);
    if (sessionUserStr) {
      try {
        const sessionUser = JSON.parse(sessionUserStr) as User;
        setUser(sessionUser);
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const banned = getData<string[]>('BANNED_EMAILS', []);
    if (banned.includes(email)) {
      return { success: false, message: 'This account has been terminated. You cannot log in with this email.' };
    }

    // 1. Try Mock Login first (since Supabase is broken/unreachable for this demo)
    const users = getData<User[]>(STORAGE_KEYS.USERS, []);
    const mockUser = users.find(u => u.email === email && u.password === password);

    if (mockUser) {
      setUser(mockUser);
      // Persist in sessionStorage (survives refresh, cleared on tab close)
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(mockUser));
      return { success: true, message: 'Login successful (Mock Mode)!', user: mockUser };
    }

    return { success: false, message: 'Invalid email or password' };
  };

  const register = async (email: string, password: string, name: string, role: 'patient' | 'doctor') => {
    const banned = getData<string[]>('BANNED_EMAILS', []);
    if (banned.includes(email)) {
      return { success: false, message: 'This email is blocked from registration. Please use a different email.' };
    }

    // Mock Registration Fallback (Optional, but good for completeness)

    // Generate a random ID for the new user
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password, // In a real app, never store plain text passwords!
      name,
      role,
      phone: '',
      address: ''
    };

    // Save to local storage
    const existingUsers = getData<User[]>(STORAGE_KEYS.USERS, []);
    setData(STORAGE_KEYS.USERS, [...existingUsers, newUser]);

    // Auto-login
    setUser(newUser);
    // Persist in sessionStorage
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));

    return {
      success: true,
      message: 'Registration successful!',
      session: { user: newUser, access_token: 'mock-token' },
      user: newUser
    };
  };

  const logout = async () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
