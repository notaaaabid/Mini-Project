import { useState, useEffect } from 'react';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { getData, setData, STORAGE_KEYS, Prescription, User, Appointment, hideItemForUser, getHiddenItems } from '@/lib/data';

import { FileText, Plus, Trash2, CheckCircle, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

const DoctorPrescriptions = () => {
  const { user } = useAuth();
  const mockPatients = getData<User[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === 'patient');
  const docAppointments = getData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []).filter(a => a.doctorId === user?.id);
  const allPatientsMap = new Map();
  mockPatients.forEach(p => allPatientsMap.set(p.id, { id: p.id, name: p.name, email: p.email, image: p.image }));
  docAppointments.forEach(a => {
    if (!allPatientsMap.has(a.patientId)) {
      allPatientsMap.set(a.patientId, { id: a.patientId, name: a.patientName, email: 'No email provided', image: undefined });
    }
  });
  const patients = Array.from(allPatientsMap.values());
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (user) {
      const allRx = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, []);
      setPrescriptions(allRx.filter(p => (p.doctorId === user.id || p.doctorName === user.name) && p.doctorVisible !== false));
    }
  }, [user]);

  const [form, setForm] = useState({
    patientId: '', diagnosis: '', notes: '',
    medicines: [{ name: '', dosage: '', duration: '', instructions: '' }],
    attachment: null as { name: string, data: string, type: string } | null
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  const addMedicine = () => setForm({ ...form, medicines: [...form.medicines, { name: '', dosage: '', duration: '', instructions: '' }] });
  const removeMedicine = (i: number) => setForm({ ...form, medicines: form.medicines.filter((_, idx) => idx !== i) });
  const updateMedicine = (i: number, field: string, value: string) => {
    const meds = [...form.medicines];
    meds[i] = { ...meds[i], [field]: value };
    setForm({ ...form, medicines: meds });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File limit is 2MB to ensure safe storage.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, attachment: { name: file.name, type: file.type.includes('pdf') ? 'pdf' : 'image', data: reader.result as string } }));
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const initiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === form.patientId);
    if (!patient || !form.diagnosis) { toast.error('Fill all mandatory fields'); return; }
    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    const patient = patients.find(p => p.id === form.patientId);
    if (!patient) return;

    const newRx: Prescription = {
      id: `RX${Date.now()}`, patientId: form.patientId, patientName: patient.name,
      doctorId: user?.id || '', doctorName: user?.name || '',
      date: new Date().toISOString().split('T')[0],
      consultationTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      diagnosis: form.diagnosis,
      medicines: form.medicines.filter(m => m.name), notes: form.notes,
      attachment: form.attachment || undefined,
      doctorVisible: true,
      patientVisible: true,
    };

    const all = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, []);
    all.push(newRx);
    setData(STORAGE_KEYS.PRESCRIPTIONS, all);
    setPrescriptions([newRx, ...prescriptions]);
    setForm({ patientId: '', diagnosis: '', notes: '', medicines: [{ name: '', dosage: '', duration: '', instructions: '' }], attachment: null });
    setShowConfirm(false);

    // Force global broadcast so the patient's portal refetches
    window.dispatchEvent(new Event('localDataUpdate'));
    try {
      const channel = new BroadcastChannel('medicare_data_updates');
      channel.postMessage({ type: 'update' });
      channel.close();
    } catch (e) { console.error('Broadcast failed', e); }

    toast.success('Prescription safely verified and recorded!');
  };

  const handleDeletePrescription = (rxId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Prescription',
      description: 'Are you sure you want to remove this prescription from your list?',
      onConfirm: () => {
        // Role-based visibility toggle
        const all = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, []);
        const updated = all.map(r => r.id === rxId ? { ...r, doctorVisible: false } : r);
        setData(STORAGE_KEYS.PRESCRIPTIONS, updated);

        // Reflect local UI change immediately
        setPrescriptions(prev => prev.filter(r => r.id !== rxId));
        toast.success('Prescription removed from your list');
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Prescriptions</h1>
        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="border-2">
            <CardHeader><CardTitle>Create Prescription</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div>
                  <Label>Patient</Label>
                  <Select value={form.patientId} onValueChange={v => setForm({ ...form, patientId: v })}>
                    <SelectTrigger className="h-auto py-2">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-2">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={p.name} image={p.image} className="w-8 h-8 flex-shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-sm leading-none">{p.name}</span>
                              <span className="text-xs text-muted-foreground mt-1">{p.email}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Diagnosis</Label><Input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></div>
                <div>
                  <Label>Medicines</Label>
                  {form.medicines.map((med, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 mt-2">
                      <Input placeholder="Name" value={med.name} onChange={e => updateMedicine(i, 'name', e.target.value)} />
                      <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMedicine(i, 'dosage', e.target.value)} />
                      <Input placeholder="Duration" value={med.duration} onChange={e => updateMedicine(i, 'duration', e.target.value)} />
                      <Input placeholder="Instructions" value={med.instructions} onChange={e => updateMedicine(i, 'instructions', e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeMedicine(i)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addMedicine}><Plus className="w-4 h-4 mr-1" /> Add Medicine</Button>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

                <div>
                  <Label>Optional Attachment (PDF/Image)</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <Input type="file" accept="application/pdf,image/*" onChange={handleFileUpload} className="cursor-pointer file:cursor-pointer" />
                    {form.attachment && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                        <CheckCircle className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{form.attachment.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 text-green-600 hover:text-green-800 hover:bg-transparent" onClick={() => setForm(f => ({ ...f, attachment: null }))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <Button type="button" onClick={initiateSubmit} className="w-full">Review & Create Prescription</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader><CardTitle>Recent Prescriptions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {prescriptions.slice(0, 5).map(rx => {
                const patient = patients.find(p => p.id === rx.patientId);
                return (
                  <div key={rx.id} className="p-4 bg-muted rounded-lg flex items-center justify-between border">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={rx.patientName} image={patient?.image} className="w-10 h-10 shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground">{rx.patientName}</p>
                        {patient?.email && <p className="text-xs text-muted-foreground">{patient.email}</p>}
                        <p className="text-sm text-muted-foreground mt-1">{rx.diagnosis} • {rx.date}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePrescription(rx.id)}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      title="Delete prescription"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
              {prescriptions.length === 0 && <p className="text-center py-8 text-muted-foreground">No prescriptions yet</p>}
            </CardContent>
          </Card>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Confirm Prescription Details
              </DialogTitle>
              <DialogDescription>
                Please review the prescription thoroughly before creating it. This ensures patient safety.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Patient</p>
                  <p className="font-semibold">{patients.find(p => p.id === form.patientId)?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Diagnosis</p>
                  <p className="font-semibold">{form.diagnosis}</p>
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground mb-2">Prescribed Medicines ({form.medicines.filter(m => m.name).length})</p>
                <div className="space-y-2">
                  {form.medicines.filter(m => m.name).map((med, i) => (
                    <div key={i} className="flex flex-col text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="font-semibold text-foreground">{med.name}</span>
                      <span className="text-muted-foreground">{med.dosage} • {med.duration}</span>
                      {med.instructions && <span className="text-xs italic text-muted-foreground/80 mt-0.5">Note: {med.instructions}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {form.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Doctor Notes</p>
                  <p className="text-sm p-2 bg-muted rounded-lg mt-1">{form.notes}</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Go Back & Edit
              </Button>
              <Button onClick={handleConfirmSubmit}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm & Issue
              </Button>
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

export default DoctorPrescriptions;
