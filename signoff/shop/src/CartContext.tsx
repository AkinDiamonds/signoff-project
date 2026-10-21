/**
 * Cart state management and server catalog synchronization.
 *
 * CRITICAL SPEC INVARIANTS (Step 31):
 * - CartItem type contains ONLY { sku, quantity }. No price field is ever stored in cart.
 * - Server catalog alone defines prices. Stale or tampered client state is overridden by server values.
 * - Local storage failures (e.g. Safari private browsing, storage quota exceeded) fail gracefully.
 * - Multi-tab synchronization via the 'storage' event.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MoneyAmount } from '@signoff/ui';
import { fetchCatalog } from './api';
import type { CartItem, Product } from './types';

const CART_STORAGE_KEY = 'signoff.shop.cart';

interface CartContextType {
  items: CartItem[];
  catalog: Record<string, Product>;
  loadingCatalog: boolean;
  catalogError: string | null;
  itemCount: number;
  subtotal: MoneyAmount;
  addToCart: (sku: string, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeFromCart: (sku: string) => void;
  clearCart: () => void;
  refreshCatalog: () => Promise<void>;
  getProduct: (sku: string) => Product | undefined;
}

const CartContext = createContext<CartContextType | null>(null);

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => (
        typeof item === 'object' &&
        item !== null &&
        typeof item.sku === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
      ))
      .map(item => ({
        sku: item.sku,
        quantity: Math.min(Math.max(1, Math.floor(item.quantity)), 5),
      }));
  } catch {
    // Storage read failure / disabled
    return [];
  }
}

function saveCartToStorage(items: CartItem[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage quota or privacy restriction: keep in-memory
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [catalog, setCatalog] = useState<Record<string, Product>>({});
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const list = await fetchCatalog();
      const map: Record<string, Product> = {};
      for (const p of list) {
        map[p.sku] = p;
      }
      setCatalog(map);
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : 'Failed to fetch catalog');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  // Synchronize across multiple browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) {
        setItems(loadCartFromStorage());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addToCart = useCallback((sku: string, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.sku === sku);
      let updated: CartItem[];
      if (existing) {
        // Enforce max 5 quantity per item
        const newQty = Math.min(5, existing.quantity + quantity);
        updated = prev.map(i => (i.sku === sku ? { sku, quantity: newQty } : i));
      } else {
        const initialQty = Math.min(5, Math.max(1, quantity));
        updated = [...prev, { sku, quantity: initialQty }];
      }
      saveCartToStorage(updated);
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    setItems(prev => {
      let updated: CartItem[];
      if (quantity <= 0) {
        updated = prev.filter(i => i.sku !== sku);
      } else {
        const clamped = Math.min(5, Math.max(1, quantity));
        updated = prev.map(i => (i.sku === sku ? { sku, quantity: clamped } : i));
      }
      saveCartToStorage(updated);
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((sku: string) => {
    setItems(prev => {
      const updated = prev.filter(i => i.sku !== sku);
      saveCartToStorage(updated);
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    saveCartToStorage([]);
  }, []);

  const getProduct = useCallback((sku: string) => catalog[sku], [catalog]);

  const itemCount = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  // Compute subtotal strictly from official server catalog prices
  const subtotal = useMemo<MoneyAmount>(() => {
    let totalCents = 0;
    for (const item of items) {
      const prod = catalog[item.sku];
      if (prod && prod.price?.value) {
        const cents = Math.round(parseFloat(prod.price.value) * 100);
        totalCents += cents * item.quantity;
      }
    }
    const valStr = (totalCents / 100).toFixed(2);
    return {
      value: valStr,
      currency_code: 'USD',
    };
  }, [items, catalog]);

  return (
    <CartContext.Provider
      value={{
        items,
        catalog,
        loadingCatalog,
        catalogError,
        itemCount,
        subtotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCatalog,
        getProduct,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
