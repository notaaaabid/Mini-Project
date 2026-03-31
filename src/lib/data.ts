// MediCare AI Platform - Mock Data Store
import { supabase } from './supabase';

export interface Medicine {
  id: string;
  name: string;
  category?: string;
  price: number;
  description?: string;
  image: string;
  stock: number;
  instructions?: {
    timing?: "before_food" | "after_food" | "with_food" | "anytime";
    drinkWith?: string;
    foodsToAvoid?: string[];
    dosageTiming?: string;
    precautions?: string[];
  };
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  experience: number;
  rating: number;
  availability: string[];
  image: string;
  fee: number;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  type: "video" | "in-person";
  notes?: string;
  payment_method?: "wallet" | "cod";
  transaction_id?: string;
  fee?: number;
}

export interface Order {
  id: string;
  patient_id: string;
  patient_name: string;
  items: {
    medicineId: string;
    medicineName: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  order_date: string;
  delivery_address: string;
  payment_method?: "wallet" | "cod";
  transaction_id?: string;
  is_refunded?: boolean;
}

export interface Prescription {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  medicines: {
    name: string;
    dosage: string;
    duration: string;
    instructions: string;
  }[];
  diagnosis: string;
  notes?: string;
  consultation_time?: string;
  attachment?: {
    name: string;
    data: string;
    type: string;
  };
  doctor_visible?: boolean;
  patient_visible?: boolean;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "patient" | "doctor" | "admin";
  phone?: string;
  address?: string;
  image?: string;
  balance?: number;
}

// Initial mock data
export const initialMedicines: Medicine[] = [
  {
    id: "1",
    name: "Paracetamol 500mg",
    category: "Pain Relief",
    price: 5.99,
    description: "Effective pain reliever and fever reducer",
    image: "/placeholder.svg",
    stock: 150,
    instructions: {
      timing: "after_food",
      drinkWith: "Water - avoid alcohol",
      foodsToAvoid: ["Alcohol", "Caffeine in excess"],
      dosageTiming: "Every 4-6 hours as needed",
      precautions: [
        "Do not exceed 4g in 24 hours",
        "Consult doctor if symptoms persist",
      ],
    },
  },
  {
    id: "2",
    name: "Amoxicillin 250mg",
    category: "Antibiotics",
    price: 12.99,
    description: "Broad-spectrum antibiotic for bacterial infections",
    image: "/placeholder.svg",
    stock: 80,
    instructions: {
      timing: "before_food",
      drinkWith: "Water - full glass",
      foodsToAvoid: ["Dairy products within 2 hours"],
      dosageTiming: "Every 8 hours for prescribed duration",
      precautions: ["Complete full course", "May cause stomach upset"],
    },
  },
  {
    id: "3",
    name: "Omeprazole 20mg",
    category: "Digestive Health",
    price: 8.49,
    description: "Reduces stomach acid production",
    image: "/placeholder.svg",
    stock: 120,
    instructions: {
      timing: "before_food",
      drinkWith: "Water - 30 minutes before meals",
      foodsToAvoid: ["Spicy foods", "Citrus fruits"],
      dosageTiming: "Once daily in the morning",
      precautions: [
        "Do not crush or chew",
        "Long-term use requires monitoring",
      ],
    },
  },
  {
    id: "4",
    name: "Cetirizine 10mg",
    category: "Allergy Relief",
    price: 6.99,
    description: "Non-drowsy antihistamine for allergies",
    image: "/placeholder.svg",
    stock: 200,
    instructions: {
      timing: "anytime",
      drinkWith: "Water",
      foodsToAvoid: ["Grapefruit juice"],
      dosageTiming: "Once daily, preferably at night",
      precautions: ["May cause drowsiness in some", "Avoid alcohol"],
    },
  },
  {
    id: "5",
    name: "Metformin 500mg",
    category: "Diabetes Care",
    price: 9.99,
    description: "Blood sugar management medication",
    image: "/placeholder.svg",
    stock: 90,
    instructions: {
      timing: "with_food",
      drinkWith: "Water - with meals",
      foodsToAvoid: ["Excessive sugar", "Alcohol"],
      dosageTiming: "With breakfast and dinner",
      precautions: ["Monitor blood sugar regularly", "Stay hydrated"],
    },
  },
  {
    id: "6",
    name: "Vitamin D3 1000IU",
    category: "Vitamins",
    price: 14.99,
    description: "Essential vitamin for bone health",
    image: "/placeholder.svg",
    stock: 250,
    instructions: {
      timing: "with_food",
      drinkWith: "Water or milk",
      foodsToAvoid: [],
      dosageTiming: "Once daily with a meal containing fat",
      precautions: [
        "Do not exceed recommended dose",
        "May interact with certain medications",
      ],
    },
  },
];

export const initialDoctors: Doctor[] = []; // Intentionally blank, doctors seeded by Admin

export const initialUsers: User[] = [
  {
    id: "a1",
    email: "admin@test.com",
    password: "admin123",
    name: "Admin User",
    role: "admin",
  },
];

// Chatbot knowledge base
export const chatbotKnowledge = {
  medicines: initialMedicines.reduce(
    (acc, med) => {
      acc[med.name.toLowerCase()] = med.instructions;
      return acc;
    },
    {} as Record<string, Medicine["instructions"]>,
  ),

  generalTips: [
    "Always read the medicine label carefully before taking any medication.",
    "Store medicines in a cool, dry place away from direct sunlight.",
    "Never share your prescription medications with others.",
    "Keep all medicines out of reach of children.",
    "If you miss a dose, do not double up - consult your doctor or pharmacist.",
    "Always complete the full course of antibiotics as prescribed.",
  ],

  disclaimer:
    "⚠️ This chatbot provides general information only and does not replace professional medical advice. Always consult with your healthcare provider for personalized medical guidance.",
};

// Storage keys
const STORAGE_KEYS = {
  MEDICINES: "medicare_medicines",
  DOCTORS: "medicare_doctors",
  APPOINTMENTS: "medicare_appointments",
  ORDERS: "medicare_orders",
  PRESCRIPTIONS: "medicare_prescriptions",
  USERS: "medicare_users",
  CURRENT_USER: "medicare_current_user",
  CART: "medicare_cart",
  TRANSACTIONS: "medicare_transactions",
  HIDDEN_PRESCRIPTIONS: "medicare_hidden_prescriptions",
  HIDDEN_APPOINTMENTS: "medicare_hidden_appointments",
  HIDDEN_ORDERS: "medicare_hidden_orders",
};

// Export storage keys for use in components
export { STORAGE_KEYS };

// Initialize data if not present (Runs against Supabase)
export const initializeData = async () => {
  try {
    const url = (supabase as any).supabaseUrl; 
    if (!url || url.includes('undefined')) return;

    // Check medicines
    const { data: medicines, error: medErr } = await supabase.from('medicines').select('id').limit(1);
    if (!medErr && (!medicines || medicines.length === 0)) {
      await supabase.from('medicines').insert(initialMedicines);
    }

    // Check users (Only Admin)
    const { data: users, error: userErr } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
    if (!userErr && (!users || users.length === 0)) {
      await supabase.from('users').insert(initialUsers);
    }
  } catch (error) {
    console.error("Error initializing Supabase data:", error);
  }
};

// Per-user hidden items helpers mapped to Supabase hidden_items table
export const hideItemForUser = async (storageKey: string, userId: string, itemId: string): Promise<void> => {
  let cat = 'prescription';
  if (storageKey === STORAGE_KEYS.HIDDEN_APPOINTMENTS) cat = 'appointment';
  else if (storageKey === STORAGE_KEYS.HIDDEN_ORDERS) cat = 'order';
  
  await supabase.from('hidden_items').upsert({
    user_id: userId,
    item_id: itemId,
    category: cat
  }, { onConflict: 'user_id, item_id, category' });
};

export const getHiddenItems = async (storageKey: string, userId: string): Promise<string[]> => {
  let cat = 'prescription';
  if (storageKey === STORAGE_KEYS.HIDDEN_APPOINTMENTS) cat = 'appointment';
  else if (storageKey === STORAGE_KEYS.HIDDEN_ORDERS) cat = 'order';

  const { data, error } = await supabase
    .from('hidden_items')
    .select('item_id')
    .eq('user_id', userId)
    .eq('category', cat);
    
  if (error || !data) return [];
  return data.map(row => row.item_id);
};

export const clearHiddenItems = async (storageKey: string, userId: string, itemIds: string[]): Promise<void> => {
   let cat = 'prescription';
   if (storageKey === STORAGE_KEYS.HIDDEN_APPOINTMENTS) cat = 'appointment';
   else if (storageKey === STORAGE_KEYS.HIDDEN_ORDERS) cat = 'order';

   if (itemIds.length === 0) return;

   await supabase
    .from('hidden_items')
    .delete()
    .eq('user_id', userId)
    .eq('category', cat)
    .in('item_id', itemIds);
};
