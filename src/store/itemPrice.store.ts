import { create } from 'zustand';
import type { ItemPrice } from '@/types/database.types';
import * as itemPriceService from '@/services/itemPrice.service';

interface ItemPriceState {
  prices: ItemPrice[];
  isLoading: boolean;
  error: string | null;
  fetchPrices: (itemId: string) => Promise<void>;
  createPrice: (data: Parameters<typeof itemPriceService.createItemPrice>[0]) => Promise<ItemPrice>;
  updatePrice: (priceId: string, data: Partial<ItemPrice>) => Promise<void>;
  deletePrice: (priceId: string) => Promise<void>;
}

export const useItemPriceStore = create<ItemPriceState>((set) => ({
  prices: [],
  isLoading: false,
  error: null,

  fetchPrices: async (itemId) => {
    set({ isLoading: true, error: null });
    try {
      const prices = await itemPriceService.getItemPrices(itemId);
      set({ prices, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '품목 단가 목록 조회 실패';
      set({ error: message, isLoading: false });
    }
  },

  createPrice: async (data) => {
    const created = await itemPriceService.createItemPrice(data);
    set((state) => ({ prices: [created, ...state.prices] }));
    return created;
  },

  updatePrice: async (priceId, data) => {
    const updated = await itemPriceService.updateItemPrice(priceId, data);
    set((state) => ({
      prices: state.prices.map((price) =>
        price.price_id === priceId ? { ...price, ...updated } : price
      ),
    }));
  },

  deletePrice: async (priceId) => {
    await itemPriceService.deleteItemPrice(priceId);
    set((state) => ({
      prices: state.prices.filter((price) => price.price_id !== priceId),
    }));
  },
}));
