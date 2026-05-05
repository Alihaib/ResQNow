/** Educational First Aid tab — bilingual strings (separate from SOS smart action flow). */

export type Lang = "en" | "he";

export type LocalizedString = { en: string; he: string };

export type FirstAidGuide = {
  id: string;
  title: LocalizedString;
  category: string;
  steps: LocalizedString[];
  warnings: LocalizedString[];
};

export function pick(lang: Lang, s: LocalizedString): string {
  return lang === "he" ? s.he : s.en;
}
