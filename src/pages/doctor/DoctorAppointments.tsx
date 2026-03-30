import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Appointment, hideItemForUser, getHiddenItems, clearHiddenItems, STORAGE_KEYS } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, User as UserIcon, CheckCircle, XCircle, Trash2, Eraser } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const DoctorAppointments = () => {
  const { user } = useAuth();
  const { addCredits, deductCredits } = useWallet();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientMap, setPatientMap] = useState<Record<string, { name: string; email: string; image: string }>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  const fetchAppointments = async () => {
    if (!user) return;
    
    const hiddenIds = await getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user.id);
    const { data: allApts } = await supabase.from('appointments').select('*');
    
    let myApts: Appointment[] = [];
    if (allApts) {
      myApts = (allApts as Appointment[])
        .filter(a => a.doctorName === user.name && !hiddenIds.includes(a.id) && (a.status === 'pending' || a.status === 'confirmed'))
        .sort((a, b) => {
          const timeA = parseInt(a.id.replace(/\D/g, '')) || 0;
          const timeB = parseInt(b.id.replace(/\D/g, '')) || 0;
          return timeB - timeA;
        });
      setAppointments(myApts);
    }

    // Extract unique patient IDs
    const patientIds = Array.from(new Set(myApts.map(a => a.patientId)));
    const pMap: Record<string, { name: string; email: string; image: string }> = {};

    if (patientIds.length > 0) {
      const { data: localUsers } = await supabase.from('users').select('*').in('id', patientIds);
      if (localUsers) {
        localUsers.forEach(u => {
          pMap[u.id] = {
            name: u.name || '',
            email: u.email || '',
            image: u.image || ''
          };
        });
      }
    }

    setPatientMap(pMap);
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const updateStatus = async (id: string, status: Appointment['status']) => {
    const appointmentToUpdate = appointments.find(a => a.id === id);

    if (status === 'confirmed' && appointmentToUpdate?.paymentMethod === 'wallet' && appointmentToUpdate.fee) {
      // Doctor confirms -> Doctor gets paid
      let success = await addCredits(
        appointmentToUpdate.fee,
        `Payment received for consultation with ${appointmentToUpdate.patientName}`,
        user?.id,
        'consultation_credit'
      );
      if (!success) {
        toast.error("Failed to credit your wallet. Please try again.");
        return;
      }
    }

    if (status === 'cancelled' && appointmentToUpdate?.paymentMethod === 'wallet' && appointmentToUpdate.fee) {
      // Refund the patient (Doctor never received it)
      toast.info("Processing refund...");

      let success = await addCredits(
        appointmentToUpdate.fee,
        `Refund for cancelled appointment with ${appointmentToUpdate.doctorName}`,
        appointmentToUpdate.patientId,
        'refund'
      );

      if (success) {
        toast.success("Refund processed successfully");
      } else {
        toast.error("Failed to process refund. System error.");
        return; // Stop cancellation if refund fails
      }
    }

    await supabase.from('appointments').update({ status }).eq('id', id);
    fetchAppointments();
    toast.success(`Appointment ${status}`);
  };

  // HIDE individual appointment (soft-delete — only hides for this user)
  const handleDeleteAppointment = (aptId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Appointment',
      description: 'Are you sure you want to remove this appointment from your list?',
      onConfirm: async () => {
        await hideItemForUser(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', aptId);
        fetchAppointments();
        toast.success('Appointment removed from your list');
      }
    });
  };

  // CLEAR all appointments (soft-delete — only hides for this user)
  const handleClearAllAppointments = () => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Clear Appointments',
      description: `Clear all ${appointments.length} appointments? This cannot be undone.`,
      onConfirm: async () => {
        const ids = appointments.map(a => a.id);
        await clearHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', ids);
        fetchAppointments();
        toast.success('All appointments cleared from your list');
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          {appointments.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearAllAppointments}>
              <Eraser className="w-4 h-4 mr-1" /> Clear All
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {appointments.map((apt) => {
            const patient = patientMap[apt.patientId];

            const aptPatientObj = (apt as any).patient;
            const patientImage =
              aptPatientObj?.profile_image ||
              aptPatientObj?.profileImage ||
              aptPatientObj?.avatar ||
              aptPatientObj?.image ||
              patient?.image ||
              (patient as any)?.profile_image ||
              (patient as any)?.avatar;

            return (
              <Card key={apt.id} className="border-2">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      name={patient?.name || apt.patientName}
                      image={patientImage}
                      className="w-12 h-12 border-2 shadow-sm"
                    />
                    <div>
                      <p className="font-semibold text-foreground text-lg">{patient?.name || apt.patientName}</p>
                      {patient?.email && (
                        <p className="text-sm text-muted-foreground mb-1">{patient.email}</p>
                      )}
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> {apt.date} <Clock className="w-4 h-4" /> {apt.time}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons Restored */}
                  <div className="flex items-center gap-3">
                    <Badge>{apt.status}</Badge>
                    <Badge variant="outline" className="text-xs">{apt.type === 'video' ? '📹 Video' : '🏥 In-Person'}</Badge>
                    {apt.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(apt.id, 'confirmed')}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(apt.id, 'cancelled')}>
                          <XCircle className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(apt.id, 'completed')}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Mark Completed
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAppointment(apt.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {appointments.length === 0 && (
            <p className="text-center py-16 text-muted-foreground">No appointments scheduled</p>
          )}
        </div>
      </main>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        confirmText="Confirm Delete"
      />
    </div>
  );
};

export default DoctorAppointments;
