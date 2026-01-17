import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

export const useLanguageSync = () => {
  const { i18n } = useTranslation();
  const { settings } = useStore();

  useEffect(() => {
    if (settings.interfaceLanguage === 'auto') {
      i18n.changeLanguage(navigator.language);
    } else if (settings.interfaceLanguage) {
      i18n.changeLanguage(settings.interfaceLanguage);
    }
  }, [settings.interfaceLanguage, i18n]);
};
