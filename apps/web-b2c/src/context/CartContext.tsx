import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { CartItem } from '@/lib/types';

// Cart actions
type CartAction = 
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'SET_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'REMOVE_ITEM_BY_INDEX'; payload: number }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_FROM_STORAGE'; payload: CartItem[] };

// Cart state
interface CartState {
  items: CartItem[];
  total: number;
}

// Cart context
interface CartContextType {
  state: CartState;
  addItem: (item: CartItem) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Calculate total from items
const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
};

// Cart reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(item => item.id === action.payload.id);
      
      if (existingItemIndex > -1) {
        // Update existing item quantity
        const updatedItems = [...state.items];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + action.payload.quantity;
        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: existingItem.price * newQuantity
        };
        return {
          items: updatedItems,
          total: calculateTotal(updatedItems)
        };
      } else {
        // Add new item
        const newItems = [...state.items, action.payload];
        return {
          items: newItems,
          total: calculateTotal(newItems)
        };
      }
    }
    
    case 'SET_QUANTITY': {
      if (action.payload.quantity <= 0) {
        // Remove item if quantity is 0 or less
        const newItems = state.items.filter(item => item.id !== action.payload.id);
        return {
          items: newItems,
          total: calculateTotal(newItems)
        };
      }
      
      const updatedItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity, totalPrice: item.price * action.payload.quantity }
          : item
      );
      
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems)
      };
    }
    
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.payload);
      return {
        items: newItems,
        total: calculateTotal(newItems)
      };
    }
    
    case 'REMOVE_ITEM_BY_INDEX': {
      const newItems = state.items.filter((_, index) => index !== action.payload);
      return {
        items: newItems,
        total: calculateTotal(newItems)
      };
    }
    
    case 'CLEAR_CART':
      return {
        items: [],
        total: 0
      };
      
    case 'LOAD_FROM_STORAGE':
      return {
        items: action.payload,
        total: calculateTotal(action.payload)
      };
      
    default:
      return state;
  }
};

// Initial state
const initialState: CartState = {
  items: [],
  total: 0
};

// Cart provider
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('tairet-cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsedCart });
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tairet-cart', JSON.stringify(state.items));
  }, [state.items]);

  // Cart actions
  const addItem = (item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const setQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', payload: { id, quantity } });
  };

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  };

  const removeFromCart = (index: number) => {
    dispatch({ type: 'REMOVE_ITEM_BY_INDEX', payload: index });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const value: CartContextType = {
    state,
    addItem,
    setQuantity,
    removeItem,
    removeFromCart,
    clearCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Hook to use cart context
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};