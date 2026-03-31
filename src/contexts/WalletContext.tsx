import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { User } from '@/lib/data';

export interface Transaction {
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
    user_id?: string;
}

interface WalletContextType {
    balance: number;
    transactions: Transaction[];
    isLoading: boolean;
    addCredits: (amount: number, description?: string, targetUserId?: string, type?: string) => Promise<boolean>;
    deductCredits: (amount: number, description: string, targetUserId?: string, type?: string) => Promise<boolean>;
    transferCredits: (amount: number, receiverId: string, receiverDescription: string, senderDescription?: string) => Promise<boolean>;
    requestPayout: (amount: number, description?: string, type?: string) => Promise<boolean>;
    refreshWallet: () => Promise<void>;
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
            setBalance(user.balance || 0);
            fetchWalletData();
        } else {
            setBalance(0);
            setTransactions([]);
        }
    }, [user]);

    // Update Local Storage User Profile Function Helpers
    const updateLocalUserBalance = (userId: string, newBalance: number) => {
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
                const { data: userData } = await supabase.from('users').select('balance').eq('id', user.id).single();
                if (userData) {
                    setBalance(userData.balance || 0);
                    updateLocalUserBalance(user.id, userData.balance || 0);
                }

                // Fetch transactions from Supabase
                const { data: txns, error: txnError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (txns && !txnError) {
                    setTransactions(txns as Transaction[]);
                    localStorage.setItem(`medicare_transactions_${user.id}`, JSON.stringify(txns));
                } else {
                    throw new Error("Supabase fetch failed");
                }
            }
        } catch (error) {
            console.error('Fallback to local transactions', error);
            const localTx = localStorage.getItem(`medicare_transactions_${user.id}`);
            if (localTx) {
               setTransactions(JSON.parse(localTx));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const addCredits = async (amount: number, description: string = 'Credits added to wallet', targetUserId?: string, type: string = 'deposit') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            const currentBalance = fetchLocalBalance(targetId);
            const newBalance = currentBalance + amount;
            
            updateLocalUserBalance(targetId, newBalance);
            if (targetId === user?.id) setBalance(newBalance);

            const txn = {
                id: `TXN${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                user_id: targetId,
                amount,
                type,
                description,
                created_at: new Date().toISOString(),
            };

            const url = (supabase as any).supabaseUrl;
            if (url && !url.includes('undefined')) {
               // Bug 5: Update users table balance explicitly
               await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
               // Bug 5: Always await transaction insert
               await supabase.from('transactions').insert(txn);
            }

            if (targetId === user?.id) {
               const newTxns = [txn as Transaction, ...transactions];
               setTransactions(newTxns);
               localStorage.setItem(`medicare_transactions_${user.id}`, JSON.stringify(newTxns));
            }

            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error adding credits:', error);
            toast.error(error.message || 'Failed to add credits');
            return false;
        }
    };

    const deductCredits = async (amount: number, description: string, targetUserId?: string, type: string = 'purchase') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            const currentBalance = fetchLocalBalance(targetId);
            if (currentBalance < amount) {
                toast.error("Insufficient balance!");
                throw new Error("Insufficient balance");
            }

            const newBalance = currentBalance - amount;

            updateLocalUserBalance(targetId, newBalance);
            if (targetId === user?.id) setBalance(newBalance);

            const txn = {
                id: `TXN${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                user_id: targetId,
                amount: -amount, // Negative amount 
                type,
                description,
                created_at: new Date().toISOString(),
            };

            const url = (supabase as any).supabaseUrl;
            if (url && !url.includes('undefined')) {
               await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
               await supabase.from('transactions').insert(txn);
            }

            if (targetId === user?.id) {
               const newTxns = [txn as Transaction, ...transactions];
               setTransactions(newTxns);
               localStorage.setItem(`medicare_transactions_${user.id}`, JSON.stringify(newTxns));
            }

            return true;
        } catch (error: any) {
            console.error('Error deducting credits:', error);
            return false;
        }
    };

    const transferCredits = async (amount: number, receiverId: string, receiverDescription: string, senderDescription?: string) => {
        if (!user) return false;
        
        try {
            const senderDesc = senderDescription || `Consultation payment`;
            const deductSuccess = await deductCredits(amount, senderDesc, user.id, 'purchase');
            if (!deductSuccess) throw new Error('Failed to deduct from sender.');

            const addSuccess = await addCredits(amount, receiverDescription, receiverId, 'consultation_credit');
            if (!addSuccess) {
                throw new Error('Failed to transfer to receiver wallet.');
            }

            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error transferring credits:', error);
            return false;
        }
    };

    const requestPayout = async (amount: number, description: string = 'Transfer to bank', type: string = 'withdrawal') => {
        if (!user) return false;
        try {
            const success = await deductCredits(amount, description, user.id, type);
            if (success) {
                toast.success(`Withdrawal of $${amount} credits processed to bank.`);
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
        <WalletContext.Provider value={{ balance, transactions, isLoading, addCredits, deductCredits, transferCredits, requestPayout, refreshWallet: fetchWalletData }}>
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
