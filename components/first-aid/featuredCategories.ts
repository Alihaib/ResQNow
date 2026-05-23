import type { Ionicons } from "@expo/vector-icons";

export type FeaturedFirstAidCategory = {
  id: string;
  categoryId: string;
  /** Direct guide route; if set, opens guide instead of category list */
  guideId?: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  accent: string;
  /** Hub grid: CPR, breathing, bleeding get top visual weight */
  priority?: boolean;
};

/** Priority bento grid — maps to existing first-aid library IDs */
export const FEATURED_FIRST_AID: FeaturedFirstAidCategory[] = [
  {
    id: "cpr",
    categoryId: "breathing",
    guideId: "breathing_cpr_overview",
    icon: "heart-circle-outline",
    titleKey: "firstAidFeatured_cpr",
    titleFallback: "CPR",
    descKey: "firstAidFeatured_cprDesc",
    descFallback: "Chest compressions & rescue breaths",
    accent: "#2563EB",
    priority: true,
  },
  {
    id: "breathing",
    categoryId: "breathing",
    icon: "fitness-outline",
    titleKey: "firstAidFeatured_breathing",
    titleFallback: "Breathing Trouble",
    descKey: "firstAidFeatured_breathingDesc",
    descFallback: "Shortness of breath, asthma, panic",
    accent: "#0284C7",
    priority: true,
  },
  {
    id: "bleeding",
    categoryId: "bleeding",
    icon: "water-outline",
    titleKey: "firstAidFeatured_bleeding",
    titleFallback: "Bleeding Control",
    descKey: "firstAidFeatured_bleedingDesc",
    descFallback: "Pressure, elevation, when to call",
    accent: "#2563EB",
    priority: true,
  },
  {
    id: "cardiac",
    categoryId: "cardiac",
    icon: "medical-outline",
    titleKey: "firstAidFeatured_heart",
    titleFallback: "Heart Symptoms",
    descKey: "firstAidFeatured_heartDesc",
    descFallback: "Chest pain, stroke warning signs",
    accent: "#BE123C",
  },
  {
    id: "burns",
    categoryId: "burns",
    icon: "flame-outline",
    titleKey: "firstAidFeatured_burns",
    titleFallback: "Burns",
    descKey: "firstAidFeatured_burnsDesc",
    descFallback: "Cool, cover, protect the skin",
    accent: "#EA580C",
  },
  {
    id: "choking",
    categoryId: "breathing",
    guideId: "breathing_choking_conscious",
    icon: "hand-left-outline",
    titleKey: "firstAidFeatured_choking",
    titleFallback: "Choking",
    descKey: "firstAidFeatured_chokingDesc",
    descFallback: "Conscious adult — back blows & thrusts",
    accent: "#0369A1",
  },
];

export const FEATURED_CATEGORY_IDS = new Set(
  FEATURED_FIRST_AID.map((f) => f.categoryId),
);
