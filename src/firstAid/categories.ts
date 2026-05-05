import type { LocalizedString } from "./types";

export type FirstAidCategory = {
  id: string;
  title: LocalizedString;
  icon: string;
  accent: string;
};

export const firstAidCategories: FirstAidCategory[] = [
  { id: "bleeding", title: { en: "Bleeding", he: "דימום" }, icon: "🩸", accent: "#DC2626" },
  { id: "breathing", title: { en: "Breathing issues", he: "בעיות נשימה" }, icon: "🫁", accent: "#0284C7" },
  { id: "burns", title: { en: "Burns", he: "כוויות" }, icon: "🔥", accent: "#EA580C" },
  { id: "injuries", title: { en: "Injuries", he: "פציעות" }, icon: "🦴", accent: "#7C3AED" },
  { id: "cardiac", title: { en: "Heart & chest", he: "לב וחזה" }, icon: "❤️", accent: "#BE123C" },
  { id: "poisoning", title: { en: "Poisoning", he: "הרעלה" }, icon: "☠️", accent: "#6D28D9" },
  { id: "heatstroke", title: { en: "Heat illness", he: "מחלת חום" }, icon: "🌡️", accent: "#EA580C" },
  { id: "seizures", title: { en: "Seizures", he: "התקפים" }, icon: "⚡", accent: "#CA8A04" },
  { id: "allergic", title: { en: "Allergic reaction", he: "תגובה אלרגית" }, icon: "🧬", accent: "#DB2777" },
  { id: "drowning", title: { en: "Drowning / water", he: "טביעה / מים" }, icon: "🌊", accent: "#0369A1" },
];
