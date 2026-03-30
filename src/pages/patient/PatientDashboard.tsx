import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PatientNavbar from '@/components/layout/PatientNavbar';
import MedicineChatbot from '@/components/chatbot/MedicineChatbot';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Appointment, Order, Doctor, User, Prescription, STORAGE_KEYS, getHiddenItems } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import {
  Pill,
  Calendar,
  Video,
  FileText,
  Package,
  Clock,
  ArrowRight,
  Heart,
  Activity,
} from 'lucide-react';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [selectedAttachment, setSelectedAttachment] = useState<{ name: string, data: string, type: string } | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allPrescriptions, setAllPrescriptions] = useState<Prescription[]>([]);

  const loadData = async () => {
     if (!user) return;
     // Fetch doctors
     const { data: docsData } = await supabase.from('doctors').select('*');
     if (docsData) setDoctors(docsData as Doctor[]);

     // Fetch users
     const { data: usersData } = await supabase.from('users').select('*');
     if (usersData) setUsers(usersData as User[]);

     // Fetch appointments
     const hiddenAptIds = await getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user.id);
     const { data: aptsData } = await supabase.from('appointments').select('*').eq('patientId', user.id).not('status', 'eq', 'cancelled');
     if (aptsData) {
       setAppointments((aptsData as Appointment[]).filter(a => !hiddenAptIds.includes(a.id)));
     }

     // Fetch orders
     const hiddenOrderIds = await getHiddenItems(STORAGE_KEYS.HIDDEN_ORDERS, user.id);
     const { data: ordersData } = await supabase.from('orders').select('*').eq('patientId', user.id);
     if (ordersData) {
       setOrders((ordersData as Order[]).filter(o => !hiddenOrderIds.includes(o.id)));
     }

     // Fetch prescriptions
     const { data: rxData } = await supabase.from('prescriptions').select('*')
       .eq('patientId', user.id)
       .not('patientVisible', 'eq', false);
     if (rxData) {
       setAllPrescriptions((rxData as Prescription[]).sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0)));
     }
  };

  useEffect(() => {
     loadData();
  }, [user]);

  const upcomingAppointments = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const activeOrders = orders.filter(o => {
    const status = o.status?.toLowerCase() || '';
    return status !== 'delivered' && status !== 'cancelled';
  });

  const quickActions = [
    { icon: Pill, label: 'Order Medicines', path: '/patient/medicines', color: 'bg-primary' },
    { icon: Calendar, label: 'Book Appointment', path: '/patient/appointments', color: 'bg-secondary' },
    { icon: Video, label: 'Video Consult', path: '/patient/consultation', color: 'bg-accent' },
    { icon: FileText, label: 'View History', path: '/patient/history', color: 'bg-info' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PatientNavbar />

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary bg-muted flex items-center justify-center shrink-0">
            {user?.image ? (
              <img src={user.image} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="text-2xl">👋</div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground">
              Your health journey at a glance. What would you like to do today?
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={index} to={action.path}>
                <Card className="card-hover border-2 h-full">
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground">{action.label}</h3>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Your scheduled consultations</CardDescription>
              </div>
              <Link to="/patient/appointments">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.slice(0, 3).map((apt) => {
                    const doc = doctors.find(d => d.id === apt.doctorId);
                    return (
                      <div key={apt.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border">
                            {doc?.image && doc.image !== '/placeholder.svg' ? (
                              <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" />
                            ) : (
                              <Video className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{apt.doctorName}</p>
                            <p className="text-sm text-muted-foreground">{apt.date} at {apt.time}</p>
                          </div>
                        </div>
                        <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
                          {apt.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No upcoming appointments</p>
                  <Link to="/patient/appointments">
                    <Button variant="outline" className="mt-4">
                      Book an Appointment
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-secondary" />
                  Active Orders
                </CardTitle>
                <CardDescription>Track your medicine deliveries</CardDescription>
              </div>
              <Link to="/patient/history">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {activeOrders.length > 0 ? (
                <div className="space-y-4">
                  {activeOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Order #{order.id.slice(-6)}</p>
                          <p className="text-sm text-muted-foreground">{order.items.length} items • ${order.total.toFixed(2)}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{order.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No active orders</p>
                  <Link to="/patient/medicines">
                    <Button variant="outline" className="mt-4">
                      Browse Medicines
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Prescriptions */}
        <Card className="border-2 mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-info" />
                Recent Prescriptions
              </CardTitle>
              <CardDescription>Your latest medical prescriptions</CardDescription>
            </div>
            <Link to="/patient/history">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {allPrescriptions.length > 0 ? (
              <div className="space-y-4">
                {allPrescriptions.slice(0, 3).map((rx) => {
                  const doc = doctors.find(d => d.id === rx.doctorId || d.name === rx.doctorName);
                  const docUser = users.find(u => u.id === rx.doctorId || u.name === rx.doctorName);
                  const cleanDocName = rx.doctorName.startsWith('Dr.') ? rx.doctorName : `Dr. ${rx.doctorName}`;
                  const docImage = doc?.image || docUser?.image;

                  return (
                    <div key={rx.id} className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                      <div className="flex items-center gap-4">
                        <UserAvatar name={cleanDocName} image={docImage} className="w-12 h-12 shrink-0 border" />
                        <div>
                          <p className="font-semibold text-foreground">{rx.diagnosis}</p>
                          <div className="text-sm text-muted-foreground mt-1 flex flex-col">
                            <span className="font-medium text-foreground">{cleanDocName}</span>
                            {docUser?.email && <span className="text-xs">{docUser.email}</span>}
                            <span className="flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {rx.date}</span>
                          </div>
                        </div>
                      </div>
                      {rx.attachment && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedAttachment(rx.attachment)} className="ml-4 shrink-0">
                          <FileText className="w-4 h-4 mr-2" />
                          Attachment
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No recent prescriptions</p>
                <Link to="/patient/appointments">
                  <Button variant="outline" className="mt-4">
                    Consult a Doctor
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Attachment Viewer Dialog */}
      <Dialog open={!!selectedAttachment} onOpenChange={(open) => !open && setSelectedAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 bg-muted/50 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {selectedAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-black/5 p-4 flex items-center justify-center min-h-[500px]">
            {selectedAttachment?.type === 'pdf' ? (
              <iframe
                src={`${selectedAttachment.data}#toolbar=0`}
                className="w-full h-full min-h-[500px] border-0 rounded bg-white shadow-sm"
                title={selectedAttachment.name}
              />
            ) : selectedAttachment?.type === 'image' ? (
              <img
                src={selectedAttachment.data}
                alt={selectedAttachment.name}
                className="max-w-full max-h-[calc(90vh-100px)] object-contain rounded shadow-sm"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <MedicineChatbot />
    </div >
  );
};

export default PatientDashboard;
