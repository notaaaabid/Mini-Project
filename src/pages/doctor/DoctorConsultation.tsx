import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import VideoCall from '@/components/video-call/VideoCall';
import { useAuth } from '@/contexts/AuthContext';
import { Appointment } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, Video, User, Phone, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const DoctorConsultation = () => {
  const { user } = useAuth();
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [postCallAppointmentId, setPostCallAppointmentId] = useState<string | null>(null);
  const [confirmedAppointments, setConfirmedAppointments] = useState<Appointment[]>([]);

  const fetchAppointments = async () => {
    if (!user) return;
    const { data: aptsData } = await supabase.from('appointments')
      .select('*')
      .eq('doctorId', user.id)
      .eq('status', 'confirmed')
      .eq('type', 'video');
      
    if (aptsData) {
      setConfirmedAppointments((aptsData as Appointment[]).sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0)));
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const handleEndCall = () => {
    // Save the ID before nullifying it so we can show "Mark Completed"
    setPostCallAppointmentId(activeAppointmentId);
    setActiveAppointmentId(null);
  };

  const handleMarkCompleted = async (aptId: string) => {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', aptId);
    toast.success('Appointment marked as completed');
    setPostCallAppointmentId(null);
    fetchAppointments();
  };

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Video Consultation</h1>
          <p className="text-muted-foreground">
            Start video calls with your confirmed patients
          </p>
        </div>

        {activeAppointmentId ? (
          /* Active Video Call View */
          <div className="h-[600px]">
            <VideoCall
              appointmentId={activeAppointmentId}
              role="doctor"
              onEndCall={handleEndCall}
            />
          </div>
        ) : postCallAppointmentId ? (
          /* Post-Call View */
          <div className="text-center py-20 border-2 rounded-lg border-dashed">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Video Consultation Ended</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              The video call has concluded. Please mark the consultation as completed to remove it from your active queue.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => handleMarkCompleted(postCallAppointmentId)} className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Mark as Completed
              </Button>
              <Button variant="outline" onClick={() => setPostCallAppointmentId(null)}>
                Go Back to Queue
              </Button>
            </div>
          </div>
        ) : (
          /* Appointment List View */
          <div>
            {confirmedAppointments.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {confirmedAppointments.map((apt) => (
                  <Card key={apt.id} className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{apt.patientName}</CardTitle>
                            <Badge variant="outline" className="text-xs mt-1">
                              {apt.type === 'video' ? '📹 Video' : '🏥 In-Person'}
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
                      {apt.notes && (
                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                          {apt.notes}
                        </p>
                      )}
                      <Button
                        className="w-full mt-2"
                        onClick={() => setActiveAppointmentId(apt.id)}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Video Call with {apt.patientName} at {apt.time}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border-2 rounded-lg border-dashed">
                <Video className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Confirmed Appointments</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You don't have any confirmed appointments ready for consultation.
                  Confirm appointments from the Appointments page first.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorConsultation;
