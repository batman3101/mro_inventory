import { useEffect, useState } from 'react';
import { Layout, message } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useLocationStore } from '@/store/location.store';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/types/database.types';

const { Content, Sider } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
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

  // antd's default collapsed Sider width is 80px. We pin the Sider to the
  // viewport so the menu + footer (logout/factory/language) stay visible
  // regardless of page scroll, and offset the content area by the same width.
  const SIDER_WIDTH = 240;
  const SIDER_COLLAPSED_WIDTH = 80;
  const siderWidth = collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflow: 'hidden',
          zIndex: 100,
        }}
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Content
          style={{
            padding: 24,
            minHeight: 'calc(100vh - 48px)',
            background: '#fff',
          }}
        >
          <Outlet key={currentLocationId ?? 'default'} />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
