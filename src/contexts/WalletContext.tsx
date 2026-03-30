import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchWalletData();
        } else {
            setBalance(0);
            setTransactions([]);
        }
    }, [user]);

    const fetchWalletData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Fetch balance
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', user.id)
                .single();
                
            if (userData && !userError) {
                setBalance(userData.balance || 0);
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
        } catch (error) {
            console.error('Error in fetchWalletData:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createTransaction = async (amount: number, type: string, description: string, targetUserId?: string) => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return;

        try {
            const txn = {
                id: `TXN${Date.now()}`,
                user_id: targetId,
                amount,
                type,
                description,
                created_at: new Date().toISOString(),
            };
            
            await supabase.from('transactions').insert(txn);
        } catch (err) {
            console.error('Error creating transaction:', err);
        }
    };

    const addCredits = async (amount: number, description: string = 'Added credits', targetUserId?: string, type: 'deposit' | 'refund' | 'manual_adjustment' | 'consultation_credit' = 'deposit') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            // Fetch user first to do a manual increment
            const { data: userData, error: fetchErr } = await supabase.from('users').select('balance').eq('id', targetId).single();
            if (fetchErr) throw new Error("Could not fetch user balance");

            const newBalance = (userData?.balance || 0) + amount;
            
            const { error: updateErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
            if (updateErr) throw new Error("Could not update balance");

            await createTransaction(amount, type, description, targetId);

            if (!targetUserId || targetUserId === user?.id) {
                await fetchWalletData();
            }

            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error adding credits:', error);
            toast.error(error.message || 'Failed to add credits');
            return false;
        }
    };

    const deductCredits = async (amount: number, description: string, targetUserId?: string, type: 'purchase' | 'payout' | 'manual_adjustment' = 'purchase') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            const { data: userData, error: fetchErr } = await supabase.from('users').select('balance').eq('id', targetId).single();
            if (fetchErr) throw new Error("Could not fetch user balance");

            if ((userData?.balance || 0) < amount) {
                throw new Error("Insufficient balance");
            }

            const newBalance = (userData.balance || 0) - amount;

            const { error: updateErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', targetId);
            if (updateErr) throw new Error("Failed to deduct from balance");

            await createTransaction(-amount, type, description, targetId);

            if (!targetUserId || targetUserId === user?.id) {
                await fetchWalletData();
            }

            return true;
        } catch (error: any) {
            console.error('Error deducting credits:', error);
            toast.error(error.message || 'Failed to deduct credits');
            return false;
        }
    };

    const transferCredits = async (amount: number, receiverId: string, description: string) => {
        if (!user) return false;
        
        try {
            const deductSuccess = await deductCredits(amount, description, user.id, 'purchase');
            if (!deductSuccess) {
                throw new Error('Failed to deduct from sender.');
            }

            const addSuccess = await addCredits(amount, description, receiverId, 'consultation_credit');
            if (!addSuccess) {
                console.error('[WalletContext] Critical: Failed to add to receiver after deducting from sender!');
                throw new Error('Failed to transfer to receiver wallet.');
            }

            await fetchWalletData();
            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error transferring credits:', error);
            toast.error(error.message || 'Failed to transfer credits');
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
