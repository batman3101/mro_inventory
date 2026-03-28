import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Location } from '../types/database.types';

interface LocationState {
  currentLocationId: string | null;
  currentLocationCode: string | null;
  locations: Location[];
  setCurrentLocation: (locationId: string, locationCode: string) => void;
  setLocations: (locations: Location[]) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      currentLocationId: null,
      currentLocationCode: null,
      locations: [],

      setCurrentLocation: (locationId: string, locationCode: string) => {
        set({ currentLocationId: locationId, currentLocationCode: locationCode });
      },

      setLocations: (locations: Location[]) => {
        set({ locations: [...locations] });
      },

      clearLocation: () => {
        set({ currentLocationId: null, currentLocationCode: null });
      },
    }),
    {
      name: 'mro-location-storage',
      partialize: (state) => ({
        currentLocationId: state.currentLocationId,
        currentLocationCode: state.currentLocationCode,
      }),
    }
  )
);
