import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Medicine, STORAGE_KEYS } from '@/lib/data';

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (medicine: Medicine, quantity?: number) => void;
  removeFromCart: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
        const storedCart = sessionStorage.getItem(STORAGE_KEYS.CART);
        if (storedCart) {
            setItems(JSON.parse(storedCart));
        }
    } catch {
        setItems([]);
    }
  }, []);

  const saveCart = (newItems: CartItem[]) => {
    setItems(newItems);
    sessionStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newItems));
  };

  const addToCart = (medicine: Medicine, quantity = 1) => {
    const existingIndex = items.findIndex(item => item.medicine.id === medicine.id);
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += quantity;
      saveCart(newItems);
    } else {
      saveCart([...items, { medicine, quantity }]);
    }
  };

  const removeFromCart = (medicineId: string) => {
    saveCart(items.filter(item => item.medicine.id !== medicineId));
  };

  const updateQuantity = (medicineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(medicineId);
      return;
    }
    
    const newItems = items.map(item =>
      item.medicine.id === medicineId ? { ...item, quantity } : item
    );
    saveCart(newItems);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.medicine.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
