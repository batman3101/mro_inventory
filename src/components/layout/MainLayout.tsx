import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useLocationStore } from '@/store/location.store';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/types/database.types';

const MainLayout = () => {
  const [sideOpen, setSideOpen] = useState(true);
  const currentLocationId = useLocationStore((s) => s.currentLocationId);
  const setLocations = useLocationStore((s) => s.setLocations);
  const setCurrentLocation = useLocationStore((s) => s.setCurrentLocation);

  // Bootstrap factory locations from DB on mount.
  // Auto-corrects stale persisted currentLocationId (e.g. legacy 'loc-1' string)
  // by mapping to the first available row when no match is found.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('location_code');
      if (cancelled) return;
      if (error) {
        console.error('locations bootstrap failed:', error);
        message.error(error.message);
        return;
      }
      const rows = (data ?? []) as Location[];
      setLocations(rows);

      const persistedId = useLocationStore.getState().currentLocationId;
      const stillValid = persistedId && rows.some((r) => r.location_id === persistedId);
      if (!stillValid && rows.length > 0) {
        setCurrentLocation(rows[0].location_id, rows[0].location_code);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocations, setCurrentLocation]);

  return (
    <div className="app">
      <TopBar sideOpen={sideOpen} onToggleSide={() => setSideOpen((open) => !open)} />
      <div className="app-shell">
        <Sidebar open={sideOpen} />
        <main className="app-main">
          <div className="app-surface">
            {/* The page scrolls inside the work surface; the top bar and the menu stay put. */}
            <div className="app-page">
              <Outlet key={currentLocationId ?? 'default'} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
