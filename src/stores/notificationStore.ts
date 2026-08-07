import { create } from "zustand";
import type { AppNotification, NotificationKind } from "@/types";

type NotificationStore = {
  items: AppNotification[];
  push: (kind: NotificationKind, title: string, message?: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],
  push: (kind, title, message) =>
    set((s) => ({
      items: [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind,
          title,
          ...(message ? { message } : {}),
          createdAt: Date.now(),
          read: false,
        },
        ...s.items,
      ].slice(0, 50),
    })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
