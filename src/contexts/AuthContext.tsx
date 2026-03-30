import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, initializeData } from '@/lib/data';
import { supabase } from '@/lib/supabase';

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
    // Initialize Supabase data asynchronously
    initializeData();

    // Check sessionStorage for current session (survives page refresh, cleared on tab close)
    const sessionUserStr = sessionStorage.getItem(SESSION_USER_KEY);
    if (sessionUserStr) {
      try {
        const sessionUser = JSON.parse(sessionUserStr) as User;
        setUser(sessionUser);
      } catch {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // 1. Check banned emails
    const { data: bannedData } = await supabase.from('banned_emails').select('email').eq('email', email).maybeSingle();
    if (bannedData) {
      return { success: false, message: 'This account has been terminated. You cannot log in with this email.' };
    }

    // 2. Query users for login
    const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password).maybeSingle();

    if (data && !error) {
      // Keep camelCase for JS, assuming Supabase data might naturally match if mapped, 
      // but in our SQL, `created_at` etc are snake_case. The `User` interface doesn't have created_at.
      const userObj = data as User;
      setUser(userObj);
      // Persist in sessionStorage (survives refresh, cleared on tab close)
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(userObj));
      return { success: true, message: 'Login successful!', user: userObj };
    }

    return { success: false, message: 'Invalid email or password' };
  };

  const register = async (email: string, password: string, name: string, role: 'patient' | 'doctor') => {
    // 1. Check banned emails
    const { data: bannedData } = await supabase.from('banned_emails').select('email').eq('email', email).maybeSingle();
    if (bannedData) {
      return { success: false, message: 'This email is blocked from registration. Please use a different email.' };
    }

    // 2. Check duplicate email
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
      return { success: false, message: 'This email is already registered.' };
    }

    // Generate a random ID for the new user
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password, // In a real app, never store plain text passwords!
      name,
      role,
      phone: '',
      address: '',
      balance: 0
    };

    const { error } = await supabase.from('users').insert(newUser);

    if (error) {
      console.error("Error creating user:", error);
      return { success: false, message: 'Registration failed due to a server error.' };
    }

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
