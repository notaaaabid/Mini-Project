import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { getData, setData, STORAGE_KEYS, Appointment, User, hideItemForUser, getHiddenItems, clearHiddenItems } from '@/lib/data';
import { syncAppointmentToSupabase, deleteAppointmentFromSupabase } from '@/lib/supabaseSync';
import { Calendar, Clock, User as UserIcon, CheckCircle, XCircle, Trash2, Eraser } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      const hiddenIds = getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user.id);
      const allApts = getData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
      const myApts = allApts
        .filter(a => a.doctorName === user.name && !hiddenIds.includes(a.id) && (a.status === 'pending' || a.status === 'confirmed'))
        .sort((a, b) => {
          const timeA = parseInt(a.id.replace(/\D/g, '')) || 0;
          const timeB = parseInt(b.id.replace(/\D/g, '')) || 0;
          return timeB - timeA;
        });

      setAppointments(myApts);

      // Extract unique patient IDs
      const patientIds = Array.from(new Set(myApts.map(a => a.patientId)));
      const pMap: Record<string, { name: string; email: string; image: string }> = {};

      // 1. Pre-fill with local storage data (since uploads map base64 strings there)
      const localUsers = getData<User[]>(STORAGE_KEYS.USERS, []);
      patientIds.forEach(id => {
        const localUser = localUsers.find(u => u.id === id);
        if (localUser) {
          pMap[id] = {
            name: localUser.name || '',
            email: localUser.email || '',
            image: localUser.image || ''
          };
        }
      });

      // 2. Fetch from Supabase and merge
      const validUuids = patientIds.filter(id => id && id.length > 20);
      if (validUuids.length > 0) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', validUuids);

          if (data && !error) {
            data.forEach(p => {
              pMap[p.id] = {
                name: pMap[p.id]?.name || p.full_name || '',
                email: pMap[p.id]?.email || p.email || '',
                image: pMap[p.id]?.image || p.avatar_url || ''
              };
            });
          }
        } catch (err) {
          console.error('[DoctorAppointments] Error fetching patient profiles:', err);
        }
      }
      setPatientMap(pMap);
    };

    fetchAppointments();

    window.addEventListener('localDataUpdate', fetchAppointments);
    const channel = new BroadcastChannel('medicare_data_updates');
    channel.onmessage = (event) => {
      if (event.data.type === 'update') {
        fetchAppointments();
      }
    };

    return () => {
      window.removeEventListener('localDataUpdate', fetchAppointments);
      channel.close();
    };
  }, [user]);

  const updateStatus = async (id: string, status: Appointment['status']) => {
    const allApts = getData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
    const appointmentToUpdate = allApts.find(a => a.id === id);

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

    const updated = allApts.map(a => a.id === id ? { ...a, status } : a);
    setData(STORAGE_KEYS.APPOINTMENTS, updated);
    const updatedAppt = updated.find(a => a.id === id);
    if (updatedAppt) syncAppointmentToSupabase(updatedAppt);
    setAppointments(updated.filter(a => a.doctorName === user?.name && (a.status === 'pending' || a.status === 'confirmed')));
    toast.success(`Appointment ${status}`);
  };

  // HIDE individual appointment (soft-delete — only hides for this user)
  const handleDeleteAppointment = (aptId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Appointment',
      description: 'Are you sure you want to remove this appointment from your list?',
      onConfirm: () => {
        hideItemForUser(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', aptId);
        setAppointments(prev => prev.filter(a => a.id !== aptId));
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
      onConfirm: () => {
        const ids = appointments.map(a => a.id);
        clearHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', ids);
        setAppointments([]);
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

            // 1. Log appointment.patient object (per user request)
            const aptPatientObj = (apt as any).patient;
            console.log("Appointment Object:", apt);
            console.log("Nested appointment.patient object:", aptPatientObj);
            console.log("Local Storage Patient object:", patient);

            // 2. Identify exact image field name safely
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
