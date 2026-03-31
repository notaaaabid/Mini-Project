import { useState, useEffect } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, Search, Loader2, Wallet, Plus, Minus, Database, HardDrive, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { User } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useWallet } from "@/contexts/WalletContext";

interface PatientWithBalance extends User {
    balance?: number;
}

const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const AdminPatients = () => {
    const [patients, setPatients] = useState<PatientWithBalance[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<PatientWithBalance | null>(null);
    const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", address: "" });
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void | Promise<void>;
    }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

    // Wallet Adjustment State
    const [walletAmount, setWalletAmount] = useState("");
    const [walletAction, setWalletAction] = useState<'add' | 'deduct'>('add');
    const [processingWallet, setProcessingWallet] = useState(false);

    // Image Preview State
    const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const { addCredits, deductCredits } = useWallet();

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('users').select('*').eq('role', 'patient');
            if (data) setPatients(data as PatientWithBalance[]);
        } catch (e) {
            console.error("Critical error loading patients", e);
            toast.error("Failed to load patients");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId: string) => {
        setDeleteConfirm({
            isOpen: true,
            title: 'Delete User Permanently',
            description: 'Are you sure you want to permanently delete this user, including their entire account history (appointments, orders, and prescriptions)? This action cannot be undone.',
            onConfirm: async () => {
                const patientObj = patients.find(p => p.id === userId);
                if (patientObj?.email) {
                    await supabase.from('banned_emails').insert({ email: patientObj.email });
                }

                await supabase.from('appointments').delete().eq('patient_id', userId);
                await supabase.from('orders').delete().eq('patient_id', userId);
                await supabase.from('prescriptions').delete().eq('patient_id', userId);
                await supabase.from('transactions').delete().eq('user_id', userId);
                await supabase.from('users').delete().eq('id', userId);

                toast.success("Patient account and history permanently terminated");
                loadPatients();
            }
        });
    };

    const handleEdit = (user: PatientWithBalance) => {
        setEditingUser(user);
        setEditForm({
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            address: user.address || ""
        });
        setWalletAmount("");
        setIsEditOpen(true);
    };

    const saveEdit = async () => {
        if (!editingUser) return;

        const { error } = await supabase.from('users').update({
            name: editForm.name,
            email: editForm.email,
            phone: editForm.phone,
            address: editForm.address
        }).eq('id', editingUser.id);
        
        if (!error) {
            toast.success("Patient details updated");
            setIsEditOpen(false);
            loadPatients();
        } else {
            toast.error("Failed to update patient");
        }
    };

    const handleWalletUpdate = async () => {
        if (!editingUser || !walletAmount) return;
        const amount = parseFloat(walletAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Invalid amount");
            return;
        }

        setProcessingWallet(true);
        try {
            const description = `Admin Adjustment: ${walletAction === 'add' ? 'Credit' : 'Debit'} via Patient Management`;
            let success = false;

            if (walletAction === 'add') {
                success = await addCredits(amount, description, editingUser.id, 'manual_adjustment');
            } else {
                success = await deductCredits(amount, description, editingUser.id, 'manual_adjustment');
            }

            if (success) {
                toast.success("Wallet balance updated successfully");
                setWalletAmount("");
                setEditingUser(prev => prev ? ({
                    ...prev,
                    balance: walletAction === 'add'
                        ? parseFloat((prev.balance || 0).toString()) + amount
                        : Math.max(0, parseFloat((prev.balance || 0).toString()) - amount)
                }) : null);
                await loadPatients();
            } else {
                throw new Error("Failed to update wallet balance");
            }
        } catch (error: any) {
            console.error("Wallet update error:", error);
        } finally {
            setProcessingWallet(false);
        }
    };

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background m-5">
            <AdminSidebar />
            <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Patients Management</h1>
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search patients..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredPatients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No patients found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPatients.map((patient) => (
                                    <TableRow key={patient.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={() => {
                                                        if (patient.image) {
                                                            const formattedPreview = (!patient.image.startsWith('http') && !patient.image.startsWith('data:image'))
                                                                ? `data:image/jpeg;base64,${patient.image}`
                                                                : patient.image;
                                                            setPreviewImage(formattedPreview);
                                                            setImagePreviewOpen(true);
                                                        }
                                                    }}
                                                    className={patient.image ? "cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" : "flex-shrink-0"}
                                                >
                                                    <UserAvatar
                                                        name={patient.name}
                                                        image={patient.image}
                                                        className="h-10 w-10 border-secondary/20"
                                                    />
                                                </div>
                                                <span className="font-medium">{patient.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{patient.email}</TableCell>
                                        <TableCell>{patient.phone || "-"}</TableCell>
                                        <TableCell className="font-mono">
                                            {isUUID(patient.id) ? `$${parseFloat((patient.balance || 0).toString()).toFixed(2)}` : <span className="text-muted-foreground text-xs">N/A</span>}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(patient)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(patient.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Edit Patient Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            {/* Personal Info Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Personal Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} type="email" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Address</Label>
                                        <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Wallet Section */}
                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Wallet className="w-4 h-4" /> Wallet Management
                                </h3>

                                <>
                                    <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
                                        <span className="text-sm font-medium">Current Balance</span>
                                        <span className="text-2xl font-bold font-mono">
                                            ${parseFloat((editingUser?.balance || 0).toString()).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-end gap-3">
                                        <div className="space-y-2 flex-1">
                                            <Label>Adjust Balance</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex border rounded-md overflow-hidden shrink-0">
                                                    <button
                                                        className={cn("px-3 py-2 hover:bg-muted transition-colors", walletAction === 'add' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-background')}
                                                        onClick={() => setWalletAction('add')}
                                                        title="Add Credits"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className={cn("px-3 py-2 hover:bg-muted transition-colors", walletAction === 'deduct' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-background')}
                                                        onClick={() => setWalletAction('deduct')}
                                                        title="Deduct Credits"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={walletAmount}
                                                    onChange={e => setWalletAmount(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={handleWalletUpdate} disabled={processingWallet} variant="secondary">
                                            {processingWallet ? "Processing..." : "Update Wallet"}
                                        </Button>
                                    </div>
                                </>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={saveEdit}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Image Preview Dialog */}
                <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="Profile Preview"
                                className="w-full h-auto object-contain rounded-lg shadow-2xl"
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </main>
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title={deleteConfirm.title}
                description={deleteConfirm.description}
                onConfirm={deleteConfirm.onConfirm}
                onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                confirmText="Permanently Delete User"
            />
        </div>
    );
};

export default AdminPatients;
