import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { Appointment, Doctor, User, getHiddenItems, STORAGE_KEYS } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Calendar, Video, FileText, Users, Clock, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const { balance, refreshWallet } = useWallet();

  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const loadData = async () => {
     if (!user?.name || !user?.id) return;

     const { data: doctorsData } = await supabase.from('doctors').select('*').eq('id', user.id);
     if (doctorsData && doctorsData.length > 0) setCurrentDoctor(doctorsData[0] as Doctor);

     const hiddenAptIds = await getHiddenItems(STORAGE_KEYS.HIDDEN_APPOINTMENTS, user.id);

     const { data: aptsData } = await supabase.from('appointments').select('*').eq('doctorName', user.name);
     if (aptsData) {
        setAppointments((aptsData as Appointment[]).filter(a => !hiddenAptIds.includes(a.id)));
     }

     const { data: usersData } = await supabase.from('users').select('*');
     if (usersData) setUsers(usersData as User[]);
  };

  useEffect(() => {
     loadData();
  }, [user]);

  const todayAppointments = appointments
    .filter(a => a.status === 'confirmed' || a.status === 'pending')
    .sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0));

  const completedToday = appointments.filter(a => a.status === 'completed').length;

  const stats = [
    { label: 'Wallet Balance', value: `$${balance.toFixed(2)}`, icon: Wallet, color: 'bg-green-500' },
    { label: 'Today\'s Appointments', value: todayAppointments.length, icon: Calendar, color: 'bg-primary' },
    { label: 'Completed', value: completedToday, icon: FileText, color: 'bg-secondary' },
    { label: 'Total Patients', value: new Set(appointments.map(a => a.patientId)).size, icon: Users, color: 'bg-accent' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-2">
          {currentDoctor?.image && currentDoctor.image !== '/placeholder.svg' ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary">
              <img src={currentDoctor.image} alt="Profile" className="w-full h-full object-cover" />
            </div>
          ) : null}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome, {user?.name}! 👋</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">Here's your schedule overview</p>
              <button onClick={() => { loadData(); refreshWallet(); }} className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors">
                Refresh Data
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8"></div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <Card key={i} className="border-2">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-14 h-14 ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length > 0 ? (
              <div className="space-y-4">
                {todayAppointments.slice(0, 5).map((apt) => {
                  const patient = users.find(u => u.id === apt.patientId);
                  return (
                    <div key={apt.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border">
                          {patient?.image ? (
                            <img src={patient.image} alt="Patient" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{apt.patientName}</p>
                          <p className="text-sm text-muted-foreground">{apt.date} at {apt.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{apt.status}</Badge>
                        <Link to="/doctor/consultation">
                          <Video className="w-5 h-5 text-primary cursor-pointer" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DoctorDashboard;
