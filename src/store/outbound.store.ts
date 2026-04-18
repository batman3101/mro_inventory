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
  deleteOutbound: (id: string) => Promise<void>;
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

  deleteOutbound: async (id) => {
    await outboundService.deleteOutbound(id);
    set((state) => ({
      outboundRecords: state.outboundRecords.filter(
        (r) => r.outbound_id !== id
      ),
    }));
  },
}));
