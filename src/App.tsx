import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WalletProvider } from "@/contexts/WalletContext";

// Auth Pages
import AdminLogin from "./pages/auth/AdminLogin";
import PatientLogin from "./pages/auth/PatientLogin";
import DoctorLogin from "./pages/auth/DoctorLogin";

// Patient Pages
import PatientDashboard from "./pages/patient/PatientDashboard";
import Medicines from "./pages/patient/Medicines";
import Cart from "./pages/patient/Cart";
import Appointments from "./pages/patient/Appointments";
import Consultation from "./pages/patient/Consultation";
import History from "./pages/patient/History";
import PatientWallet from "./pages/patient/Wallet";

// Doctor Pages
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorAppointments from "./pages/doctor/DoctorAppointments";
import DoctorConsultation from "./pages/doctor/DoctorConsultation";
import DoctorPrescriptions from "./pages/doctor/DoctorPrescriptions";
import DoctorHistory from "./pages/doctor/DoctorHistory";
import DoctorWallet from "./pages/doctor/Wallet";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMedicines from "./pages/admin/AdminMedicines";
import AdminDoctors from "./pages/admin/AdminDoctors";
import AdminPatients from "./pages/admin/AdminPatients";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminOrders from "./pages/admin/AdminOrders";
import WalletManagement from "./pages/admin/WalletManagement";
import AdminChatbot from "./pages/admin/AdminChatbot";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Components
const PatientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login/patient" replace />;
  if (user?.role !== 'patient') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const DoctorRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login/doctor" replace />;
  if (user?.role !== 'doctor') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login/admin" replace />;
  if (user?.role !== 'admin') return <Navigate to="/login/admin" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/login/patient" replace />} />

      {/* Portal Logins */}
      <Route path="/login/patient" element={
        isAuthenticated && user?.role === 'patient' ? <Navigate to="/patient/dashboard" replace /> : <PatientLogin />
      } />
      <Route path="/login/doctor" element={
        isAuthenticated && user?.role === 'doctor' ? <Navigate to="/doctor/dashboard" replace /> : <DoctorLogin />
      } />

      <Route path="/login/admin" element={
        isAuthenticated && user?.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
          <AdminLogin />
      } />

      {/* Patient Routes */}
      <Route path="/patient/dashboard" element={<PatientRoute><PatientDashboard /></PatientRoute>} />
      <Route path="/patient/medicines" element={<PatientRoute><Medicines /></PatientRoute>} />
      <Route path="/patient/cart" element={<PatientRoute><Cart /></PatientRoute>} />
      <Route path="/patient/appointments" element={<PatientRoute><Appointments /></PatientRoute>} />
      <Route path="/patient/consultation" element={<PatientRoute><Consultation /></PatientRoute>} />
      <Route path="/patient/wallet" element={<PatientRoute><PatientWallet /></PatientRoute>} />
      <Route path="/patient/history" element={<PatientRoute><History /></PatientRoute>} />

      {/* Doctor Routes */}
      <Route path="/doctor/dashboard" element={<DoctorRoute><DoctorDashboard /></DoctorRoute>} />
      <Route path="/doctor/appointments" element={<DoctorRoute><DoctorAppointments /></DoctorRoute>} />
      <Route path="/doctor/consultation" element={<DoctorRoute><DoctorConsultation /></DoctorRoute>} />
      <Route path="/doctor/prescriptions" element={<DoctorRoute><DoctorPrescriptions /></DoctorRoute>} />
      <Route path="/doctor/history" element={<DoctorRoute><DoctorHistory /></DoctorRoute>} />
      <Route path="/doctor/wallet" element={<DoctorRoute><DoctorWallet /></DoctorRoute>} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/medicines" element={<AdminRoute><AdminMedicines /></AdminRoute>} />
      <Route path="/admin/doctors" element={<AdminRoute><AdminDoctors /></AdminRoute>} />
      <Route path="/admin/patients" element={<AdminRoute><AdminPatients /></AdminRoute>} />
      <Route path="/admin/appointments" element={<AdminRoute><AdminAppointments /></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
      <Route path="/admin/wallets" element={<AdminRoute><WalletManagement /></AdminRoute>} />
      <Route path="/admin/chatbot" element={<AdminRoute><AdminChatbot /></AdminRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <CartProvider>
              <AppRoutes />
            </CartProvider>
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
