// src/i18n/i18n.ts
import { I18n } from "i18n-js";
import en from "./en";
import he from "./he";

const i18n = new I18n({ en, he });

i18n.enableFallback = true;
i18n.defaultLocale = "en";
i18n.locale = "en"; // יתעדכן דרך LanguageContext

export default i18n;
