import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getData, setData, STORAGE_KEYS, initializeData } from '@/lib/data';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  register: (email: string, password: string, name: string, role: 'patient' | 'doctor') => Promise<{ success: boolean; message: string; session?: any; user?: any }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session key in sessionStorage (survives page refresh, cleared on tab close)
const SESSION_USER_KEY = 'medicare_session_user';

// Hardcoded demo accounts that live in localStorage only (not in Supabase).
// These allow demo use without a Supabase account.
const DEMO_EMAILS = [
  'patient@test.com',
  'jane@test.com',
  'doctor@test.com',
  'drchen@test.com',
  'emily@test.com',
  'james@test.com',
  'admin@test.com',
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize mock data (medicines, doctors, etc.)
    initializeData();

    // Clear any old localStorage session remnant
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

    // Restore session from sessionStorage if it exists
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

  // ---------------------------------------------------------------------------
  // Fetch a user's profile row from Supabase and build a User object from it
  // ---------------------------------------------------------------------------
  const fetchProfile = async (userId: string, email: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return {
        id: data.id,
        email: data.email || email,
        name: data.full_name || email.split('@')[0],
        role: data.role as 'patient' | 'doctor' | 'admin',
        password: '',
        phone: data.phone || '',
        address: data.address || '',
      };
    } catch (error) {
      console.error('fetchProfile failed:', error);
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------
  const login = async (email: string, password: string) => {
    // 1. Check banned emails
    const banned = getData<string[]>('BANNED_EMAILS', []);
    if (banned.includes(email)) {
      return { success: false, message: 'This account has been terminated. You cannot log in with this email.' };
    }

    // 2. Demo-account fast path (mock localStorage users only)
    //    This keeps the hardcoded demo credentials working without Supabase accounts.
    if (DEMO_EMAILS.includes(email.toLowerCase())) {
      const users = getData<User[]>(STORAGE_KEYS.USERS, []);
      const mockUser = users.find(u => u.email === email && u.password === password);
      if (mockUser) {
        setUser(mockUser);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(mockUser));
        return { success: true, message: 'Login successful!', user: mockUser };
      }
      // If demo email but wrong password → fall through to get a proper error
    }

    // 3. Supabase login — the real path for ALL registered users
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Translate common Supabase errors into user-friendly messages
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, message: 'Invalid email or password. Please try again.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, message: 'Please verify your email address before logging in. Check your inbox.' };
      }
      return { success: false, message: error.message };
    }

    if (!data.user) {
      return { success: false, message: 'Login failed. Please try again.' };
    }

    // 4. Fetch the profile row to get the role
    const profile = await fetchProfile(data.user.id, data.user.email!);

    if (!profile) {
      // Profile row missing — create a fallback (shouldn't normally happen)
      const fallback: User = {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.email!.split('@')[0],
        role: 'patient',
        password: '',
      };
      setUser(fallback);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(fallback));
      return { success: true, message: 'Login successful!', user: fallback };
    }

    setUser(profile);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(profile));
    return { success: true, message: 'Login successful!', user: profile };
  };

  // ---------------------------------------------------------------------------
  // REGISTER
  // ---------------------------------------------------------------------------
  const register = async (email: string, password: string, name: string, role: 'patient' | 'doctor') => {
    // Check banned emails
    const banned = getData<string[]>('BANNED_EMAILS', []);
    if (banned.includes(email)) {
      return { success: false, message: 'This email is blocked from registration. Please use a different email.' };
    }

    // Sign up via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          name,
          role,
          avatar_url: '',
          phone: '',
          address: '',
        },
      },
    });

    if (error) {
      console.error('Supabase signup error:', error);
      if (error.message.includes('User already registered')) {
        return { success: false, message: 'An account with this email already exists. Please log in instead.' };
      }
      return { success: false, message: error.message };
    }

    if (!data.user) {
      return { success: false, message: 'Registration failed. Please try again.' };
    }

    // Insert profile row manually (the DB trigger should also do this, but upsert for safety)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: name,
      role,
      phone: '',
      address: '',
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile insert error:', profileError);
      // Non-fatal — the DB trigger may have already created it
    }

    // If Supabase returned a session (email confirmation disabled), auto-login
    if (data.session) {
      const newUser: User = {
        id: data.user.id,
        email,
        name,
        role,
        password: '',
      };
      setUser(newUser);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));
      return {
        success: true,
        message: 'Account created successfully!',
        session: data.session,
        user: newUser,
      };
    }

    // Email confirmation is enabled — user must verify before logging in
    return {
      success: true,
      message: 'Account created! Please check your email to verify your account before logging in.',
      session: null,
      user: data.user,
    };
  };

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------
  const logout = async () => {
    await supabase.auth.signOut();
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
