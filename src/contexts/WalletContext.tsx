import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { User } from '@/lib/data';

export interface Transaction {
    id: string;
    amount: number;
    type: 'deposit' | 'purchase' | 'refund' | 'payout' | 'withdrawal' | 'consultation_credit' | 'manual_adjustment';
    description: string;
    created_at: string;
    user_id?: string;
}

interface WalletContextType {
    balance: number;
    transactions: Transaction[];
    isLoading: boolean;
    addCredits: (amount: number, description?: string, targetUserId?: string, type?: 'deposit' | 'refund' | 'manual_adjustment' | 'consultation_credit') => Promise<boolean>;
    deductCredits: (amount: number, description: string, targetUserId?: string, type?: 'purchase' | 'payout' | 'manual_adjustment') => Promise<boolean>;
    transferCredits: (amount: number, receiverId: string, description: string) => Promise<boolean>;
    requestPayout: (amount: number, description?: string, type?: 'payout' | 'withdrawal') => Promise<boolean>;
    refreshWallet: () => Promise<void>;
    createTransaction: (amount: number, type: string, description: string, targetUserId?: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'medicare_current_user';
const LOCAL_USERS_LIST = 'medicare_users';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            // Bug 8: Seed fast local balance first
            setBalance(user.balance || 0);
            fetchWalletData();
        } else {
            setBalance(0);
            setTransactions([]);
        }
    }, [user]);

    // Update Local Storage User Profile Function Helpers
    const updateLocalUserBalance = (userId: string, newBalance: number) => {
        // Update generic users list
        try {
           const storedStr = localStorage.getItem(LOCAL_USERS_LIST);
           if (storedStr) {
               const users = JSON.parse(storedStr) as User[];
               const idx = users.findIndex(u => u.id === userId);
               if (idx !== -1) {
                   users[idx].balance = newBalance;
                   localStorage.setItem(LOCAL_USERS_LIST, JSON.stringify(users));
               }
           }
        } catch(e) {}

        // Update current session user specifically correctly if target is current user
        if (user?.id === userId) {
            try {
               const sessionStr = localStorage.getItem(LOCAL_USER_KEY);
               if (sessionStr) {
                  const sUser = JSON.parse(sessionStr) as User;
                  sUser.balance = newBalance;
                  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(sUser));
               }
            } catch(e) {}
        }
    };

    const fetchLocalBalance = (userId: string): number => {
        let bestBalance = 0;
        try {
           const storedStr = localStorage.getItem(LOCAL_USERS_LIST);
           if (storedStr) {
               const users = JSON.parse(storedStr) as User[];
               const match = users.find(u => u.id === userId);
               if (match) bestBalance = match.balance || 0;
           }
        } catch(e) {}
        return bestBalance;
    };


    const fetchWalletData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const url = (supabase as any).supabaseUrl;
            if (url && !url.includes('undefined')) {
                // Fetch balance safely
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('balance')
                    .eq('id', user.id)
                    .single();
                    
                if (userData && !userError) {
                    setBalance(userData.balance || 0);
                    updateLocalUserBalance(user.id, userData.balance || 0);
                }

                // Fetch transactions
                const { data: txns, error: txnError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (txns && !txnError) {
                    setTransactions(txns as Transaction[]);
                }
            }
        } catch (error) {
            console.error('Error in fetchWalletData:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createTransaction = async (amount: number, type: string, description: string, targetUserId?: string) => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return;

        const txn = {
            id: `TXN${Date.now()}`,
            user_id: targetId,
            amount,
            type,
            description,
            created_at: new Date().toISOString(),
        };

        // Non-blocking try/catch background insert 
        Promise.resolve().then(async () => {
           try {
              const url = (supabase as any).supabaseUrl;
              if (url && !url.includes('undefined')) {
                 await supabase.from('transactions').insert(txn);
              }
           } catch (err) {
              console.error('Fallback sync failed:', err);
           }
        });
    };

    const addCredits = async (amount: number, description: string = 'Added credits', targetUserId?: string, type: 'deposit' | 'refund' | 'manual_adjustment' | 'consultation_credit' = 'deposit') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            // Bug 8: Offline First Operation
            const currentBalance = fetchLocalBalance(targetId);
            const newBalance = currentBalance + amount;
            
            // Sync Local immediately 
            updateLocalUserBalance(targetId, newBalance);
            if (targetId === user?.id) setBalance(newBalance);

            // Sync API Background Non-blocking
            Promise.resolve().then(async () => {
               try {
                  const url = (supabase as any).supabaseUrl;
                  if (url && !url.includes('undefined')) {
                     await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
                  }
               } catch (e) {
                  console.error("Wallet cloud update skipped/failed", e);
               }
            });

            await createTransaction(amount, type, description, targetId);

            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error adding credits:', error);
            toast.error(error.message || 'Failed to add credits');
            return false;
        }
    };

    const deductCredits = async (amount: number, description: string, targetUserId?: string, type: 'purchase' | 'payout' | 'manual_adjustment' | 'withdrawal' = 'purchase') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            const currentBalance = fetchLocalBalance(targetId);
            if (currentBalance < amount) {
                toast.error("Insufficient balance locally tracked!");
                throw new Error("Insufficient balance");
            }

            const newBalance = currentBalance - amount;

            // Sync Local Immediately
            updateLocalUserBalance(targetId, newBalance);
            if (targetId === user?.id) setBalance(newBalance);

            // Sync API Background 
            Promise.resolve().then(async () => {
               try {
                  const url = (supabase as any).supabaseUrl;
                  if (url && !url.includes('undefined')) {
                     await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
                  }
               } catch(e) {
                  console.error("Cloud failed to execute deduction", e);
               }
            });

            await createTransaction(-amount, type, description, targetId);

            return true;
        } catch (error: any) {
            console.error('Error deducting credits:', error);
            return false;
        }
    };

    const transferCredits = async (amount: number, receiverId: string, description: string) => {
        if (!user) return false;
        
        try {
            const deductSuccess = await deductCredits(amount, description, user.id, 'purchase');
            if (!deductSuccess) throw new Error('Failed to deduct from sender.');

            const addSuccess = await addCredits(amount, description, receiverId, 'consultation_credit');
            if (!addSuccess) {
                console.error('[WalletContext] Critical: Failed to add to receiver after deducting from sender!');
                throw new Error('Failed to transfer to receiver wallet.');
            }

            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error transferring credits:', error);
            return false;
        }
    };

    const requestPayout = async (amount: number, description: string = 'Payout processed to Bank', type: 'payout' | 'withdrawal' = 'payout') => {
        if (!user) return false;
        try {
            const success = await deductCredits(amount, description, user.id, type);
            if (success) {
                toast.success(`${type === 'withdrawal' ? 'Withdrawal' : 'Payout'} of ${amount} credits processed to bank.`);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Error processing payout:', error);
            toast.error(error.message || 'Failed to process payout');
            return false;
        }
    };

    return (
        <WalletContext.Provider value={{ balance, transactions, isLoading, addCredits, deductCredits, transferCredits, requestPayout, refreshWallet: fetchWalletData, createTransaction }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};
