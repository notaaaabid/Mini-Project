import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { STORAGE_KEYS, Doctor } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  LogOut,
  Home,
  Calendar,
  Video,
  FileText,
  Menu,
  X,
  Stethoscope,
  Wallet
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const DoctorNavbar = () => {
  const { user, logout } = useAuth();
  const { balance } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (user?.id) {
        const { data } = await supabase.from('doctors').select('*').eq('id', user.id).single();
        if (data) setCurrentDoctor(data as Doctor);
      }
    };
    fetchDoctor();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { path: '/doctor/dashboard', label: 'Dashboard', icon: Home },
    { path: '/doctor/appointments', label: 'Appointments', icon: Calendar },
    { path: '/doctor/consultation', label: 'Video Consult', icon: Video },
    { path: '/doctor/prescriptions', label: 'Prescriptions', icon: FileText },
    { path: '/doctor/history', label: 'History', icon: FileText },
    { path: '/doctor/wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/doctor/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-secondary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">MediCare</span>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">Doctor</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Wallet Balance Display */}
            <Link to="/doctor/wallet">
              <Button variant="outline" size="sm" className="hidden md:flex gap-2">
                <Wallet className="w-4 h-4" />
                <span>{Math.floor(balance)} Credits</span>
              </Button>
            </Link>



            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border">
                  {currentDoctor?.image && currentDoctor.image !== '/placeholder.svg' ? (
                    <img src={currentDoctor.image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <div className="px-3 py-2">
                  <p className="font-medium text-foreground">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
};

export default DoctorNavbar;
