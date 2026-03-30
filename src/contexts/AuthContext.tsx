import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, initializeData, initialUsers } from '@/lib/data';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  register: (email: string, password: string, name: string, role: 'patient' | 'doctor') => Promise<{ success: boolean; message: string; session?: any; user?: any }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'medicare_current_user';
const LAST_EMAIL_KEY = 'medicare_last_email';
const LOCAL_USERS_LIST = 'medicare_users';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      // Initialize Supabase data asynchronously
      initializeData();

      // Seed admin into LocalStorage synchronously
      let localUsers: User[] = [];
      try {
        const storedUsers = localStorage.getItem(LOCAL_USERS_LIST);
        if (storedUsers) localUsers = JSON.parse(storedUsers);
      } catch (e) {
        localUsers = [];
      }

      if (!localUsers.some(u => u.role === 'admin' && u.email === 'admin@test.com')) {
        localUsers.push(initialUsers[0]);
        localStorage.setItem(LOCAL_USERS_LIST, JSON.stringify(localUsers));
      }

      // Check URL config for Supabase
      const url = (supabase as any).supabaseUrl;
      const hasSupabase = url && !url.includes('undefined');

      // Sync Mobile/Desktop Users (Bug 9)
      if (hasSupabase && !sessionStorage.getItem('medicare_synced_this_session')) {
        try {
          const { data, error } = await supabase.from('users').select('*');
          if (data && !error && data.length > 0) {
             localStorage.setItem(LOCAL_USERS_LIST, JSON.stringify(data));
             sessionStorage.setItem('medicare_synced_this_session', 'true');
             localUsers = data as User[]; // Update active ref
          }
        } catch (e) {
           console.error("Failed to sync users list from Supabase", e);
        }
      }

      let activeUser: User | null = null;
      // Bug 1 & 2: Check localStorage for current session
      const storedUserStr = localStorage.getItem(LOCAL_USER_KEY);
      if (storedUserStr) {
        try {
          activeUser = JSON.parse(storedUserStr) as User;
        } catch {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      }

      // Bug 2: Mobile fragile re-login using last email fallback
      if (!activeUser) {
        const lastEmail = localStorage.getItem(LAST_EMAIL_KEY);
        if (lastEmail) {
           // Find locally first
           const localMatch = localUsers.find(u => u.email === lastEmail);
           if (localMatch) {
             activeUser = localMatch;
             localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(activeUser));
           } else if (hasSupabase) {
             // Fallback to supabase fetch
             try {
                const { data, error } = await supabase.from('users').select('*').eq('email', lastEmail).maybeSingle();
                if (data && !error) {
                   activeUser = data as User;
                   localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(activeUser));
                }
             } catch (e) {
                console.error("Failed silent re-login", e);
             }
           }
        }
      }

      if (isMounted) {
        setUser(activeUser);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => { isMounted = false; };
  }, []);

  const login = async (email: string, password: string) => {
    // 1. Check banned emails block
    try {
      const url = (supabase as any).supabaseUrl;
      if (url && !url.includes('undefined')) {
        const { data: bannedData } = await supabase.from('banned_emails').select('email').eq('email', email).maybeSingle();
        if (bannedData) {
          return { success: false, message: 'This account has been terminated. You cannot log in with this email.' };
        }
      }
    } catch(e) {}

    // 2. Try Login Local first (Offline First)
    let localUsers: User[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_USERS_LIST);
      if (stored) localUsers = JSON.parse(stored);
    } catch {}

    let userObj = localUsers.find(u => u.email === email && u.password === password);

    // 3. Fallback to Supabase if local completely fails or empty
    if (!userObj) {
      try {
         const url = (supabase as any).supabaseUrl;
         if (url && !url.includes('undefined')) {
           const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password).maybeSingle();
           if (data && !error) {
              userObj = data as User;
              // Add to local array to heal the cache
              localUsers.push(userObj);
              localStorage.setItem(LOCAL_USERS_LIST, JSON.stringify(localUsers));
           }
         }
      } catch (error) {
         console.error("Supabase login fallback failed", error);
      }
    }

    if (userObj) {
      setUser(userObj);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userObj));
      localStorage.setItem(LAST_EMAIL_KEY, userObj.email);
      return { success: true, message: 'Login successful!', user: userObj };
    }

    return { success: false, message: 'Invalid email or password' };
  };

  const register = async (email: string, password: string, name: string, role: 'patient' | 'doctor') => {
    try {
       const url = (supabase as any).supabaseUrl;
       if (url && !url.includes('undefined')) {
          const { data: bannedData } = await supabase.from('banned_emails').select('email').eq('email', email).maybeSingle();
          if (bannedData) {
            return { success: false, message: 'This email is blocked from registration. Please use a different email.' };
          }
       }
    } catch(e) {}

    let localUsers: User[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_USERS_LIST);
      if (stored) localUsers = JSON.parse(stored);
    } catch {}

    const existingLocal = localUsers.find(u => u.email === email);
    if (existingLocal) {
       return { success: false, message: 'This email is already registered locally.' };
    }

    // Generate random ID
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password, // Plain text for mock requirements
      name,
      role,
      phone: '',
      address: '',
      balance: 0
    };

    // Bug 3: Save to localStorage FIRST
    localUsers.push(newUser);
    localStorage.setItem(LOCAL_USERS_LIST, JSON.stringify(localUsers));

    // Async Insert to Supabase Background
    Promise.resolve().then(async () => {
      try {
         const url = (supabase as any).supabaseUrl;
         if (url && !url.includes('undefined')) {
            await supabase.from('users').insert(newUser);
         }
      } catch (e) {
         console.error("Failed to sync new user to Supabase:", e);
      }
    });

    // Auto-login
    setUser(newUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(LAST_EMAIL_KEY, newUser.email);

    return {
      success: true,
      message: 'Registration successful!',
      session: { user: newUser, access_token: 'mock-token' },
      user: newUser
    };
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(LOCAL_USER_KEY);
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
