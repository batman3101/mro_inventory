import { create } from 'zustand';
import i18n from '@/i18n/config';
import { createFetchGuard } from '@/store/fetchGuard';
import type { ReorderAlert } from '@/types/database.types';
import type { InventoryWithItem, ReorderAlertWithItem } from '@/services/inventory.service';
import * as inventoryService from '@/services/inventory.service';

interface InventoryState {
  inventoryItems: InventoryWithItem[];
  alerts: ReorderAlertWithItem[];
  isLoading: boolean;
  error: string | null;
  fetchInventory: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  updateQuantity: (inventoryId: string, newQuantity: number, updatedBy: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, resolvedBy: string) => Promise<void>;
}

const fetchInventoryGuard = createFetchGuard();

const fetchAlertsGuard = createFetchGuard();

export const useInventoryStore = create<InventoryState>((set) => ({
  inventoryItems: [],
  alerts: [],
  isLoading: false,
  error: null,

  fetchInventory: async () => {
    const request = fetchInventoryGuard.start();
    // Rows of another factory must not stay visible while the new ones load.
    set({ isLoading: true, error: null, ...(request.locationChanged ? { inventoryItems: [] } : {}) });
    try {
      const inventoryItems = await inventoryService.getAllInventory();
      if (!fetchInventoryGuard.isLatest(request)) return;
      set({ inventoryItems, isLoading: false });
    } catch (error) {
      if (!fetchInventoryGuard.isLatest(request)) return;
      const message = error instanceof Error ? error.message : i18n.t('errors.inventory.listFallback');
      set({ inventoryItems: [], error: message, isLoading: false });
    }
  },

  fetchAlerts: async () => {
    const request = fetchAlertsGuard.start();
    // Rows of another factory must not stay visible while the new ones load.
    set({ isLoading: true, error: null, ...(request.locationChanged ? { alerts: [] } : {}) });
    try {
      const alerts = await inventoryService.getReorderAlerts();
      if (!fetchAlertsGuard.isLatest(request)) return;
      set({ alerts, isLoading: false });
    } catch (error) {
      if (!fetchAlertsGuard.isLatest(request)) return;
      const message = error instanceof Error ? error.message : i18n.t('errors.inventory.alertsFallback');
      set({ alerts: [], error: message, isLoading: false });
    }
  },

  updateQuantity: async (inventoryId, newQuantity, updatedBy) => {
    await inventoryService.updateQuantity(inventoryId, newQuantity, updatedBy);
    set((state) => ({
      inventoryItems: state.inventoryItems.map((item) =>
        item.inventory_id === inventoryId
          ? { ...item, current_quantity: newQuantity, updated_by: updatedBy }
          : item
      ),
    }));
  },

  acknowledgeAlert: async (alertId) => {
    await inventoryService.acknowledgeAlert(alertId);
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.alert_id !== alertId),
    }));
  },

  resolveAlert: async (alertId, resolvedBy) => {
    await inventoryService.resolveAlert(alertId, resolvedBy);
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.alert_id !== alertId),
    }));
  },
}));
