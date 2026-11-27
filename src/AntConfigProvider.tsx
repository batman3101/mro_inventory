import { useMemo } from 'react';
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

// The antd theme and language in use right now. It reads the theme store and
// i18n by itself (no React context), so it works in any React root.
const useAntdConfig = () => {
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

  return { theme, locale: getLocale() };
};

// message.success() and the other static calls are drawn in a React root of
// antd's own, outside AntConfigProvider. This gives that root the same theme
// and language. Because it subscribes on its own, a toast that is already open
// follows a theme switch too (handing over a fixed theme object did not: the
// open toast kept the old colours until the next message call).
const StaticHolder = ({ children }: AntConfigProviderProps) => {
  const { theme, locale } = useAntdConfig();
  return (
    <ConfigProvider theme={theme} locale={locale}>
      {children}
    </ConfigProvider>
  );
};

ConfigProvider.config({
  holderRender: (children) => <StaticHolder>{children}</StaticHolder>,
});

const AntConfigProvider = ({ children }: AntConfigProviderProps) => {
  const { theme, locale } = useAntdConfig();

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
