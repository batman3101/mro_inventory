import { useEffect, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import viVN from 'antd/locale/vi_VN';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useResolvedTheme } from '@/store/theme.store';
import { buildAntdTheme } from '@/styles/antdTheme';

interface AntConfigProviderProps {
  children: ReactNode;
}

const AntConfigProvider = ({ children }: AntConfigProviderProps) => {
  const { i18n } = useTranslation();
  const themeName = useResolvedTheme();
  const theme = useMemo(() => buildAntdTheme(themeName), [themeName]);

  const getLocale = () => {
    switch (i18n.language) {
      case 'vi':
        return viVN;
      case 'ko':
      default:
        return koKR;
    }
  };
  const locale = getLocale();

  // message.success() and the other static calls render outside this provider,
  // so they are handed the same theme and language here (otherwise a toast
  // stays light and default-blue in dark mode).
  useEffect(() => {
    ConfigProvider.config({
      holderRender: (children) => (
        <ConfigProvider theme={theme} locale={locale}>
          {children}
        </ConfigProvider>
      ),
    });
  }, [theme, locale]);

  return (
    <ConfigProvider
      locale={locale}
      theme={theme}
      warning={{
        strict: false,
      }}
    >
      {children}
    </ConfigProvider>
  );
};

export default AntConfigProvider;
