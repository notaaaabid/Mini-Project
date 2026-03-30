import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PatientNavbar from "@/components/layout/PatientNavbar";
import MedicineChatbot from "@/components/chatbot/MedicineChatbot";
import { useCart } from "@/contexts/CartContext";
import { Medicine } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Pill,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Medicines = () => {
  const { addToCart, items } = useCart();
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);

  useEffect(() => {
    const fetchMeds = async () => {
      const { data } = await supabase.from('medicines').select('*');
      if (data) setAllMedicines(data as Medicine[]);
    };
    fetchMeds();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filteredMedicines = allMedicines.filter((medicine) => {
    return medicine.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getQuantity = (medicineId: string) => quantities[medicineId] || 1;

  const updateQuantity = (medicineId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [medicineId]: Math.max(1, (prev[medicineId] || 1) + delta),
    }));
  };

  const handleAddToCart = (medicine: Medicine) => {
    const qty = getQuantity(medicine.id);
    addToCart(medicine, qty);
    toast.success(`Added ${qty} x ${medicine.name} to cart`);
    setQuantities((prev) => ({ ...prev, [medicine.id]: 1 }));
  };

  const isInCart = (medicineId: string) =>
    items.some((item) => item.medicine.id === medicineId);

  return (
    <div className="min-h-screen bg-background">
      <PatientNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Order Medicines
          </h1>
          <p className="text-muted-foreground">
            Browse our selection of medicines and healthcare products
          </p>
        </div>

        {/* Search and Filters */}
        <div className="relative flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Medicines Grid */}
        {filteredMedicines.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMedicines.map((medicine) => (
              <Card
                key={medicine.id}
                className="border-2 card-hover overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{medicine.name}</h3>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Pill className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-2 pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">
                      ${medicine.price.toFixed(2)}
                    </span>
                    <Badge
                      variant={medicine.stock === 0 ? "destructive" : medicine.stock >= 10 ? "default" : "secondary"}
                      className={medicine.stock === 0 ? "" : "bg-secondary text-secondary-foreground"}
                    >
                      {medicine.stock === 0
                        ? "Out of Stock"
                        : medicine.stock >= 10
                          ? "In Stock"
                          : `Only ${medicine.stock} left`}
                    </Badge>
                  </div>
                </CardContent>

                {medicine.stock > 0 ? (
                  <CardFooter className="flex flex-col gap-3 border-t pt-4 mt-4">
                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm text-muted-foreground">
                        Quantity:
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(medicine.id, -1)}
                          disabled={getQuantity(medicine.id) <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {getQuantity(medicine.id)}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (getQuantity(medicine.id) < medicine.stock) {
                              updateQuantity(medicine.id, 1);
                            } else {
                              toast.error(`Cannot select more than available stock (${medicine.stock})`);
                            }
                          }}
                          disabled={getQuantity(medicine.id) >= medicine.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleAddToCart(medicine)}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {isInCart(medicine.id) ? "Add More" : "Add to Cart"}
                    </Button>
                  </CardFooter>
                ) : (
                  <CardFooter className="flex justify-center border-t pt-4 mt-4 pb-6">
                    <div className="w-full py-2.5 bg-destructive/10 text-destructive text-center rounded-md font-semibold text-sm flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Currently Out of Stock
                    </div>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Pill className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No medicines found
            </h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </main>

      <MedicineChatbot />
    </div>
  );
};

export default Medicines;
