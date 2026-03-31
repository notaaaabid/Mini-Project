import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VideoCall from '@/components/video-call/VideoCall';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PatientNavbar from '@/components/layout/PatientNavbar';
import MedicineChatbot from '@/components/chatbot/MedicineChatbot';
import { useAuth } from '@/contexts/AuthContext';
import { Appointment } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Phone,
  MessageSquare,
  User,
  Clock,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Consultation = () => {
  const { user } = useAuth();
  const location = useLocation();
  const stateAppointmentId = (location.state as any)?.appointmentId;
  
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(stateAppointmentId || null);
  const [isInCall, setIsInCall] = useState(!!stateAppointmentId);

  const fetchData = async () => {
    if (!user) return;
    const { data: aptsData } = await supabase.from('appointments')
      .select('*')
      .eq('patient_id', user.id)
      .eq('type', 'video')
      .in('status', ['pending', 'confirmed']);
    if (aptsData) {
       setUpcomingAppointments((aptsData as Appointment[]).sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0)));
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const activeAppointment = activeAppointmentId
    ? upcomingAppointments.find((a: Appointment) => a.id === activeAppointmentId)
    : null;

  const startCall = (aptId: string) => {
    setActiveAppointmentId(aptId);
    setIsInCall(true);
  };

  const endCall = () => {
    setIsInCall(false);
    setActiveAppointmentId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <PatientNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Video Consultation</h1>
          <p className="text-muted-foreground">
            Connect with your doctor through secure video calls
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Call Area */}
          <div className="lg:col-span-2">
            {isInCall && activeAppointment ? (
              <div className="h-[600px]">
                <VideoCall
                  appointmentId={activeAppointment.id}
                  role="patient"
                  onEndCall={endCall}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {upcomingAppointments.map((apt) => (
                      <Card key={apt.id} className="border-2 hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{apt.doctor_name}</CardTitle>
                                <Badge variant="outline" className="text-xs mt-1">
                                  📹 Video Call
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>{apt.date}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{apt.time}</span>
                          </div>
                          <Button
                            className="w-full mt-2"
                            onClick={() => startCall(apt.id)}
                            disabled={apt.status === 'pending'}
                          >
                            <Video className="w-4 h-4 mr-2" />
                            {apt.status === 'pending' ? 'Awaiting Confirmation' : 'Join Call'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-2 overflow-hidden">
                    <div className="relative aspect-video bg-foreground/5 flex flex-col items-center justify-center py-20">
                      <Video className="w-20 h-20 text-muted-foreground/50 mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">No Upcoming Calls</h3>
                      <p className="text-muted-foreground text-center max-w-md">
                        You don't have any video consultations scheduled.
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Consultations */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Scheduled Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-foreground">{apt.doctor_name}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {apt.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {apt.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No scheduled appointments</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-secondary" />
                  Consultation Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Find a quiet, well-lit space for your call
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Have your medical records ready to share
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Write down your symptoms and questions beforehand
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <MedicineChatbot />
    </div>
  );
};

export default Consultation;
