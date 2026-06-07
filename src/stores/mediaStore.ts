import { create } from 'zustand';
import type { MediaItem } from '@/types';

const uid = () => `m-${Math.random().toString(36).slice(2, 9)}`;

interface MediaStore {
  /** Bibliothèque de médias (pool d'assets, hors historique undo/redo). */
  items: MediaItem[];
  addItem: (kind: 'image' | 'video', name: string, dataUrl: string) => MediaItem;
  removeItem: (id: string) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  items: [],
  addItem: (kind, name, dataUrl) => {
    const item: MediaItem = { id: uid(), name, kind, dataUrl };
    set((s) => ({ items: [...s.items, item] }));
    return item;
  },
  removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
}));
