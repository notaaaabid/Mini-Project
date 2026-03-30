import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShoppingCart,
  User as UserIcon,
  LogOut,
  Home,
  Pill,
  Calendar,
  FileText,
  Menu,
  X,
  Stethoscope,
  Wallet,
  Settings,
  Video
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from '@/lib/utils';
import { STORAGE_KEYS, User } from "@/lib/data";
import { supabase } from "@/lib/supabase";


const PatientNavbar = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { balance } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    image: user?.image || ''
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size too large. Please choose an image under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: profileForm.name,
          phone: profileForm.phone,
          address: profileForm.address,
          image: profileForm.image
        })
        .eq('id', user.id);

      if (error) throw error;

      const updatedUserVal: User = {
        ...user,
        name: profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
        image: profileForm.image
      };

      // Update sessionStorage for auth persistence
      sessionStorage.setItem('medicare_session_user', JSON.stringify(updatedUserVal));
      toast.success("Profile updated successfully!");
      setIsProfileOpen(false);
      navigate(0); // Soft re-render instead of full page reload
    } catch (error) {
      console.error("Storage error:", error);
      toast.error("Failed to save profile. Image might be too large.");
    }
  };


  const navLinks = [
    { path: '/patient/dashboard', label: 'Dashboard', icon: Home },
    { path: '/patient/medicines', label: 'Medicines', icon: Pill },
    { path: '/patient/appointments', label: 'Appointments', icon: Calendar },
    { path: '/patient/consultation', label: 'Video Consult', icon: Video },
    { path: '/patient/history', label: 'History', icon: FileText },
    { path: '/patient/wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/patient/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">MediCare</span>
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
                      ? 'bg-primary text-primary-foreground'
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
            <Link to="/patient/wallet">
              <Button variant="outline" size="sm" className="hidden md:flex gap-2">
                <Wallet className="w-4 h-4" />
                <span>{Math.floor(balance)} Credits</span>
              </Button>
            </Link>

            {/* Cart */}
            <Link to="/patient/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden">
                  {user?.image ? (
                    <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <div className="px-3 py-2">
                  <p className="font-medium text-foreground">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  setProfileForm({
                    name: user?.name || '',
                    phone: user?.phone || '',
                    address: user?.address || '',
                    image: user?.image || ''
                  });
                  setIsProfileOpen(true);
                }} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
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
                      ? 'bg-primary text-primary-foreground'
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

        <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary bg-muted flex items-center justify-center">
                  {profileForm.image ? (
                    <img src={profileForm.image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Profile ID / Pass Photo</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="cursor-pointer"
                  />
                  {profileForm.image && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProfileForm(prev => ({ ...prev, image: '' }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Upload a clear photo to verify your identity.</p>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleProfileUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
};

export default PatientNavbar;
