import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import viVN from 'antd/locale/vi_VN';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface AntConfigProviderProps {
  children: ReactNode;
}

const AntConfigProvider = ({ children }: AntConfigProviderProps) => {
  const { i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'vi':
        return viVN;
      case 'ko':
      default:
        return koKR;
    }
  };

  return (
    <ConfigProvider
      locale={getLocale()}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 6,
          fontSize: 14,
        },
        components: {
          Layout: {
            siderBg: '#1f2937',
            triggerBg: '#374151',
          },
          Menu: {
            darkItemBg: '#1f2937',
            darkItemSelectedBg: '#374151',
            darkItemHoverBg: '#374151',
          },
        },
      }}
      warning={{
        strict: false,
      }}
    >
      {children}
    </ConfigProvider>
  );
};

export default AntConfigProvider;
