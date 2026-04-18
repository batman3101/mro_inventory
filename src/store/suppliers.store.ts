import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { Supplier } from '@/types/database.types';
import * as suppliersService from '@/services/suppliers.service';

interface SuppliersState {
  suppliers: Supplier[];
  isLoading: boolean;
  error: string | null;
  fetchSuppliers: () => Promise<void>;
  createSupplier: (data: Parameters<typeof suppliersService.createSupplier>[0]) => Promise<Supplier>;
  updateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
}

export const useSupplierStore = create<SuppliersState>((set) => ({
  suppliers: [],
  isLoading: false,
  error: null,

  fetchSuppliers: async () => {
    set({ isLoading: true, error: null });
    try {
      const suppliers = await suppliersService.getAllSuppliers();
      set({ suppliers, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.suppliers.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createSupplier: async (data) => {
    const created = await suppliersService.createSupplier(data);
    set((state) => ({ suppliers: [...state.suppliers, created] }));
    return created;
  },

  updateSupplier: async (supplierId, data) => {
    const updated = await suppliersService.updateSupplier(supplierId, data);
    set((state) => ({
      suppliers: state.suppliers.map((s) =>
        s.supplier_id === supplierId ? { ...s, ...updated } : s
      ),
    }));
  },

  deleteSupplier: async (supplierId) => {
    await suppliersService.deleteSupplier(supplierId);
    set((state) => ({
      suppliers: state.suppliers.filter((s) => s.supplier_id !== supplierId),
    }));
  },
}));
