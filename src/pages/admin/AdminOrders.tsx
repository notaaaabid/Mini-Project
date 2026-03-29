import { useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getData, setData, STORAGE_KEYS, Order, Medicine, hideItemForUser, getHiddenItems } from "@/lib/data";

import { Package, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useWallet } from "@/contexts/WalletContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { User as UserType } from "@/lib/data";

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>(() => {
    const all = getData<Order[]>(STORAGE_KEYS.ORDERS, []);
    const hidden = getHiddenItems(STORAGE_KEYS.HIDDEN_ORDERS, 'admin');
    return all.filter(o => !hidden.includes(o.id))
      .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0));
  });

  const [users, setUsers] = useState<UserType[]>(getData<UserType[]>(STORAGE_KEYS.USERS, []));
  const [statusConfirm, setStatusConfirm] = useState<{ id: string, status: Order["status"] } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });
  const [refundConfirm, setRefundConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { }, onCancel: () => { } });

  const { addCredits } = useWallet();

  const triggerLiveUpdate = () => {
    const channel = new BroadcastChannel('medicare_data_updates');
    channel.postMessage({ type: 'update' });
    channel.close();
  };

  const refundToPatient = async (order: Order) => {
    const patientId = order.patientId;
    const amount = order.total;

    // 1. Try WalletContext (handles both Supabase RPC + localStorage)
    const success = await addCredits(amount, `Refund for Order #${order.id.slice(-6)}`, patientId, 'refund');

    // 2. Double-check localStorage was updated (guaranteed fallback)
    const users = getData<any[]>(STORAGE_KEYS.USERS, []);
    const patient = users.find(u => u.id === patientId);
    if (patient) {
      const currentBalance = patient.balance || 0;
      // Only update if addCredits didn't already do it
      if (!success) {
        const updatedUsers = users.map(u =>
          u.id === patientId ? { ...u, balance: currentBalance + amount } : u
        );
        setData(STORAGE_KEYS.USERS, updatedUsers);
      }
      const newBalance = (patient.balance || 0) + (success ? 0 : amount);
      toast.success(`Refunded $${amount.toFixed(2)} → ${patient.name}'s wallet (Balance: $${success ? (currentBalance + amount).toFixed(2) : newBalance.toFixed(2)})`);
      return true;
    }

    if (success) {
      toast.success(`Refunded $${amount.toFixed(2)} to patient wallet.`);
      return true;
    }

    toast.error("Refund failed — patient not found.");
    return false;
  };

  const handleManualRefund = async (order: Order) => {
    setRefundConfirm({
      isOpen: true,
      title: "Manual Refund",
      description: "Are you sure you want to issue a refund for this cancelled order?",
      onConfirm: async () => {
        toast.info("Processing manual refund...");
        const refunded = await refundToPatient(order);
        if (refunded) {
          const updated = orders.map(o => o.id === order.id ? { ...o, isRefunded: true } : o);
          setOrders(updated);
          setData(STORAGE_KEYS.ORDERS, updated);
          triggerLiveUpdate();
          toast.success("Refund status updated for order.");
        }
      },
      onCancel: () => { }
    });
  };

  const updateStatus = async (id: string, status: Order["status"]) => {
    const orderToUpdate = orders.find(o => o.id === id);

    let isRefundedNow = orderToUpdate?.isRefunded || false;
    if (status === 'Cancelled' && orderToUpdate?.status !== 'Cancelled') {
      const medicines = getData<Medicine[]>(STORAGE_KEYS.MEDICINES, []);
      let stockUpdated = false;
      orderToUpdate.items.forEach(item => {
        const medIndex = medicines.findIndex(m => m.id === item.medicineId);
        if (medIndex !== -1) {
          medicines[medIndex].stock += item.quantity;
          stockUpdated = true;
        }
      });
      if (stockUpdated) {
        setData(STORAGE_KEYS.MEDICINES, medicines);
      }

      if (orderToUpdate?.paymentMethod === 'wallet' && !orderToUpdate.isRefunded) {
        let isCancelled = false;
        setRefundConfirm({
          isOpen: true,
          title: "Process Refund",
          description: "This order was paid via Wallet. Do you want to process a refund to the patient now?",
          onConfirm: async () => {
            isCancelled = true;
            toast.info("Processing refund...");
            const refunded = await refundToPatient(orderToUpdate);
            if (!refunded) {
              toast.error("Refund failed. Status update cancelled.");
              if (stockUpdated) {
                orderToUpdate.items.forEach(item => {
                  const revertIdx = medicines.findIndex(m => m.id === item.medicineId);
                  if (revertIdx !== -1) medicines[revertIdx].stock -= item.quantity;
                });
                setData(STORAGE_KEYS.MEDICINES, medicines);
              }
              return;
            }
            isRefundedNow = true;
            finalizeStatusUpdate(id, status, isRefundedNow);
          },
          onCancel: () => {
            isCancelled = true;
            finalizeStatusUpdate(id, status, isRefundedNow);
          }
        });

        // Add a safety fallback if the dialog gets closed without explicitly calling onCancel or onConfirm
        setTimeout(() => {
          if (!isCancelled) {
            finalizeStatusUpdate(id, status, isRefundedNow);
          }
        }, 10000); // Wait up to 10s or just wait infinitely until a button is clicked

        return;
      }
    }

    finalizeStatusUpdate(id, status, isRefundedNow);
  };

  const finalizeStatusUpdate = (id: string, status: Order["status"], isRefundedNow: boolean) => {
    const updated = orders.map((o) => (o.id === id ? { ...o, status, isRefunded: isRefundedNow } : o));
    setOrders(updated);
    setData(STORAGE_KEYS.ORDERS, updated);
    triggerLiveUpdate();
    toast.success("Order status updated!");
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Archive Order',
      description: 'Remove this order from your view? (Archiving it will keep it in your Revenue history)',
      onConfirm: () => {
        hideItemForUser(STORAGE_KEYS.HIDDEN_ORDERS, 'admin', id);
        setOrders(prev => prev.filter((o) => o.id !== id));
        triggerLiveUpdate();
        toast.success("Order archived from view");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background m-5">
      <AdminSidebar />
      <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
        <h1 className="text-4xl font-bold text-foreground mb-8">Orders</h1>
        <div className="space-y-4">
          {orders.map((o) => {
            const patientUser = users.find(u => u.id === o.patientId || u.name === o.patientName);
            const patientImage = patientUser?.image;

            return (
              <Card key={o.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between m-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={o.patientName} image={patientImage} className="w-12 h-12" />
                      <div>
                        <h3 className="font-semibold">Order #{o.id.slice(-6)}</h3>
                        <p className="text-sm text-muted-foreground">
                          {o.patientName} • {o.orderDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={o.status}
                        onValueChange={(v) => {
                          const newStatus = v as Order["status"];
                          setStatusConfirm({ id: o.id, status: newStatus });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Processing">Processing</SelectItem>
                          <SelectItem value="Shipped">Shipped</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      {o.status === 'Cancelled' && o.paymentMethod === 'wallet' && !o.isRefunded && (
                        <Button variant="outline" size="sm" onClick={() => handleManualRefund(o)} className="text-green-600 border-green-200 hover:bg-green-50 mr-2">
                          Issue Refund
                        </Button>
                      )}
                      {o.status === 'Cancelled' && o.paymentMethod === 'wallet' && o.isRefunded && (
                        <Badge variant="outline" className="text-green-600 bg-green-50 mr-2 h-9 flex items-center px-3">
                          Refunded
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(o.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {o.items
                      .map((i) => `${i.medicineName} x${i.quantity}`)
                      .join(", ")}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {o.deliveryAddress}
                    </span>
                    <span className="font-bold text-primary">
                      ${o.total.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {orders.length === 0 && (
            <p className="text-center py-16 text-muted-foreground">
              No orders yet
            </p>
          )}
        </div>
      </main>

      {/* Status Confirmation Dialog */}
      <AlertDialog open={!!statusConfirm} onOpenChange={(open) => !open && setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirm?.status === "Cancelled"
                ? "Are you sure you want to cancel this order?"
                : `Are you sure you want to mark this order as ${statusConfirm?.status}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatusConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusConfirm) {
                  updateStatus(statusConfirm.id, statusConfirm.status);
                  setStatusConfirm(null);
                }
              }}
              className={statusConfirm?.status === "Cancelled" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        confirmText="Confirm Archive"
      />

      <ConfirmDialog
        isOpen={refundConfirm.isOpen}
        title={refundConfirm.title}
        description={refundConfirm.description}
        onConfirm={refundConfirm.onConfirm}
        onClose={() => {
          setRefundConfirm(prev => ({ ...prev, isOpen: false }));
          if (refundConfirm.onCancel) refundConfirm.onCancel();
        }}
        confirmText="Process Refund"
        cancelText="No Refund"
        isDestructive={false}
      />
    </div>
  );
};

export default AdminOrders;
