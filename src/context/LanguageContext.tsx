import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { I18nManager } from "react-native";
import i18n from "../i18n/i18n";

type Lang = "en" | "he";

type LanguageContextType = {
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: async () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync("app_lang");
        const initialLang = stored === "he" ? "he" : "en";
        applyLanguage(initialLang, false);
      } catch {
        applyLanguage("en", false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const applyLanguage = (language: Lang, persist: boolean) => {
    setLangState(language);
    i18n.locale = language;

    const isRTL = language === "he";

    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }

    if (persist) {
      SecureStore.setItemAsync("app_lang", language).catch(() => {});
    }
  };

  const setLang = async (language: Lang) => {
    applyLanguage(language, true);
  };

  const toggleLanguage = () => {
    const next = lang === "he" ? "en" : "he";
    setLang(next);
  };

  /** פונקציית תרגום */
  const t = (key: string) => {
    return i18n.t(key);
  };

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
