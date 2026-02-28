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
import { getData, setData, STORAGE_KEYS, Prescription, Appointment, hideItemForUser, getHiddenItems, clearHiddenItems } from '@/lib/data';
import { FileText, Calendar, Clock, User, Trash2, Eraser } from 'lucide-react';
import { toast } from 'sonner';

const DoctorHistory = () => {
  const { user } = useAuth();
  const [, forceUpdate] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  useEffect(() => {
    const handleUpdate = () => forceUpdate(n => n + 1);
    window.addEventListener('localDataUpdate', handleUpdate);
    const channel = new BroadcastChannel('medicare_data_updates');
    channel.onmessage = (event) => {
      if (event.data.type === 'update') handleUpdate();
    };
    return () => {
      window.removeEventListener('localDataUpdate', handleUpdate);
      channel.close();
    };
  }, []);

  const prescriptions = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, [])
    .filter(p => p.doctorId === user?.id && p.doctorVisible !== false)
    .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0));

  const hiddenAptIds = getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '');
  const appointments = getData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, [])
    .filter(a => a.doctorId === user?.id && !hiddenAptIds.includes(a.id) && (a.status === 'completed' || a.status === 'cancelled'))
    .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0));

  const patients = getData<any[]>(STORAGE_KEYS.USERS, []).filter(u => u.role === 'patient');

  const handleDeleteAppointment = (aptId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Appointment',
      description: 'Are you sure you want to remove this appointment from your history?',
      onConfirm: () => {
        hideItemForUser(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', aptId);
        toast.success('Appointment removed from history');
        forceUpdate(n => n + 1);
      }
    });
  };

  const handleClearAllAppointments = () => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Clear Appointment History',
      description: `Clear all ${appointments.length} appointments from your history? This cannot be undone.`,
      onConfirm: () => {
        const ids = appointments.map(a => a.id);
        clearHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user?.id || '', ids);
        toast.success('Appointment history cleared');
        forceUpdate(n => n + 1);
      }
    });
  };

  const handleDeletePrescription = (rxId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Prescription',
      description: 'Are you sure you want to remove this prescription from your history?',
      onConfirm: () => {
        const all = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, []);
        const updated = all.map(r => r.id === rxId ? { ...r, doctorVisible: false } : r);
        setData(STORAGE_KEYS.PRESCRIPTIONS, updated);
        toast.success('Prescription removed from history');
        forceUpdate(n => n + 1);
      }
    });
  };

  const handleClearAllPrescriptions = () => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Clear Prescription History',
      description: `Clear all ${prescriptions.length} prescriptions from your history? This cannot be undone.`,
      onConfirm: () => {
        const idsToClear = prescriptions.map(r => r.id);
        const all = getData<Prescription[]>(STORAGE_KEYS.PRESCRIPTIONS, []);
        const updated = all.map(r => idsToClear.includes(r.id) ? { ...r, doctorVisible: false } : r);
        setData(STORAGE_KEYS.PRESCRIPTIONS, updated);
        toast.success('Prescription history cleared');
        forceUpdate(n => n + 1);
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
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{apt.patientName}</h3>
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
                  const patient = patients.find(p => p.id === rx.patientId);
                  return (
                    <Card key={rx.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <UserAvatar name={rx.patientName} image={patient?.image} className="w-12 h-12 shrink-0 border" />
                            <div>
                              <CardTitle className="text-lg">{rx.diagnosis}</CardTitle>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">
                                  {rx.patientName}
                                </span>
                                {patient?.email && (
                                  <span className="text-xs">
                                    {patient.email}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" /> {rx.date}
                                </span>
                                {rx.consultationTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" /> {rx.consultationTime}
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
