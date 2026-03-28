import { Select } from 'antd';
import { useTranslation } from 'react-i18next';

const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'vi', label: 'Tiếng Việt' },
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <Select
      value={i18n.language}
      onChange={handleChange}
      options={LANGUAGE_OPTIONS}
      size="small"
      style={{ width: '100%' }}
    />
  );
};

export default LanguageSwitcher;
