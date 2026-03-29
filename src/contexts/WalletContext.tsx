import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getData, setData, STORAGE_KEYS } from '@/lib/data';

const dataChannel = new BroadcastChannel('medicare_data_updates');

export interface Transaction {
    id: string;
    amount: number;
    type: 'deposit' | 'purchase' | 'refund' | 'payout' | 'withdrawal' | 'consultation_credit' | 'manual_adjustment';
    description: string;
    created_at: string;
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

            // Listen for local data updates (dispatched by setData)
            const handleLocalUpdate = () => {
                fetchWalletData();
            };
            window.addEventListener('localDataUpdate', handleLocalUpdate);
            // Also listen for storage events (cross-tab)
            window.addEventListener('storage', handleLocalUpdate);

            // Listen for BroadcastChannel updates
            const channel = new BroadcastChannel('medicare_data_updates');
            channel.onmessage = (event) => {
                if (event.data.type === 'update') {
                    console.log('[WalletContext] Received broadcast update:', event.data);
                    fetchWalletData();
                }
            };

            return () => {
                window.removeEventListener('localDataUpdate', handleLocalUpdate);
                window.removeEventListener('storage', handleLocalUpdate);
                channel.close();
            };
        } else {
            setBalance(0);
            setTransactions([]);
        }
    }, [user]);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const fetchWalletData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const users = getData<any[]>(STORAGE_KEYS.USERS, []);
            const currentUser = users.find(u => u.id === user.id);
            setBalance(currentUser?.balance || 0);

            // Read local transactions for this user
            const allLocalTxns = getData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
            const userTxns = allLocalTxns
                .filter(t => (t as any).userId === user.id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setTransactions(userTxns);
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
            const txn: Transaction & { userId: string } = {
                id: `TXN${Date.now()}`,
                amount,
                type: type as any,
                description,
                created_at: new Date().toISOString(),
                userId: targetId,
            };
            const allTxns = getData<any[]>(STORAGE_KEYS.TRANSACTIONS, []);
            allTxns.push(txn);
            setData(STORAGE_KEYS.TRANSACTIONS, allTxns);
            console.log('Local transaction inserted:', description);
        } catch (err) {
            console.error('Error creating transaction:', err);
        }
    };

    const addCredits = async (amount: number, description: string = 'Added credits', targetUserId?: string, type: 'deposit' | 'refund' | 'manual_adjustment' | 'consultation_credit' = 'deposit') => {
        const targetId = targetUserId || user?.id;
        if (!targetId) return false;

        try {
            const users = getData<any[]>(STORAGE_KEYS.USERS, []);
            let userFound = false;
            const updatedUsers = users.map(u => {
                if (u.id === targetId) {
                    userFound = true;
                    return { ...u, balance: (u.balance || 0) + amount };
                }
                return u;
            });
            if (!userFound) return false;
            setData(STORAGE_KEYS.USERS, updatedUsers);

            await createTransaction(amount, type, description, targetId);

            if (!targetUserId || targetUserId === user?.id) {
                await fetchWalletData();
            }
            // Force global refresh for other tabs
            window.dispatchEvent(new Event('localDataUpdate'));
            try {
                const channel = new BroadcastChannel('medicare_data_updates');
                channel.postMessage({ type: 'update' });
                channel.close();
            } catch (e) {
                console.error("Broadcast update failed", e);
            }

            console.log(`[WalletContext] Successfully finished addCredits of ${amount} to ${targetId}`);
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
            const users = getData<any[]>(STORAGE_KEYS.USERS, []);
            const currentUser = users.find(u => u.id === targetId);
            if ((currentUser?.balance || 0) < amount) {
                throw new Error("Insufficient balance (Mock)");
            }

            const updatedUsers = users.map(u => {
                if (u.id === targetId) {
                    return { ...u, balance: (u.balance || 0) - amount };
                }
                return u;
            });
            setData(STORAGE_KEYS.USERS, updatedUsers);

            await createTransaction(-amount, type, description, targetId);

            if (!targetUserId || targetUserId === user?.id) {
                await fetchWalletData();
            }
            // Force global refresh for other tabs
            window.dispatchEvent(new Event('localDataUpdate'));
            try {
                const channel = new BroadcastChannel('medicare_data_updates');
                channel.postMessage({ type: 'update' });
                channel.close();
            } catch (e) {
                console.error("Broadcast update failed", e);
            }

            return true;
        } catch (error: any) {
            console.error('Error deducting credits:', error);
            toast.error(error.message || 'Failed to deduct credits');
            return false;
        }
    };

    const transferCredits = async (amount: number, receiverId: string, description: string) => {
        if (!user) {
            console.error('[WalletContext] transferCredits failed: Missing user');
            return false;
        }
        console.log(`[WalletContext] Initiating transferCredits: ${amount} from ${user.id} to ${receiverId}`);
        try {
            console.log(`[WalletContext] Executing hybrid fallback transfer from ${user.id} to ${receiverId}`);
            // 1. Deduct from Sender
            const deductSuccess = await deductCredits(amount, description, user.id, 'purchase');
            if (!deductSuccess) {
                console.error('[WalletContext] Hybrid transfer failed: Sender deduction failed');
                throw new Error('Failed to deduct from sender.');
            }

            // 2. Add to Receiver (Doctor) - Explicitly using consultation_credit
            const addSuccess = await addCredits(amount, description, receiverId, 'consultation_credit');
            if (!addSuccess) {
                // Critical failure state
                console.error('[WalletContext] Critical: Failed to add to receiver after deducting from sender!');
                throw new Error('Failed to transfer to receiver wallet.');
            }

            // Explicitly broadcast update for the receiver so Admin tabs immediately detect it
            if (receiverId !== user.id) {
                console.log(`[WalletContext] Broadcasting local update for receiver ${receiverId}`);
                const channel = new BroadcastChannel('medicare_data_updates');
                channel.postMessage({ type: 'update', key: STORAGE_KEYS.USERS }); // General update
                channel.postMessage({ type: 'update', key: 'wallet_db_update' }); // Force wallet refetch
                channel.close();
            }

            console.log(`[WalletContext] Finished transferCredits from ${user.id} to ${receiverId} successfully.`);
            await fetchWalletData();
            return true;
        } catch (error: any) {
            console.error('[WalletContext] Error transferring credits:', error);
            toast.error(error.message || 'Failed to transfer credits');
            return false;
        }
    };

    // For doctors to payout and patients to withdraw
    const requestPayout = async (amount: number, description: string = 'Payout processed to Bank', type: 'payout' | 'withdrawal' = 'payout') => {
        if (!user) return false;
        try {
            const users = getData<any[]>(STORAGE_KEYS.USERS, []);
            const currentUser = users.find(u => u.id === user.id);
            if (!currentUser || (currentUser.balance || 0) < amount) {
                throw new Error('Insufficient balance');
            }
            const updatedUsers = users.map(u => {
                if (u.id === user.id) {
                    return { ...u, balance: (u.balance || 0) - amount };
                }
                return u;
            });
            setData(STORAGE_KEYS.USERS, updatedUsers);
            await createTransaction(-amount, type, description, user.id);

            toast.success(`${type === 'withdrawal' ? 'Withdrawal' : 'Payout'} of ${amount} credits processed to bank.`);
            await fetchWalletData();
            return true;
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
