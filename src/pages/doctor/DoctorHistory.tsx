import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/ui/UserAvatar';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Prescription, Appointment, hideItemForUser, getHiddenItems, clearHiddenItems, STORAGE_KEYS, User } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { FileText, Calendar, Clock, User as UserIcon, Trash2, Eraser } from 'lucide-react';
import { toast } from 'sonner';

const DoctorHistory = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<User[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  const loadData = async () => {
    if (!user) return;

    // Load patients
    const { data: usersData } = await supabase.from('users').select('*').eq('role', 'patient');
    if (usersData) setPatients(usersData as User[]);

    // Load prescriptions
    const { data: rxData } = await supabase.from('prescriptions')
      .select('*')
      .or(`doctor_id.eq.${user.id},doctor_name.eq.${user.name}`)
      .not('doctor_visible', 'eq', false);
    
    if (rxData) {
       setPrescriptions((rxData as Prescription[])
        .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0)));
    }

    // Load appointments
    const hiddenAptIds = await getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user.id);
    const { data: aptsData } = await supabase.from('appointments')
       .select('*')
       .eq('doctor_id', user.id)
       .in('status', ['completed', 'cancelled']);
    
    if (aptsData) {
       const filteredApts = (aptsData as Appointment[])
         .filter(a => !hiddenAptIds.includes(a.id))
         .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0));
       setAppointments(filteredApts);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDeleteAppointment = (aptId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Appointment',
      description: 'Are you sure you want to remove this appointment from your history?',
      onConfirm: async () => {
        await hideItemForUser(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', aptId);
        toast.success('Appointment removed from history');
        loadData();
      }
    });
  };

  const handleClearAllAppointments = () => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Clear Appointment History',
      description: `Clear all ${appointments.length} appointments from your history? This cannot be undone.`,
      onConfirm: async () => {
        const ids = appointments.map(a => a.id);
        await clearHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', ids);
        toast.success('Appointment history cleared');
        loadData();
      }
    });
  };

  const handleDeletePrescription = (rxId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Prescription',
      description: 'Are you sure you want to remove this prescription from your history?',
      onConfirm: async () => {
        await supabase.from('prescriptions').update({ doctor_visible: false }).eq('id', rxId);
        toast.success('Prescription removed from history');
        loadData();
      }
    });
  };

  const handleClearAllPrescriptions = () => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Clear Prescription History',
      description: `Clear all ${prescriptions.length} prescriptions from your history? This cannot be undone.`,
      onConfirm: async () => {
        const idsToClear = prescriptions.map(r => r.id);
        if (idsToClear.length > 0) {
           const { error } = await supabase.from('prescriptions').update({ doctor_visible: false }).in('id', idsToClear);
           if (!error) {
             toast.success('Prescription history cleared');
             loadData();
           } else {
             toast.error('Failed to clear prescriptions');
           }
        }
      }
    });
  };

  const statusColors: Record<string, string> = {
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
    completed: 'bg-muted text-muted-foreground border-border'
  };

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">History</h1>
          <p className="text-muted-foreground">
            View your past appointments and issued prescriptions
          </p>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 max-w-[400px]">
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Appointments</span>
              <Badge variant="secondary" className="ml-1">{appointments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Prescriptions</span>
              <Badge variant="secondary" className="ml-1">{prescriptions.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            {appointments.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearAllAppointments}>
                    <Eraser className="w-4 h-4 mr-1" /> Clear All Appointments
                  </Button>
                </div>
                {appointments.map((apt) => (
                  <Card key={apt.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <UserIcon className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{apt.patient_name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {apt.type === 'video' ? '📹 Video' : '🏥 In-Person'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" /> {apt.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {apt.time}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[apt.status] || ''}>
                            {apt.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAppointment(apt.id)}
                            className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No appointments yet</h3>
                <p className="text-muted-foreground">Your appointment history will appear here</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="prescriptions">
            {prescriptions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearAllPrescriptions}>
                    <Eraser className="w-4 h-4 mr-1" /> Clear All Prescriptions
                  </Button>
                </div>
                {prescriptions.map((rx) => {
                  const patient = patients.find(p => p.id === rx.patient_id);
                  return (
                    <Card key={rx.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <UserAvatar name={rx.patient_name} image={patient?.image} className="w-12 h-12 shrink-0 border" />
                            <div>
                              <CardTitle className="text-lg">{rx.diagnosis}</CardTitle>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">
                                  {rx.patient_name}
                                </span>
                                {patient?.email && (
                                  <span className="text-xs">
                                    {patient.email}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" /> {rx.date}
                                </span>
                                {rx.consultation_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" /> {rx.consultation_time}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Rx #{rx.id.replace('RX', '').slice(-6)}</Badge>
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
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {rx.medicines.map((med, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium text-foreground">{med.name}</p>
                                <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                                  <span>{med.dosage}</span>
                                  <span>{med.duration}</span>
                                </div>
                              </div>
                              <span className="text-sm text-muted-foreground">{med.instructions}</span>
                            </div>
                          ))}
                        </div>
                        {rx.notes && (
                          <>
                            <Separator className="my-4" />
                            <p className="text-sm">
                              <span className="font-medium text-foreground">Notes:</span>{' '}
                              <span className="text-muted-foreground">{rx.notes}</span>
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No prescriptions yet</h3>
                <p className="text-muted-foreground">Prescriptions you issue will appear here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
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

export default DoctorHistory;
