import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();

  return (
    <Segmented
      aria-label={t('components.languageSelect')}
      title={t('components.languageSelect')}
      value={i18n.language?.startsWith('vi') ? 'vi' : 'ko'}
      onChange={(lang) => i18n.changeLanguage(lang)}
      options={[
        { value: 'ko', label: 'KO' },
        { value: 'vi', label: 'VI' },
      ]}
    />
  );
};

export default LanguageSwitcher;
