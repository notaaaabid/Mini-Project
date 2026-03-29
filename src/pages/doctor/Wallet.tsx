import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { History, Wallet as WalletIcon, DollarSign, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const DoctorWallet = () => {
    const navigate = useNavigate();
    const { balance, transactions, requestPayout, isLoading } = useWallet();
    const { user } = useAuth();
    const [amount, setAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [conversionRate, setConversionRate] = useState<string | null>(null);

    useEffect(() => {
        setConversionRate("1.0");
    }, []);

    const handlePayout = async (e: React.FormEvent) => {
        e.preventDefault();
        const payoutAmount = parseFloat(amount);

        if (isNaN(payoutAmount) || payoutAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        if (payoutAmount > balance) {
            toast.error("Insufficient balance");
            return;
        }

        setIsProcessing(true);
        const success = await requestPayout(payoutAmount);
        setIsProcessing(false);
        if (success) {
            setAmount("");
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Doctor Earnings</h1>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <WalletIcon className="w-5 h-5" />
                    <span>Wallet ID: {user?.id.slice(0, 8)}...</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Balance Card */}
                <Card className="bg-secondary text-secondary-foreground">
                    <CardHeader>
                        <CardTitle className="text-lg font-medium opacity-90">Current Earnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{Math.floor(balance)} Credits</div>
                        <p className="text-sm opacity-80 mt-2">Total accumulated earnings from consultations.</p>
                        {conversionRate && (
                            <div className="mt-4 pt-4 border-t border-secondary-foreground/20">
                                <p className="text-sm font-medium opacity-90">Estimated Value:</p>
                                <p className="text-2xl font-bold">${(Math.floor(balance) * parseFloat(conversionRate)).toFixed(2)}</p>
                                <p className="text-xs opacity-70">Rate: 1 Credit = ${parseFloat(conversionRate).toFixed(2)}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payout Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Request Payout</CardTitle>
                        <CardDescription>Withdraw your earnings to your bank account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePayout} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount (Credits)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">Cr</span>
                                    <Input
                                        id="amount"
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="pl-8"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        disabled={isProcessing}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Available to withdraw: {Math.floor(balance)} Credits</p>
                                {conversionRate && amount && !isNaN(parseFloat(amount)) && (
                                    <p className="text-xs text-green-600 font-medium">
                                        You will receive approx. ${(Math.floor(parseFloat(amount)) * parseFloat(conversionRate)).toFixed(2)}
                                    </p>
                                )}
                            </div>
                            <Button type="submit" className="w-full" disabled={isProcessing || !amount}>
                                {isProcessing ? (
                                    "Processing..."
                                ) : (
                                    <>
                                        <DollarSign className="w-4 h-4 mr-2" />
                                        Request Payout
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions History */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        <CardTitle>Transaction History</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        No transactions found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell>{format(new Date(txn.created_at), "MMM d, yyyy h:mm a")}</TableCell>
                                        <TableCell className="capitalize">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${['deposit', 'refund', 'consultation_credit'].includes(txn.type)
                                                ? "bg-green-100 text-green-800"
                                                : "bg-red-100 text-red-800"
                                                }`}>
                                                {txn.type.replace(/_/g, ' ')}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {txn.description === 'Refund' || txn.description === 'Refund: Item Out of Stock / Damaged'
                                                ? 'Refunded for known issues'
                                                : txn.description.replace('Refund: Item Out of Stock / Damaged', 'Refunded for known issues')}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${txn.amount > 0 ? "text-green-600" : "text-red-600"
                                            }`}>
                                            {txn.amount > 0 ? "+" : "-"}{Math.abs(txn.amount).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default DoctorWallet;
