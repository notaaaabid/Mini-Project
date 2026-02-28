import { useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getData, setData, STORAGE_KEYS, Medicine } from "@/lib/data";
import { Plus, Pencil, Trash2, Pill } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const AdminMedicines = () => {
  const [medicines, setMedicines] = useState<Medicine[]>(
    getData(STORAGE_KEYS.MEDICINES, []),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  const resetForm = () =>
    setForm({
      name: "",
      price: "",
      stock: "",
    });

  const handleSave = () => {
    // Preserve any existing medical details if we're editing
    const med: Medicine = {
      id: editing?.id || `M${Date.now()}`,
      name: form.name,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
      image: editing?.image || "/placeholder.svg",
      ...(editing?.category && { category: editing.category }),
      ...(editing?.description && { description: editing.description }),
      ...(editing?.instructions && { instructions: editing.instructions }),
    };
    const updated = editing
      ? medicines.map((m) => (m.id === med.id ? med : m))
      : [...medicines, med];
    setMedicines(updated);
    setData(STORAGE_KEYS.MEDICINES, updated);
    setIsOpen(false);
    setEditing(null);
    resetForm();
    toast.success(editing ? "Medicine updated!" : "Medicine added!");
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Medicine',
      description: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      onConfirm: () => {
        const updated = medicines.filter((m) => m.id !== id);
        setMedicines(updated);
        setData(STORAGE_KEYS.MEDICINES, updated);
        toast.success("Medicine deleted!");
      }
    });
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({
      name: m.name,
      price: m.price.toString(),
      stock: m.stock.toString(),
    });
    setIsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background m-5">
      <AdminSidebar />
      <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Medicines</h1>
          <Button
            onClick={() => {
              resetForm();
              setEditing(null);
              setIsOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Medicine
          </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medicines.map((m) => (
            <Card key={m.id} className="border-2">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Pill className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{m.name}</h3>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(m.id, m.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2 mt-4">
                  <span className="text-lg font-bold text-foreground">
                    Price: ${m.price.toFixed(2)}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Stock: {m.stock}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Medicine</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price ($)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={deleteConfirm.title}
          description={deleteConfirm.description}
          onConfirm={deleteConfirm.onConfirm}
          onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          confirmText="Confirm Delete"
        />
      </main>
    </div>
  );
};

export default AdminMedicines;
