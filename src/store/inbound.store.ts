import { create } from 'zustand';
import type { Inbound } from '@/types/database.types';
import * as inboundService from '@/services/inbound.service';

interface InboundState {
  inboundRecords: Inbound[];
  isLoading: boolean;
  error: string | null;
  fetchInbound: () => Promise<void>;
  createInbound: (data: Parameters<typeof inboundService.createInbound>[0]) => Promise<Inbound>;
  deleteInbound: (id: string) => Promise<void>;
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
      const message = error instanceof Error ? error.message : '입고 목록 조회 실패';
      set({ error: message, isLoading: false });
    }
  },

  createInbound: async (data) => {
    const created = await inboundService.createInbound(data);
    set((state) => ({ inboundRecords: [created, ...state.inboundRecords] }));
    return created;
  },

  deleteInbound: async (id) => {
    await inboundService.deleteInbound(id);
    set((state) => ({
      inboundRecords: state.inboundRecords.filter((r) => r.inbound_id !== id),
    }));
  },
}));
