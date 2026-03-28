import { create } from 'zustand';
import type { Item } from '@/types/database.types';
import * as itemsService from '@/services/items.service';

interface ItemsState {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategoryId: string | null;
  fetchItems: () => Promise<void>;
  createItem: (data: Parameters<typeof itemsService.createItem>[0]) => Promise<Item>;
  updateItem: (itemId: string, data: Partial<Item>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: string | null) => void;
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategoryId: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await itemsService.getAllItems();
      set({ items, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '품목 목록 조회 실패';
      set({ error: message, isLoading: false });
    }
  },

  createItem: async (data) => {
    const created = await itemsService.createItem(data);
    set((state) => ({ items: [...state.items, created] }));
    return created;
  },

  updateItem: async (itemId, data) => {
    const updated = await itemsService.updateItem(itemId, data);
    set((state) => ({
      items: state.items.map((item) =>
        item.item_id === itemId ? { ...item, ...updated } : item
      ),
    }));
  },

  deleteItem: async (itemId) => {
    await itemsService.deleteItem(itemId);
    set((state) => ({
      items: state.items.filter((item) => item.item_id !== itemId),
    }));
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setSelectedCategoryId: (categoryId) => {
    set({ selectedCategoryId: categoryId });
  },
}));
