import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'antd';
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
} from '@ant-design/icons';
import ThemeSwitcher from '@/components/ThemeSwitcher';

interface SidebarProps {
  open: boolean;
}

const Sidebar = ({ open }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
    <nav className={open ? 'app-side' : 'app-side closed'} aria-hidden={!open}>
      {/* The menu scrolls on its own so the footer stays in view on a short window. */}
      <div className="scroll">
        <Menu
          mode="inline"
          inlineIndent={10}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </div>
      <div className="app-sidefoot">
        <ThemeSwitcher />
      </div>
    </nav>
  );
};

export default Sidebar;
