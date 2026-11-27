import { Segmented } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useThemeStore, type ThemeMode } from '@/store/theme.store';

const ThemeSwitcher = () => {
  const { t } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div>
      <div className="lbl" id="theme-switcher-label">{t('theme.label')}</div>
      <Segmented<ThemeMode>
        block
        aria-labelledby="theme-switcher-label"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'light', label: t('theme.light'), icon: <SunOutlined /> },
          { value: 'dark', label: t('theme.dark'), icon: <MoonOutlined /> },
          { value: 'system', label: t('theme.system') },
        ]}
      />
    </div>
  );
};

export default ThemeSwitcher;
