import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tokens } from "../ui/tokens";
import * as SecureStore from "expo-secure-store";
import i18n from "../i18n/i18n";
import {
  applyDirectionChange,
  applyWebDocumentDirection,
  getLayoutDirection,
  isRTL,
} from "../utils/rtl";

type Lang = "en" | "he";

type LanguageContextType = {
  lang: Lang;
  isRTL: boolean;
  direction: "ltr" | "rtl";
  /** Bumps when native direction changes — optional key for stubborn subtrees */
  directionVersion: number;
  setLang: (lang: Lang) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  isRTL: false,
  direction: "ltr",
  directionVersion: 0,
  setLang: async () => {},
  toggleLanguage: async () => {},
  t: (key: string) => key,
});

const LANG_KEY = "app_lang";

/**
 * Applies locale + native direction flags. Layout mirrors on the next render
 * via LanguageContext (lang / direction) — no app reload.
 */
function applyLanguageState(
  language: Lang,
  setDirectionVersion: React.Dispatch<React.SetStateAction<number>>,
) {
  i18n.locale = language;
  const directionChanged = applyDirectionChange(language);
  if (directionChanged) {
    setDirectionVersion((v) => v + 1);
  }
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  const [directionVersion, setDirectionVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LANG_KEY);
        const initialLang: Lang = stored === "he" ? "he" : "en";
        applyLanguageState(initialLang, setDirectionVersion);
        setLangState(initialLang);
      } catch {
        applyLanguageState("en", setDirectionVersion);
        setLangState("en");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback(async (language: Lang) => {
    applyLanguageState(language, setDirectionVersion);
    setLangState(language);
    try {
      await SecureStore.setItemAsync(LANG_KEY, language);
    } catch {
      /* ignore persist errors */
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const next: Lang = lang === "he" ? "en" : "he";
    await setLang(next);
  }, [lang, setLang]);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return String(
        i18n.t(key, fallback !== undefined ? { defaultValue: fallback } : {}),
      );
    },
    [lang],
  );

  const value = useMemo(
    () => ({
      lang,
      isRTL: isRTL(lang),
      direction: getLayoutDirection(lang),
      directionVersion,
      setLang,
      toggleLanguage,
      t,
    }),
    [lang, directionVersion, setLang, toggleLanguage, t],
  );

  if (!ready) {
    return (
      <View style={bootStyles.container}>
        <ActivityIndicator size="large" color={tokens.color.primary} />
        <Text style={bootStyles.label}>Loading...</Text>
      </View>
    );
  }

  const rootDirection: ViewStyle = {
    flex: 1,
    direction: value.direction,
  };

  return (
    <LanguageContext.Provider value={value}>
      <View style={rootDirection}>{children}</View>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

const bootStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.bgPage,
    gap: tokens.space.md,
  },
  label: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.semibold,
  },
});
