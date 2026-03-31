import { useState, useEffect } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Appointment, User as UserType, Doctor } from "@/lib/data";
import { supabase } from "@/lib/supabase";

import { Calendar, User, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const AdminAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => { } });

  useEffect(() => {
    const fetchData = async () => {
        const { data: appts } = await supabase.from('appointments').select('*');
        if (appts) setAppointments(appts as Appointment[]);

        const { data: usersData } = await supabase.from('users').select('*');
        if (usersData) setUsers(usersData as UserType[]);

        const { data: docsData } = await supabase.from('doctors').select('*');
        if (docsData) setDoctors(docsData as Doctor[]);
    };
    fetchData();
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Appointment',
      description: 'Are you sure you want to delete this appointment?',
      onConfirm: async () => {
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (!error) {
           setAppointments(prev => prev.filter(a => a.id !== id));
           toast.success("Appointment deleted successfully");
        } else {
           toast.error("Failed to delete appointment");
        }
      }
    });
  };

  const sortedAppointments = [...appointments].sort((a, b) => {
    const timeA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const timeB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="min-h-screen bg-background m-5">
      <AdminSidebar />
      <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Appointments
          </h1>
          <Button
            variant="outline"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2"
          >
            Sort by Initiated Time: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </div>
        <div className="space-y-4">
          {sortedAppointments.map((a) => {
            const patientUser = users.find(u => u.name === a.patient_name && u.role === 'patient');
            const doctorObj = doctors.find(d => d.name === a.doctor_name);
            const patientImage = patientUser?.image;
            const doctorImage = doctorObj?.image;

            return (
              <Card key={a.id} className="border-2 group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-3">
                      <UserAvatar
                        name={a.doctor_name}
                        image={doctorImage}
                        className="w-12 h-12 border-2 border-background z-10 shrink-0"
                      />
                      <UserAvatar
                        name={a.patient_name}
                        image={patientImage}
                        className="w-12 h-12 border-2 border-background shrink-0"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {a.doctor_name} <span className="text-muted-foreground mx-1">with</span> {a.patient_name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {a.type === 'video' ? '📹 Video' : '🏥 In-Person'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> {a.date}{" "}
                        <Clock className="w-4 h-4" /> {a.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{a.status}</Badge>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDelete(a.id, e)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {appointments.length === 0 && (
            <p className="text-center py-16 text-muted-foreground">
              No appointments yet
            </p>
          )}
        </div>
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

export default AdminAppointments;
