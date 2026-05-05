/**
 * SOS-only, action-oriented first aid copy (not the full educational First Aid tab).
 * Flow: quick triage answers → resolveSmartCase() → bullet lists (do / don't / call if).
 */

export type SmartCase = "not_breathing" | "unconscious" | "bleeding" | "choking" | "burn" | "general";

export type QuickSituation = "none" | "choking" | "burn";

export type Lang = "en" | "he";

export type LocalizedLine = { en: string; he: string };

export function pickLine(lang: Lang, line: LocalizedLine): string {
  return lang === "he" ? line.he : line.en;
}

/**
 * Priority: optional situation (choking/burn) → airway (not breathing) → unconscious → bleeding → general.
 */
export function resolveSmartCase(input: {
  conscious: boolean;
  breathing: boolean;
  bleeding: boolean;
  situation: QuickSituation;
}): SmartCase {
  if (input.situation === "choking") return "choking";
  if (input.situation === "burn") return "burn";
  if (!input.breathing) return "not_breathing";
  if (!input.conscious) return "unconscious";
  if (input.bleeding) return "bleeding";
  return "general";
}

export const smartInstructions: Record<
  SmartCase,
  { doNow: LocalizedLine[]; dontDo: LocalizedLine[]; callIf: LocalizedLine[] }
> = {
  not_breathing: {
    doNow: [
      { en: "Start CPR: push hard and fast in the center of the chest (100–120/min).", he: "התחילו החייאה: לחיצות חזקות ומהירות במרכז החזה (100–120 לדקה)." },
      { en: "After 30 compressions, give 2 rescue breaths if you are trained.", he: "אחרי 30 לחיצות, נתנו 2 נשימות הצלה אם אתם מיומנים." },
      { en: "Use an AED if available — follow its voice prompts.", he: "השתמשו בדפיברילטור אם יש — עקבו אחרי ההוראות הקוליות." },
      { en: "Continue CPR until responders take over.", he: "המשיכו החייאה עד שהצוות מחליף." },
    ],
    dontDo: [
      { en: "Do not stop CPR unless help takes over or the person clearly responds.", he: "אל תפסיקו החייאה אלא אם צוות מחליף או שהפצוע מתעורר בבירור." },
      { en: "Do not leave the person alone if you can stay safely.", he: "אל תשאירו את הפצוע לבד אם אתם יכולים להישאר בבטחה." },
    ],
    callIf: [
      { en: "No breathing or only gasping at any time.", he: "אין נשימה או נשימה אנקלית בכל עת." },
      { en: "Skin blue/gray or CPR is exhausting — get another helper.", he: "עור כחול/אפור או מתיש — הביאו עוזר נוסף." },
    ],
  },
  unconscious: {
    doNow: [
      { en: "Check breathing; if not breathing, start CPR.", he: "בדקו נשימה; אם אין — התחילו החייאה." },
      { en: "If breathing, place in recovery position (on side, head tilted).", he: "אם יש נשימה — הניחו במצב צד (ראש מוטה)." },
      { en: "Loosen tight clothing; protect from cold/heat.", he: "רופפו בגדים צמודים; הגנו מקור/קור." },
      { en: "Stay with the person and monitor breathing.", he: "הישארו ליד האדם ועקבו אחרי הנשימה." },
    ],
    dontDo: [
      { en: "Do not shake violently or slap unless checking responsiveness briefly.", he: "אל תנערו בחוזקה או תסטו — רק בדיקת התעוררות קצרה." },
      { en: "Do not give food, drink, or pills.", he: "אל תיתנו אוכל, משקאות או כדורים." },
    ],
    callIf: [
      { en: "Not waking up, worsening breathing, or seizures.", he: "אין התעוררות, נשימה מתדרדרת או פרכוסים." },
      { en: "Suspected neck injury — keep head still if trained to do so.", he: "חשד לחבלת צוואר — שמרו על הראש יציב אם אתם מיומנים." },
    ],
  },
  bleeding: {
    doNow: [
      { en: "Apply firm, steady pressure directly on the wound with a clean cloth.", he: "לחצו ישירות על הפצע במרפד נקי בלחיצה יציבה." },
      { en: "Raise the injured part above heart level if possible.", he: "הרימו את האיבר מעל גובה הלב אם אפשר." },
      { en: "Keep pressure — add layers on top; do not peek too often.", he: "המשיכו בלחיצה — הוסיפו שכבות; אל תרימו לבדיקה לעתים קרובות." },
    ],
    dontDo: [
      { en: "Do not remove an object stuck deep in the wound.", he: "אל תסירו גוף זר עמוק בפצע." },
      { en: "Do not use a tourniquet unless severe limb bleeding and you know how.", he: "אל תשתמשו בחוסם עורקים אלא בדימום קיצוני בגפה ואתם יודעים איך." },
    ],
    callIf: [
      { en: "Blood spurts, soaking through bandages, or person feels faint.", he: "דימום מִיתז, רטיבות דרך מרפדים או סחרחורת." },
      { en: "Bleeding does not slow after 10 minutes of firm pressure.", he: "דימום לא מאט אחרי 10 דקות לחיצה נכונה." },
    ],
  },
  choking: {
    doNow: [
      { en: "If they cannot speak or breathe, act immediately.", he: "אם לא מדברים או נושמים — פעלו מיד." },
      { en: "Give 5 firm back blows between the shoulder blades.", he: "5 מכות גב חזקות בין השכמות." },
      { en: "Then 5 abdominal thrusts (Heimlich) for adults/children if trained.", he: "אז 5 דחיפות בטן (היימליך) למבוגרים/ילדים אם מיומנים." },
      { en: "If unconscious, start CPR.", he: "אם מאבדים הכרה — התחילו החייאה." },
    ],
    dontDo: [
      { en: "Do not put fingers in the mouth if you cannot see the object.", he: "אל תכניסו אצבעות לפה אם לא רואים את הגוף." },
      { en: "Do not give water or bread to “wash it down”.", he: "אל תיתנו מים או לחם \"להוריד\"." },
    ],
    callIf: [
      { en: "Silent cough, blue lips, or cannot breathe at all.", he: "שיעול שקט, שפתיים כחולות או אין נשימה." },
      { en: "Choking continues after your attempts.", he: "חנק ממשיך אחרי הניסיונות שלכם." },
    ],
  },
  burn: {
    doNow: [
      { en: "Cool the burn under cool running water 10–20 minutes.", he: "קררו כוויה במים פושרים זורמים 10–20 דקות." },
      { en: "Remove tight jewelry/clothing near the burn if not stuck.", he: "הסירו תכשיטים/בגדים צמודים אם לא דבוקים לכוויה." },
      { en: "Cover loosely with clean non-fluffy cloth.", he: "כסו ברפידות במרפד נקי לא סיבי." },
    ],
    dontDo: [
      { en: "Do not use ice or butter/oils on the burn.", he: "אל תשתמשו בקרח או חמאה/שמנים." },
      { en: "Do not pop blisters.", he: "אל תפוצו שלפוחיות." },
    ],
    callIf: [
      { en: "Burn on face, hands, genitals, or larger than your palm.", he: "כוויה בפנים, ידיים, איברי מין או גדולה מכף היד." },
      { en: "Electrical/chemical burn or smoke inhalation.", he: "כוויה חשמלית/כימית או שאיפת עשן." },
    ],
  },
  general: {
    doNow: [
      { en: "Stay with the person and keep them comfortable.", he: "הישארו ליד האדם ושמרו על נוחות." },
      { en: "Watch breathing and level of alertness; note changes for responders.", he: "עקבו אחרי נשימה והתרשמות; רשמו שינויים לצוות." },
      { en: "Keep them comfortable — sitting or lying as they prefer if safe.", he: "נוחות — ישיבה או שכיבה לפי בחירה ובטיחות." },
    ],
    dontDo: [
      { en: "Do not give anything to drink if they might need surgery soon.", he: "אל תיתנו לשתות אם ייתכן ניתוח בקרוב." },
      { en: "Do not move them if severe pain suggests spinal injury.", he: "אל תזיזו אם כאב חזק מרמז על חבלה בעמוד שדרה." },
    ],
    callIf: [
      { en: "Pain is severe, breathing worsens, or confusion increases.", he: "כאב חזק, נשימה מתדרדרת או בלבול גובר." },
      { en: "You feel unsafe at the scene.", he: "אתם מרגישים לא בטוחים במקום." },
    ],
  },
};
