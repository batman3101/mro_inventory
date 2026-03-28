import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  ShopOutlined,
  TeamOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth.store';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LocationSelector from '@/components/LocationSelector';

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar = ({ collapsed }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') },
    { key: '/items', icon: <ShoppingOutlined />, label: t('menu.items') },
    { key: '/inventory', icon: <DatabaseOutlined />, label: t('menu.inventory') },
    { key: '/inbound', icon: <ImportOutlined />, label: t('menu.inbound') },
    { key: '/outbound', icon: <ExportOutlined />, label: t('menu.outbound') },
    { key: '/suppliers', icon: <ShopOutlined />, label: t('menu.suppliers') },
    { key: '/departments', icon: <TeamOutlined />, label: t('menu.departments') },
    { key: '/analytics', icon: <BarChartOutlined />, label: t('menu.analytics') },
    { key: '/users', icon: <UserOutlined />, label: t('menu.users') },
  ];

  const selectedKey = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: collapsed ? '16px 8px' : '16px 24px',
          color: '#fff',
          fontSize: collapsed ? 12 : 16,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderBottom: '1px solid #374151',
        }}
      >
        {collapsed ? 'MRO' : t('common.appName')}
      </div>

      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, borderRight: 0 }}
      />

      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          borderTop: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {!collapsed && <LocationSelector />}
        {!collapsed && <LanguageSwitcher />}
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={logout}
          style={{ color: '#9ca3af', justifyContent: 'flex-start' }}
          block
        >
          {collapsed ? '' : t('auth.logout')}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
