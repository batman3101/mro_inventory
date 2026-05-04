import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { Outbound } from '@/types/database.types';
import * as outboundService from '@/services/outbound.service';

interface OutboundState {
  outboundRecords: Outbound[];
  isLoading: boolean;
  error: string | null;
  fetchOutbound: () => Promise<void>;
  createOutbound: (
    data: Parameters<typeof outboundService.createOutbound>[0]
  ) => Promise<Outbound>;
  updateOutbound: (
    id: string,
    data: Parameters<typeof outboundService.updateOutbound>[1],
    updatedBy: string,
  ) => Promise<Outbound>;
  deleteOutbound: (id: string, updatedBy: string) => Promise<void>;
}

export const useOutboundStore = create<OutboundState>((set) => ({
  outboundRecords: [],
  isLoading: false,
  error: null,

  fetchOutbound: async () => {
    set({ isLoading: true, error: null });
    try {
      const outboundRecords = await outboundService.getAllOutbound();
      set({ outboundRecords, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.outbound.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createOutbound: async (data) => {
    const created = await outboundService.createOutbound(data);
    set((state) => ({ outboundRecords: [created, ...state.outboundRecords] }));
    return created;
  },

  updateOutbound: async (id, data, updatedBy) => {
    const updated = await outboundService.updateOutbound(id, data, updatedBy);
    set((state) => ({
      outboundRecords: state.outboundRecords.map((r) =>
        r.outbound_id === id ? updated : r,
      ),
    }));
    return updated;
  },

  deleteOutbound: async (id, updatedBy) => {
    await outboundService.deleteOutbound(id, updatedBy);
    set((state) => ({
      outboundRecords: state.outboundRecords.filter(
        (r) => r.outbound_id !== id
      ),
    }));
  },
}));
