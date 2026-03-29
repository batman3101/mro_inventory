import { Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <div>
      <Typography.Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6, display: 'block' }}>
        언어 선택
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <Button
          type={i18n.language === 'ko' ? 'primary' : 'default'}
          onClick={() => i18n.changeLanguage('ko')}
          style={{
            flex: 1,
            fontSize: 20,
            height: 36,
            ...(i18n.language !== 'ko'
              ? { background: '#374151', borderColor: '#4b5563' }
              : {}),
          }}
        >
          🇰🇷
        </Button>
        <Button
          type={i18n.language === 'vi' ? 'primary' : 'default'}
          onClick={() => i18n.changeLanguage('vi')}
          style={{
            flex: 1,
            fontSize: 20,
            height: 36,
            ...(i18n.language !== 'vi'
              ? { background: '#374151', borderColor: '#4b5563' }
              : {}),
          }}
        >
          🇻🇳
        </Button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
