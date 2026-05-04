import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { Inbound } from '@/types/database.types';
import * as inboundService from '@/services/inbound.service';

interface InboundState {
  inboundRecords: Inbound[];
  isLoading: boolean;
  error: string | null;
  fetchInbound: () => Promise<void>;
  createInbound: (data: Parameters<typeof inboundService.createInbound>[0]) => Promise<Inbound>;
  updateInbound: (id: string, data: Parameters<typeof inboundService.updateInbound>[1], updatedBy: string) => Promise<Inbound>;
  deleteInbound: (id: string, updatedBy: string) => Promise<void>;
}

export const useInboundStore = create<InboundState>((set) => ({
  inboundRecords: [],
  isLoading: false,
  error: null,

  fetchInbound: async () => {
    set({ isLoading: true, error: null });
    try {
      const inboundRecords = await inboundService.getAllInbound();
      set({ inboundRecords, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.inbound.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createInbound: async (data) => {
    const created = await inboundService.createInbound(data);
    set((state) => ({ inboundRecords: [created, ...state.inboundRecords] }));
    return created;
  },

  updateInbound: async (id, data, updatedBy) => {
    const updated = await inboundService.updateInbound(id, data, updatedBy);
    set((state) => ({
      inboundRecords: state.inboundRecords.map((r) => (r.inbound_id === id ? updated : r)),
    }));
    return updated;
  },

  deleteInbound: async (id, updatedBy) => {
    await inboundService.deleteInbound(id, updatedBy);
    set((state) => ({
      inboundRecords: state.inboundRecords.filter((r) => r.inbound_id !== id),
    }));
  },
}));
