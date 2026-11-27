import { Button, Popover, Tag } from 'antd';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LocationSelector from '@/components/LocationSelector';

interface TopBarProps {
  sideOpen: boolean;
  onToggleSide: () => void;
}

const TopBar = ({ sideOpen, onToggleSide }: TopBarProps) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const displayName = user?.full_name || user?.email || '';

  return (
    <header className="app-top">
      <Button
        type="text"
        className="tbtn"
        icon={sideOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        title={t('layout.toggleSidebar')}
        aria-label={t('layout.toggleSidebar')}
        aria-expanded={sideOpen}
        onClick={onToggleSide}
      />
      <div className="app-brand">
        <img src="/A%20symbol%20BLUE-02.png" alt="Almus" />
        <span className="ell">{t('common.appName')}</span>
      </div>
      <span className="sp" />
      <LocationSelector />
      <span className="tsep" />
      <LanguageSwitcher />
      {user && (
        <Popover
          trigger="click"
          placement="bottomRight"
          arrow={false}
          content={
            <div className="user-pop">
              <div className="who">
                <b className="ell">{displayName}</b>
                <span className="mail">{user.email}</span>
                <Tag color="processing">{t(`users.roles.${user.role}`, user.role)}</Tag>
              </div>
              <div className="msep" />
              <Button type="text" danger block icon={<LogoutOutlined />} onClick={logout}>
                {t('auth.logout')}
              </Button>
            </div>
          }
        >
          <Button
            type="text"
            className="tbtn"
            title={displayName}
            aria-label={t('layout.account', { name: displayName })}
          >
            <span className="app-avatar" aria-hidden="true">{displayName.trim().charAt(0).toUpperCase()}</span>
          </Button>
        </Popover>
      )}
    </header>
  );
};

export default TopBar;
