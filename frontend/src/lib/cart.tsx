import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Item } from "./types";
const key = "doinggood.cart.v1";
export function readCartIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
            ),
          ),
        ].slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
const CartContext = createContext<{
  ids: string[];
  add: (item: Item) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
}>({ ids: [], add: () => {}, remove: () => {}, removeMany: () => {} });
export function CartProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState(readCartIds);
  function persist(next: string[]) {
    localStorage.setItem(key, JSON.stringify(next));
    setIds(next);
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key) setIds(readCartIds());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <CartContext.Provider
      value={{
        ids,
        add: (item) => {
          if (item.status !== "available") throw new Error("This item is no longer available.");
          const current = readCartIds();
          if (current.includes(item.id)) return;
          if (current.length >= 20) throw new Error("Your cart can hold up to 20 items.");
          persist([...current, item.id]);
        },
        remove: (id) => persist(readCartIds().filter((saved) => saved !== id)),
        removeMany: (removeIds) =>
          persist(readCartIds().filter((saved) => !removeIds.includes(saved))),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  return useContext(CartContext);
}
