import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from 'antd';
import {
  DashboardOutlined,
  ContainerOutlined,
  AppstoreOutlined,
  TagsOutlined,
  LoginOutlined,
  LogoutOutlined as LogoutIcon,
  TeamOutlined,
  UserSwitchOutlined,
  BarChartOutlined,
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
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') },
    { key: '/inventory', icon: <ContainerOutlined />, label: t('menu.inventory') },
    { key: '/items', icon: <AppstoreOutlined />, label: t('menu.items') },
    { key: '/categories', icon: <TagsOutlined />, label: t('menu.categories') },
    { key: '/inbound', icon: <LoginOutlined />, label: t('menu.inbound') },
    { key: '/outbound', icon: <LogoutIcon />, label: t('menu.outbound') },
    { key: '/suppliers', icon: <TeamOutlined />, label: t('menu.suppliers') },
    { key: '/users', icon: <UserSwitchOutlined />, label: t('menu.users') },
    { key: '/analytics', icon: <BarChartOutlined />, label: t('menu.analytics') },
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
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <img
          src="/A%20symbol%20BLUE-02.png"
          alt="Almus"
          style={{ height: collapsed ? 24 : 28, width: 'auto', flexShrink: 0 }}
        />
        {!collapsed && <span>{t('common.appName')}</span>}
      </div>

      {/* Menu wrapper with min-height:0 + overflow:auto so the menu shrinks
          and scrolls instead of pushing the footer (email/logout/factory/
          language) below the Sider's collapse trigger on shorter viewports. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </div>

      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          borderTop: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {!collapsed && user && (
          <div style={{ color: '#d1d5db', fontSize: 13, textAlign: 'center', wordBreak: 'break-all' }}>
            {user.email}
          </div>
        )}
        <Button
          danger
          type="primary"
          icon={<LogoutOutlined />}
          onClick={logout}
          block
        >
          {collapsed ? '' : t('auth.logout')}
        </Button>
        {!collapsed && <LocationSelector />}
        {!collapsed && <LanguageSwitcher />}
      </div>
    </div>
  );
};

export default Sidebar;
