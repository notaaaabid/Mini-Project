import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Search, Edit2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getData, STORAGE_KEYS, User } from '@/lib/data';
import { useWallet } from '@/contexts/WalletContext';

interface UserWallet {
    id: string;
    balance: number;
    user_id: string;
    profiles: {
        full_name: string;
        email: string;
        role: string;
    };
}

const WalletManagement = () => {
    const navigate = useNavigate();
    const [wallets, setWallets] = useState<UserWallet[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'patient' | 'doctor'>('patient');

    const { addCredits } = useWallet();



    // Dialog State
    const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');
    const [adjustmentReasonType, setAdjustmentReasonType] = useState('preset1');
    const [adjustmentType, setAdjustmentType] = useState<'refund'>('refund');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchWallets();
    }, []);

    const fetchWallets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('wallets')
            .select('*, profiles(full_name, email, role)');

        let finalWallets: UserWallet[] = [];

        const localUsers = getData<User[]>(STORAGE_KEYS.USERS, []);
        const localMapped: UserWallet[] = localUsers.map((u: any) => ({
            id: u.id,
            balance: u.balance || 0,
            user_id: u.id,
            profiles: {
                full_name: u.name,
                email: u.email,
                role: u.role
            }
        }));

        if (!error && data && data.length > 0) {
            finalWallets = [...(data as any)];
            // Add local users that are not in the DB
            const dbIds = new Set(finalWallets.map(w => w.user_id));
            localMapped.forEach(lw => {
                if (!dbIds.has(lw.user_id)) finalWallets.push(lw);
            });
        } else {
            console.log('Falling back to local storage USERS');
            finalWallets = localMapped;
        }

        // Deduplicate by full name first, then email
        const uniqueWalletsMap = new Map();
        finalWallets.forEach(w => {
            const email = (w.profiles?.email || (w as any).email || '').toLowerCase();
            const name = (w.profiles?.full_name || (w as any).name || '').toLowerCase();

            // Hard hide Lisa Martinez / D5
            if (email.includes('lisa@test.com') || name.includes('lisa martinez') || w.user_id === 'd5') {
                return;
            }

            const key = (w.profiles?.full_name || w.profiles?.email || w.user_id).toLowerCase().trim();
            if (!uniqueWalletsMap.has(key)) {
                uniqueWalletsMap.set(key, w);
            }
        });

        setWallets(Array.from(uniqueWalletsMap.values()));
        setLoading(false);
    };



    const handleAdjustment = async () => {
        if (!selectedWallet || !adjustmentAmount) return;

        setProcessing(true);
        const amount = parseFloat(adjustmentAmount);

        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount');
            setProcessing(false);
            return;
        }

        const isDoctor = (selectedWallet.profiles?.role || (selectedWallet as any).role) === 'doctor';

        let finalDescription = '';
        if (adjustmentReasonType === 'preset1') {
            finalDescription = isDoctor ? 'Manual Wallet Adjustment via Admin' : 'Refund: Item Out of Stock / Damaged';
        } else if (adjustmentReasonType === 'preset2') {
            finalDescription = isDoctor ? 'Bonus / Incentive' : 'Refund: Consultation Cancelled';
        } else {
            finalDescription = adjustmentReason.trim() ? adjustmentReason.trim() : (isDoctor ? 'Manual Wallet Adjustment via Admin' : 'Refunded for known issues');
        }

        const txnType = isDoctor ? 'manual_adjustment' : 'refund';

        const success = await addCredits(amount, finalDescription, selectedWallet.user_id, txnType);

        if (!success) {
            toast.error('Refund failed');
        } else {
            toast.success('Refund processed successfully');
            setSelectedWallet(null);
            setAdjustmentAmount('');
            setAdjustmentReason('');
            setAdjustmentReasonType('preset1');
            fetchWallets();
        }
        setProcessing(false);
    };

    const filteredWallets = wallets.filter(w => {
        const name = (w.profiles?.full_name || (w as any).name || '').toLowerCase();
        const email = (w.profiles?.email || (w as any).email || '').toLowerCase();
        const role = ((w.profiles?.role || (w as any).role) || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return role === roleFilter && (name.includes(search) || email.includes(search));
    });

    return (
        <div className="min-h-screen bg-background flex">
            <AdminSidebar />
            <div className="flex-1 ml-64 p-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-3xl font-bold">Refund Management</h1>
                    </div>
                </div>

                <div className="grid gap-6 mb-6">


                    {/* User Balances Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>User Balances</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <div className="flex p-1 bg-muted rounded-lg">
                                    <Button
                                        variant={roleFilter === 'patient' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setRoleFilter('patient')}
                                        className="w-24"
                                    >
                                        Patients
                                    </Button>
                                    <Button
                                        variant={roleFilter === 'doctor' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setRoleFilter('doctor')}
                                        className="w-24"
                                    >
                                        Doctors
                                    </Button>
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <Search className="text-muted-foreground w-4 h-4 hidden sm:block" />
                                    <Input
                                        placeholder="Search by name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="max-w-sm w-full"
                                    />
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                                            </TableRow>
                                        ) : filteredWallets.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredWallets.map((wallet) => (
                                                <TableRow key={wallet.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{wallet.profiles?.full_name || 'N/A'}</div>
                                                        <div className="text-sm text-muted-foreground">{wallet.profiles?.email}</div>
                                                    </TableCell>
                                                    <TableCell className="capitalize">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${(wallet.profiles?.role || (wallet as any).role) === 'doctor'
                                                            ? "bg-blue-100 text-blue-800"
                                                            : "bg-gray-100 text-gray-800"
                                                            }`}>
                                                            {wallet.profiles?.role || (wallet as any).role}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-medium">{wallet.balance.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm" onClick={() => {
                                                                    setSelectedWallet(wallet);
                                                                    setAdjustmentReason('');
                                                                    setAdjustmentReasonType('preset1');
                                                                }}>
                                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                                    {(wallet.profiles?.role || (wallet as any).role) === 'doctor' ? 'Adjustment' : 'Refund'}
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent>
                                                                <DialogHeader>
                                                                    <DialogTitle>
                                                                        {(wallet.profiles?.role || (wallet as any).role) === 'doctor'
                                                                            ? 'Manual Wallet Adjustment'
                                                                            : 'Issue Refund to User'}
                                                                    </DialogTitle>
                                                                </DialogHeader>
                                                                <div className="py-4 space-y-4">
                                                                    <div className="p-3 bg-muted rounded-lg">
                                                                        <p className="text-sm font-medium">User: {wallet.profiles?.full_name || (wallet as any).name}</p>
                                                                        <p className="text-sm text-muted-foreground">Current Balance: {wallet.balance.toFixed(2)}</p>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <label className="text-sm font-medium">Amount</label>
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="0.00"
                                                                            value={adjustmentAmount}
                                                                            onChange={(e) => setAdjustmentAmount(e.target.value)}
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <label className="text-sm font-medium">Reason</label>
                                                                        <div className="space-y-2">
                                                                            <label className="flex items-center space-x-2">
                                                                                <input type="radio" name="reasonType" value="preset1" checked={adjustmentReasonType === 'preset1'} onChange={(e) => setAdjustmentReasonType(e.target.value)} className="accent-primary" />
                                                                                <span className="text-sm">{((wallet.profiles?.role || (wallet as any).role) === 'doctor') ? 'Manual Wallet Adjustment via Admin' : 'Refund: Item Out of Stock / Damaged'}</span>
                                                                            </label>
                                                                            <label className="flex items-center space-x-2">
                                                                                <input type="radio" name="reasonType" value="preset2" checked={adjustmentReasonType === 'preset2'} onChange={(e) => setAdjustmentReasonType(e.target.value)} className="accent-primary" />
                                                                                <span className="text-sm">{((wallet.profiles?.role || (wallet as any).role) === 'doctor') ? 'Bonus / Incentive' : 'Refund: Consultation Cancelled'}</span>
                                                                            </label>
                                                                            <label className="flex items-center space-x-2">
                                                                                <input type="radio" name="reasonType" value="custom" checked={adjustmentReasonType === 'custom'} onChange={(e) => setAdjustmentReasonType(e.target.value)} className="accent-primary" />
                                                                                <span className="text-sm">Other (Specify manually)</span>
                                                                            </label>
                                                                        </div>
                                                                    </div>

                                                                    {adjustmentReasonType === 'custom' && (
                                                                        <div className="space-y-2 pt-2 border-t mt-2">
                                                                            <Input
                                                                                type="text"
                                                                                placeholder="Type custom reason..."
                                                                                value={adjustmentReason}
                                                                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button onClick={handleAdjustment} disabled={processing} className="w-full">
                                                                        {processing ? 'Processing...' : ((wallet.profiles?.role || (wallet as any).role) === 'doctor' ? 'Confirm Adjustment' : 'Confirm Refund')}
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default WalletManagement;
