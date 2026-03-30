import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PatientNavbar from '@/components/layout/PatientNavbar';
import MedicineChatbot from '@/components/chatbot/MedicineChatbot';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Doctor, Appointment } from '@/lib/data';
import { supabase } from '@/lib/supabase';

import {
  Calendar,
  Clock,
  Star,
  Video,
  User,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const Appointments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, deductCredits } = useWallet();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);

  const fetchData = async () => {
    if (!user) return;
    const { data: docsData } = await supabase.from('doctors').select('*');
    if (docsData) setDoctors(docsData as Doctor[]);

    const { data: aptsData } = await supabase.from('appointments')
      .select('*')
      .eq('patientId', user.id)
      .in('status', ['pending', 'confirmed']);

    if (aptsData) {
      setMyAppointments((aptsData as Appointment[]).sort((a, b) => (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0)));
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: undefined as Date | undefined,
    time: '',
    type: 'video' as 'video' | 'in-person'
  });
  const [payWithWallet, setPayWithWallet] = useState(true);

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !bookingData.date || !bookingData.time) {
      toast.error('Please fill in all fields');
      return;
    }

    if (payWithWallet && balance < selectedDoctor.fee) {
      toast.error('Insufficient wallet balance');
      return;
    }

    setIsBooking(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Handle Wallet Payment
    let transactionId = undefined;
    if (payWithWallet) {
      let success = false;

      // Only deduct from patient instead of transferring to doctor immediately
      success = await deductCredits(
        selectedDoctor.fee,
        `Payment reserved for consultation with ${selectedDoctor.name}`,
        user?.id,
        'purchase'
      );

      if (!success) {
        setIsBooking(false);
        return;
      }
      transactionId = `TXN${Date.now()}`;
    }

    const newAppointment: Appointment = {
      id: `APT${Date.now()}`,
      patientId: user?.id || '',
      patientName: user?.name || '',
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      date: format(bookingData.date, 'yyyy-MM-dd'),
      time: bookingData.time,
      status: 'pending',
      type: bookingData.type,
      paymentMethod: payWithWallet ? 'wallet' : 'cod',
      transactionId,
      fee: selectedDoctor.fee
    };

    const { error } = await supabase.from('appointments').insert(newAppointment);

    if (error) {
      toast.error('Failed to book appointment. System error.');
      setIsBooking(false);
      return;
    }

    fetchData();
    setSelectedDoctor(null);
    setBookingData({ date: undefined, time: '', type: 'video' });
    setPayWithWallet(false);
    setIsBooking(false);
    toast.success('Appointment booked successfully!');
  };

  const timeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'];

  return (
    <div className="min-h-screen bg-background">
      <PatientNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Book Appointments</h1>
          <p className="text-muted-foreground">
            Schedule a consultation with our experienced doctors
          </p>
        </div>

        {/* My Appointments */}
        {myAppointments.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-foreground mb-4">Your Appointments</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAppointments.map((apt) => {
                const doc = doctors.find(d => d.id === apt.doctorId);
                return (
                  <Card key={apt.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border">
                          {doc?.image && doc.image !== '/placeholder.svg' ? (
                            <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{apt.doctorName}</h3>
                          <Badge variant={
                            apt.status === 'confirmed' ? 'default' :
                              apt.status === 'completed' ? 'secondary' :
                                apt.status === 'cancelled' ? 'destructive' : 'outline'
                          }>
                            {apt.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> {apt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {apt.time}
                        </span>
                      </div>
                      {apt.status === 'confirmed' && apt.type === 'video' && (
                        <Button className="w-full mt-4" variant="secondary" onClick={() => navigate('/patient/consultation', { state: { appointmentId: apt.id } })}>
                          <Video className="w-4 h-4 mr-2" />
                          Join Consultation
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Available Doctors */}
        <h2 className="text-xl font-bold text-foreground mb-4">Available Doctors</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="border-2 card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border">
                    {doctor.image && doctor.image !== '/placeholder.svg' ? (
                      <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-secondary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {doctor.name}
                      {doctor.isActive === false && (
                        <Badge variant="destructive" className="ml-2 text-[10px] uppercase">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{doctor.specialization}</CardDescription>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 text-warning fill-warning" />
                      <span className="text-sm font-medium">{doctor.rating}</span>
                      <span className="text-sm text-muted-foreground">• {doctor.experience} yrs exp</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {(doctor.availability || []).map((day) => (
                    <Badge key={day} variant="outline" className="text-xs">{day}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Consultation Fee</span>
                  <span className="text-xl font-bold text-primary">${doctor.fee}</span>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => setSelectedDoctor(doctor)}
                  disabled={doctor.isActive === false}
                  variant={doctor.isActive === false ? "secondary" : "default"}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {doctor.isActive === false ? "Currently Unavailable" : "Book Appointment"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Booking Dialog */}
        <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
              <DialogDescription>
                Schedule a consultation with {selectedDoctor?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center overflow-hidden border">
                  {selectedDoctor?.image && selectedDoctor.image !== '/placeholder.svg' ? (
                    <img src={selectedDoctor.image} alt={selectedDoctor.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-secondary" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">{selectedDoctor?.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedDoctor?.specialization}</p>
                </div>
                <Badge className="ml-auto">${selectedDoctor?.fee}</Badge>
              </div>

              <div className="space-y-2">
                <Label>Select Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !bookingData.date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {bookingData.date ? format(bookingData.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={bookingData.date}
                      onSelect={(d) => setBookingData({ ...bookingData, date: d })}
                      disabled={(date) => {
                        // Disable past dates
                        if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;

                        // Disable days doctor is not available
                        if (!selectedDoctor) return false;

                        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        const dayName = daysOfWeek[date.getDay()];

                        return !(selectedDoctor.availability || []).includes(dayName);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Select Time</Label>
                <Select value={bookingData.time} onValueChange={(value) => setBookingData({ ...bookingData, time: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a time slot" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Consultation Type</Label>
                <Select value={bookingData.type} onValueChange={(value: 'video' | 'in-person') => { setBookingData({ ...bookingData, type: value }); if (value === 'in-person') setPayWithWallet(false); else setPayWithWallet(true); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="video">Video Consultation</SelectItem>
                    <SelectItem value="in-person">In-Person</SelectItem>
                  </SelectContent>
                </Select>

              </div>

              {bookingData.type === 'video' && (
                <div className="flex items-center gap-2 pt-2 border-t mt-4">
                  <input
                    type="checkbox"
                    id="payWithWalletApt"
                    checked={true}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary opacity-50 cursor-not-allowed"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="payWithWalletApt"
                      className="text-sm font-medium leading-none text-muted-foreground"
                    >
                      Pay with Wallet (Mandatory for Video)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Balance: ${balance.toFixed(2)}
                      {balance < (selectedDoctor?.fee || 0) && <span className="text-destructive ml-1 font-semibold">(Insufficient Balance)</span>}
                    </p>
                  </div>
                </div>
              )}
              {bookingData.type === 'in-person' && (
                <div className="pt-2 border-t mt-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    💵 Payment will be collected in cash at the clinic
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDoctor(null)}>Cancel</Button>
              <Button onClick={handleBookAppointment} disabled={isBooking}>
                {isBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <MedicineChatbot />
    </div>
  );
};

export default Appointments;
