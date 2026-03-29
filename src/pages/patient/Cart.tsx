import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import PatientNavbar from "@/components/layout/PatientNavbar";
import MedicineChatbot from "@/components/chatbot/MedicineChatbot";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { getData, setData, STORAGE_KEYS, Order, Medicine } from "@/lib/data";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  CreditCard,
  MapPin,
  Package,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, removeFromCart, updateQuantity, clearCart, totalPrice } =
    useCart();
  const { balance, transferCredits } = useWallet();
  const [payWithWallet, setPayWithWallet] = useState(false);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [address, setAddress] = useState(user?.address || "");

  const handleCheckout = async () => {
    if (!address.trim()) {
      toast.error("Please enter a delivery address");
      return;
    }

    if (payWithWallet && balance < totalPrice) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setIsCheckingOut(true);

    // Validate stock before proceeding
    const currentMedicines = getData<Medicine[]>(STORAGE_KEYS.MEDICINES, []);
    for (const item of items) {
      const med = currentMedicines.find(m => m.id === item.medicine.id);
      if (!med || med.stock < item.quantity) {
        toast.error(`Sorry, ${item.medicine.name} is out of stock or requested quantity exceeds available stock.`);
        setIsCheckingOut(false);
        return;
      }
    }

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Handle Wallet Payment
    let transactionId = undefined;
    if (payWithWallet) {
      // Find Admin ID (In real app, fetch from system settings or env)
      const adminId = 'a1';

      const success = await transferCredits(totalPrice, adminId, `Order Payment #${Date.now()}`);
      if (!success) {
        setIsCheckingOut(false);
        return;
      }
      toast.info(`Payment transferred. Admin ID: ${adminId}`);
      transactionId = `TXN${Date.now()}`;
    }

    // Create order
    const newOrder: Order = {
      id: `ORD${Date.now()}`,
      patientId: user?.id || "",
      patientName: user?.name || "",
      items: items.map((item) => ({
        medicineId: item.medicine.id,
        medicineName: item.medicine.name,
        quantity: item.quantity,
        price: item.medicine.price,
      })),
      total: totalPrice,
      status: "Pending",
      orderDate: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      deliveryAddress: address,
      paymentMethod: payWithWallet ? "wallet" : "cod",
      transactionId
    };

    const orders = getData<Order[]>(STORAGE_KEYS.ORDERS, []);
    orders.push(newOrder);
    setData(STORAGE_KEYS.ORDERS, orders);

    // Update Medicine Stock
    const medicines = getData<Medicine[]>(STORAGE_KEYS.MEDICINES, []);
    let stockUpdated = false;
    items.forEach(item => {
      const medIndex = medicines.findIndex(m => m.id === item.medicine.id);
      if (medIndex !== -1) {
        medicines[medIndex].stock = Math.max(0, medicines[medIndex].stock - item.quantity);
        stockUpdated = true;
      }
    });
    if (stockUpdated) {
      setData(STORAGE_KEYS.MEDICINES, medicines);
    }

    clearCart();
    setOrderPlaced(true);
    setIsCheckingOut(false);
    toast.success("Order placed successfully!");
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background">
        <PatientNavbar />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-secondary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Order Confirmed!
            </h1>
            <p className="text-muted-foreground mb-8">
              Your order has been placed successfully. You can track its status
              in your order history.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/patient/history">
                <Button>View Orders</Button>
              </Link>
              <Link to="/patient/medicines">
                <Button variant="outline">Continue Shopping</Button>
              </Link>
            </div>
          </div>
        </main>
        <MedicineChatbot />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PatientNavbar />
        <main className="container mx-auto px-4 py-16 text-center">
          <ShoppingCart className="w-20 h-20 text-muted-foreground/50 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Your Cart is Empty
          </h1>
          <p className="text-muted-foreground mb-8">
            Browse our medicines and add items to your cart
          </p>
          <Link to="/patient/medicines">
            <Button>Browse Medicines</Button>
          </Link>
        </main>
        <MedicineChatbot />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PatientNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/patient/medicines">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Shopping Cart
            </h1>
            <p className="text-muted-foreground">
              {items.length} items in your cart
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.medicine.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Package className="w-8 h-8 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">
                        {item.medicine.name}
                      </h3>
                      <p className="text-lg font-bold text-primary mt-1">
                        ${item.medicine.price.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeFromCart(item.medicine.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.medicine.id, item.quantity - 1)
                          }
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (item.quantity < item.medicine.stock) {
                              updateQuantity(item.medicine.id, item.quantity + 1);
                            } else {
                              toast.error(`Cannot select more than available stock (${item.medicine.stock})`);
                            }
                          }}
                          disabled={item.quantity >= item.medicine.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <p className="font-semibold text-foreground">
                        ${(item.medicine.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="border-2 sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.medicine.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.medicine.name} x{item.quantity}
                      </span>
                      <span className="text-foreground">
                        ${(item.medicine.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="text-secondary">FREE</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">${totalPrice.toFixed(2)}</span>
                </div>

                <div className="space-y-2 pt-4">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Delivery Address
                  </Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your full delivery address"
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="payWithWallet"
                    checked={payWithWallet}
                    onChange={(e) => setPayWithWallet(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={balance < totalPrice}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="payWithWallet"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Pay with Wallet
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Balance: ${balance.toFixed(2)}
                      {balance < totalPrice && <span className="text-destructive ml-1">(Insufficient)</span>}
                    </p>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Place Order
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      <MedicineChatbot />
    </div>
  );
};

export default Cart;
