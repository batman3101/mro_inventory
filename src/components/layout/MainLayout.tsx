import { useState } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useLocationStore } from '@/store/location.store';

const { Content, Sider } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const currentLocationId = useLocationStore((s) => s.currentLocationId);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <Layout>
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
