import { create } from 'zustand';
import i18n from '@/i18n/config';
import { createFetchGuard } from '@/store/fetchGuard';
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

const fetchOutboundGuard = createFetchGuard();

export const useOutboundStore = create<OutboundState>((set) => ({
  outboundRecords: [],
  isLoading: false,
  error: null,

  fetchOutbound: async () => {
    const request = fetchOutboundGuard.start();
    // Rows of another factory must not stay visible while the new ones load.
    set({ isLoading: true, error: null, ...(request.locationChanged ? { outboundRecords: [] } : {}) });
    try {
      const outboundRecords = await outboundService.getAllOutbound();
      if (!fetchOutboundGuard.isLatest(request)) return;
      set({ outboundRecords, isLoading: false });
    } catch (error) {
      if (!fetchOutboundGuard.isLatest(request)) return;
      const message = error instanceof Error ? error.message : i18n.t('errors.outbound.listFallback');
      set({ outboundRecords: [], error: message, isLoading: false });
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
