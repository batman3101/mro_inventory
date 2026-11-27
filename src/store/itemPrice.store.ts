import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { ItemPrice } from '@/types/database.types';
import * as itemPriceService from '@/services/itemPrice.service';

interface ItemPriceState {
  prices: ItemPrice[];
  isLoading: boolean;
  error: string | null;
  fetchPrices: (itemId: string, locationId: string) => Promise<void>;
  createPrice: (data: itemPriceService.ItemPriceInput) => Promise<ItemPrice>;
  updatePrice: (priceId: string, data: itemPriceService.ItemPriceInput) => Promise<void>;
  deletePrice: (priceId: string) => Promise<void>;
}

export const useItemPriceStore = create<ItemPriceState>((set) => ({
  prices: [],
  isLoading: false,
  error: null,

  fetchPrices: async (itemId, locationId) => {
    set({ isLoading: true, error: null });
    try {
      const prices = await itemPriceService.getItemPrices(itemId, locationId);
      set({ prices, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.itemPrice.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createPrice: async (data) => {
    const created = await itemPriceService.saveItemPrice(data);
    set((state) => ({ prices: [created, ...state.prices] }));
    return created;
  },

  updatePrice: async (priceId, data) => {
    const updated = await itemPriceService.saveItemPrice(data, priceId);
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
