import type { FirstAidGuide } from "./types";

export const firstAidGuides: FirstAidGuide[] = [
  {
    id: "bleeding_basic",
    category: "bleeding",
    title: { en: "How to stop bleeding", he: "איך לעצור דימום" },
    steps: [
      { en: "Apply firm, steady pressure directly on the wound.", he: "לחצו בלחיצה יציבה וישירה על הפצע." },
      { en: "Use a clean cloth or dressing; add layers if blood soaks through.", he: "השתמשו במרפד נקי; הוסיפו שכבות אם הדם חודר." },
      { en: "Raise the injured area above heart level if possible.", he: "הרימו את האזור מעל גובה הלב אם אפשר." },
      { en: "Keep helping hands on the wound until responders take over.", he: "המשיכו בלחיצה עד שהצוות מחליף." },
    ],
    warnings: [
      { en: "Do not remove an object stuck deep in the wound.", he: "אל תסירו גוף זר עמוק בפצע." },
      { en: "Do not use a tourniquet unless trained and bleeding is life-threatening.", he: "אל תשתמשו בחוסם עורקים אלא אם מיומנים והדימום מסכן חיים." },
    ],
  },
  {
    id: "bleeding_nose",
    category: "bleeding",
    title: { en: "Nosebleed (epistaxis)", he: "דימום מהאף" },
    steps: [
      { en: "Sit upright and lean slightly forward.", he: "ישבו זקופים ונטו קדימה מעט." },
      { en: "Pinch the soft part of the nose for 10–15 minutes without releasing.", he: "צבטו את החלק הרך של האף 10–15 דקות בלי לשחרר." },
      { en: "Breathe through the mouth; spit blood out instead of swallowing.", he: "נשמו מהפה; פלטו דם במקום לבלוע." },
    ],
    warnings: [
      { en: "Do not tilt the head back (blood may run to the throat).", he: "אל תטו את הראש אחורה (דם עלול לרדת לגרון)." },
      { en: "Seek urgent care if bleeding lasts over 20 minutes or is very heavy.", he: "פנו לחירום אם הדימום מעל 20 דקות או חזק מאוד." },
    ],
  },
  {
    id: "breathing_asthma",
    category: "breathing",
    title: { en: "Asthma / wheezing attack", he: "מתקפת אסטמה / צפצופים" },
    steps: [
      { en: "Help the person sit upright; loosen tight clothing.", he: "עזרו לישב זקוף; רופפו בגדים צמודים." },
      { en: "Use their reliever inhaler as prescribed (usually 1 puff, wait, repeat).", he: "השתמשו במשאף ההקלה לפי הוראות (לרוב פף, המתנה, חזרה)." },
      { en: "Stay calm; coach slow breathing if they can follow.", he: "הישארו רגועים; עזרו בנשימה איטית אם יכולים לעקוב." },
    ],
    warnings: [
      { en: "Do not leave them alone if breathing is getting worse.", he: "אל תשאירו לבד אם הנשימה מתדרדרת." },
      { en: "Do not delay emergency call if lips turn blue or they cannot speak.", he: "אל תדחו חירום אם שפתיים כחולות או לא מדברים." },
    ],
  },
  {
    id: "breathing_cpr_overview",
    category: "breathing",
    title: { en: "Adult not breathing — start CPR", he: "מבוגר לא נושם — התחלת החייאה" },
    steps: [
      { en: "Call emergency services or tell someone to call now.", he: "התקשרו לחירום או בקשו מאחר להתקשר." },
      { en: "Place hands on center of chest; push hard and fast (100–120/min).", he: "ידיים במרכז החזה; לחיצות חזקות ומהירות (100–120 לדקה)." },
      { en: "Use an AED as soon as it arrives; follow voice prompts.", he: "הפעילו דפיברילטור מיד כשמגיע; עקבו אחרי הקול." },
    ],
    warnings: [
      { en: "Do not stop compressions except for rescue breaths if trained, or when exhausted.", he: "אל תפסיקו לחיצות אלא לנשימות הצלה אם מיומנים, או כשמתישים." },
    ],
  },
  {
    id: "breathing_choking_conscious",
    category: "breathing",
    title: { en: "Choking — conscious adult", he: "חנק — מבוגר בהכרה" },
    steps: [
      { en: "Encourage strong coughing if they can cough effectively.", he: "עודדו שיעול חזק אם יכולים לשעול ביעילות." },
      { en: "Give 5 firm back blows between the shoulder blades.", he: "תנו 5 מכות גב חזקות בין השכמות." },
      { en: "If still blocked, give abdominal thrusts (Heimlich) if trained.", he: "אם עדיין חסום — דחיפות בטן (היימליך) אם מיומנים." },
    ],
    warnings: [
      { en: "Do not put fingers in the mouth if you cannot see the object.", he: "אל תכניסו אצבעות לפה אם לא רואים את הגוף." },
    ],
  },
  {
    id: "burns_cool",
    category: "burns",
    title: { en: "Cool a burn", he: "קירור כוויה" },
    steps: [
      { en: "Cool under cool running water for 10–20 minutes.", he: "קררו במים פושרים זורמים 10–20 דקות." },
      { en: "Remove jewelry or loose clothing near the burn if not stuck.", he: "הסירו תכשיטים או בגדים רופפים אם לא דבוקים." },
      { en: "Cover loosely with a clean non-fluffy cloth.", he: "כסו ברפידות במרפד נקי לא סיבי." },
    ],
    warnings: [
      { en: "Do not use ice or butter/oils on the burn.", he: "אל תשתמשו בקרח או חמאה/שמנים." },
      { en: "Do not pop blisters.", he: "אל תפוצו שלפוחיות." },
    ],
  },
  {
    id: "burns_chemical",
    category: "burns",
    title: { en: "Chemical splash", he: "התזת חומר" },
    steps: [
      { en: "Brush off dry powder first if present; avoid spreading.", he: "גרדו אבקה יבשה קודם; הימנעו מהתפשטות." },
      { en: "Flush skin or eye with lots of clean water for many minutes.", he: "שטפו עור או עין במים נקיים זמן רב." },
      { en: "Remove contaminated clothing while flushing when safe.", he: "הסירו בגדים מזוהמים תוך שטיפה כשבטוח." },
    ],
    warnings: [
      { en: "Do not neutralize with vinegar/baking soda unless poison control says so.", he: "אל תנטרלו בחומץ/סודה אלא אם מוקד רעלים אומר." },
      { en: "Call emergency services for eye involvement or large area.", he: "חירום אם מעורבת העין או שטח גדול." },
    ],
  },
  {
    id: "injuries_sprain",
    category: "injuries",
    title: { en: "Sprain (RICE)", he: "נקע (RICE)" },
    steps: [
      { en: "Rest the limb; avoid putting weight on it.", he: "מנוחה לגפה; הימנעו מעומס." },
      { en: "Ice 15–20 minutes every few hours for the first day (cloth barrier).", he: "קרח 15–20 דקות כמה פעמים ביום הראשון (בד בין)." },
      { en: "Compression bandage snug, not numb/tingly.", he: "חבישת לחץ הדוקה אך לא נימול/עקצוץ." },
      { en: "Elevate above heart level when possible.", he: "הרמה מעל גובה הלב כשאפשר." },
    ],
    warnings: [
      { en: "Do not ignore deformity or inability to move — could be a fracture.", he: "אל תתעלמו מעיוות או חוסר תנועה — עלול שבר." },
    ],
  },
  {
    id: "injuries_fracture_suspect",
    category: "injuries",
    title: { en: "Suspected broken bone", he: "חשד לשבר" },
    steps: [
      { en: "Support the limb in the position found; pad around it.", he: "תמכו בגפה במצב שנמצאה; רפדו סביב." },
      { en: "Immobilize joint above and below if you can do it safely.", he: "ניידו מפרק מעל ומתחת אם בטוח." },
      { en: "Apply cold packs outside clothing for pain/swelling.", he: "קרח מחוץ לבגד לכאב/נפיחות." },
    ],
    warnings: [
      { en: "Do not try to realign the bone yourself.", he: "אל תנסו להחזיר את העצם למקום." },
      { en: "Do not remove a protruding bone; cover and stabilize.", he: "אל תסירו עצם בולטת; כסו וייצבו." },
    ],
  },
  {
    id: "injuries_head_mild",
    category: "injuries",
    title: { en: "Minor head bump (watch at home)", he: "חבלת ראש קלה (מעקב בבית)" },
    steps: [
      { en: "Sit and rest; apply cold pack wrapped in cloth for swelling.", he: "ישיבה ומנוחה; קרח עטוף בבד לנפיחות." },
      { en: "Wake for checks if advised for sleep; watch for vomiting or confusion.", he: "השכמה לבדיקות אם הומלץ; עקבו אחר הקאה או בלבול." },
    ],
    warnings: [
      { en: "Do not ignore worsening headache, repeated vomiting, or unequal pupils.", he: "אל תתעלמו מכאב ראש מתגבר, הקאות חוזרות או אישונים לא שווים." },
    ],
  },
  {
    id: "heart_attack",
    category: "cardiac",
    title: { en: "Heart attack (chest pain)", he: "התקף לב (כאב חזה)" },
    steps: [
      { en: "Call emergency services immediately.", he: "התקשרו מיד לחירום." },
      { en: "Keep the person calm and seated or semi-reclined.", he: "השאירו רגועים — ישיבה או שכיבה חצי." },
      { en: "Loosen tight clothing; offer prescribed nitroglycerin only if directed.", he: "רופפו בגדים צמודים; ניטרוגליצרין רק לפי הוראה." },
      { en: "If unconscious and not breathing, start CPR and use AED if available.", he: "אם אין הכרה ואין נשימה — החייאה ודפיברילטור אם יש." },
    ],
    warnings: [
      { en: "Do not leave the person alone.", he: "אל תשאירו את האדם לבד." },
      { en: "Do not drive them to hospital yourself if symptoms are severe — wait for ambulance.", he: "אל תיסעו לבית חולים בעצמכם אם חמור — המתינו לאמבולנס." },
    ],
  },
  {
    id: "stroke_fast",
    category: "cardiac",
    title: { en: "Stroke — think FAST", he: "שבץ — FAST" },
    steps: [
      { en: "Face drooping, Arm weakness, Speech trouble = call emergency now.", he: "נפילת פנים, חולשת זרוע, דיבור לקוי = חירום מיד." },
      { en: "Note the time symptoms started; tell dispatch.", he: "רשמו שעת התחלה; דווחו לשליטה." },
      { en: "Keep airway clear; side-lying if vomiting.", he: "שמירה על נתיב אוויר; על צד אם מקיאים." },
    ],
    warnings: [
      { en: "Do not give food, drink, or aspirin unless instructed by professionals.", he: "אל תיתנו אוכל, משקה או אספירין אלא אם מקצועי אומר." },
    ],
  },
  {
    id: "seizure",
    category: "seizures",
    title: { en: "Seizure (convulsion)", he: "התקף (פרכוס)" },
    steps: [
      { en: "Protect the head with something soft; move hazards away.", he: "הגנו על הראש ברך רכה; הרחיקו מפגעים." },
      { en: "Time the seizure; loosen tight clothing around neck.", he: "מדדו זמן; רופפו צוואר." },
      { en: "After it stops, roll onto the side (recovery position) if breathing.", he: "אחרי שעוצר — על צד אם נושמים." },
    ],
    warnings: [
      { en: "Do not hold the person down or put anything in the mouth.", he: "אל תחזיקו בכוח ואל תכניסו דבר לפה." },
      { en: "Call emergency if longer than 5 minutes, repeated seizures, or pregnancy.", he: "חירום אם מעל 5 דקות, התקפים חוזרים, או הריון." },
    ],
  },
  {
    id: "febrile_seizure_child",
    category: "seizures",
    title: { en: "Febrile seizure (child)", he: "התקף חום (ילד)" },
    steps: [
      { en: "Protect from injury; do not restrain.", he: "הגנה מפציעה; בלי כוח." },
      { en: "After seizure, cool the room; remove excess clothing.", he: "אחרי ההתקף — קירור החדר; הסרת בגדים עודפים." },
      { en: "Seek medical advice the same day for first episode or if worried.", he: "ייעוץ רפואי באותו יום להתקף ראשון או חשש." },
    ],
    warnings: [
      { en: "Do not put objects in the mouth.", he: "אל תכניסו חפצים לפה." },
    ],
  },
  {
    id: "drowning",
    category: "drowning",
    title: { en: "Drowning rescue", he: "חילוץ מטביעה" },
    steps: [
      { en: "Remove from water safely — reach, throw, row; do not become a second victim.", he: "הוצאה בטוחה — יד, זריקה, סירה; אל תהפכו לקורבן שני." },
      { en: "Check breathing and responsiveness immediately.", he: "בדקו נשימה והתעוררות מיד." },
      { en: "If not breathing, start CPR; continue until help arrives.", he: "אם אין נשימה — החייאה; המשיכו עד עזרה." },
    ],
    warnings: [
      { en: "Do not delay CPR if not breathing.", he: "אל תתעכבו עם החייאה אם אין נשימה." },
      { en: "Even if they cough up water, they still need medical evaluation.", he: "גם אם משעלים מים — הערכה רפואית נדרשת." },
    ],
  },
  {
    id: "drowning_hypothermia",
    category: "drowning",
    title: { en: "Cold water exposure", he: "חשיפה למים קרים" },
    steps: [
      { en: "Remove wet clothes; dry and wrap in blankets.", he: "הסרת בגדים רטובים; ייבוש ועטיפה." },
      { en: "Warm gradually; offer warm drinks if fully conscious.", he: "חימום הדרגתי; משקה חם אם בהכרה מלאה." },
    ],
    warnings: [
      { en: "Do not rub limbs vigorously or use hot bath for severe cold.", he: "אל תשפשפו גפות בחוזקה או אמביה חמה בקור חמור." },
    ],
  },
  {
    id: "poisoning_swallow",
    category: "poisoning",
    title: { en: "Swallowed poison", he: "בליעת רעל" },
    steps: [
      { en: "Call poison control or emergency services with the product container.", he: "התקשרו לרעלים או חירום עם האריזה." },
      { en: "Keep the person still and breathing; note amount and time.", he: "שקט ונשימה; כמות וזמן." },
    ],
    warnings: [
      { en: "Do not induce vomiting unless instructed by professionals.", he: "אל תגרמו להקאה אלא אם מקצועי אומר." },
      { en: "Do not give milk or charcoal unless advised — depends on substance.", he: "אל תיתנו חלב או פחם אלא אם ייעוץ — תלוי בחומר." },
    ],
  },
  {
    id: "poisoning_fumes",
    category: "poisoning",
    title: { en: "Inhaled fumes / gas", he: "שאיפת גזים" },
    steps: [
      { en: "Move to fresh air immediately; call emergency if breathless.", he: "לאוויר צח מיד; חירום אם קוצר נשימה." },
      { en: "Loosen clothing; monitor breathing.", he: "רופפו בגדים; עקבו אחרי נשימה." },
    ],
    warnings: [
      { en: "Do not re-enter a dangerous area without protective equipment.", he: "אל תיכנסו לאזור מסוכן בלי ציוד." },
    ],
  },
  {
    id: "heatstroke",
    category: "heatstroke",
    title: { en: "Heat stroke / severe heat illness", he: "כתת חום / מחלת חום חמורה" },
    steps: [
      { en: "Call emergency services — heat stroke is an emergency.", he: "חירום — כתת חום היא מצב חירום." },
      { en: "Move to a cool place; remove excess clothing.", he: "העברה למקום קריר; הסרת בגדים." },
      { en: "Cool the body with tepid water and fanning; ice packs at neck/armpits if available.", he: "קירור בפושר ומניפה; קרח צוואר/בית שחי אם יש." },
    ],
    warnings: [
      { en: "Do not give oral fluids if confused or drowsy (choking risk).", he: "אל תיתנו לשתות אם מבולבל או ישנוני (סיכון לחנק)." },
    ],
  },
  {
    id: "heat_exhaustion",
    category: "heatstroke",
    title: { en: "Heat exhaustion", he: "תשישות חום" },
    steps: [
      { en: "Rest in shade; sip cool water if alert and not vomiting.", he: "מנוחה בצל; שתייה אם ער ולא מקיא." },
      { en: "Cool with wet cloths on skin.", he: "קרירות במגבת רטובה." },
    ],
    warnings: [
      { en: "Escalate to emergency if confusion, fainting, or hot dry skin.", he: "חירום אם בלבול, התעלפות, או עור חם ויבש." },
    ],
  },
  {
    id: "allergic_anaphylaxis",
    category: "allergic",
    title: { en: "Severe allergic reaction", he: "תגובה אלרגית חמורה" },
    steps: [
      { en: "Use epinephrine auto-injector in outer thigh through clothing if trained.", he: "אפיפן בירך חיצונית דרך בגד אם מיומנים." },
      { en: "Call emergency services immediately after using epinephrine.", he: "חירום מיד אחרי אפיפן." },
      { en: "Lay flat with legs raised unless breathing is easier sitting.", he: "שכיבה עם הרמת רגליים אלא אם נוח יותר לישיבה." },
    ],
    warnings: [
      { en: "Do not wait to see if it gets better — anaphylaxis can worsen fast.", he: "אל תחכו שיעבור — אנפילקסיס עלול להחמיר מהר." },
    ],
  },
  {
    id: "allergic_mild_hives",
    category: "allergic",
    title: { en: "Mild hives / itching", he: "פריחה קלה / גרד" },
    steps: [
      { en: "Remove suspected trigger if obvious (food, sting, medication).", he: "הסרת גורם אם ברור (מזון, עקיצה, תרופה)." },
      { en: "Cool compress; watch breathing and swelling of lips/tongue.", he: "דחוס קר; עקבו אחרי נשימה ונפיחות שפתיים/לשון." },
    ],
    warnings: [
      { en: "Seek emergency care if breathing difficulty or facial swelling.", he: "חירום אם קוצר נשימה או נפיחות פנים." },
    ],
  },
];

export function guidesInCategory(categoryId: string): FirstAidGuide[] {
  return firstAidGuides.filter((g) => g.category === categoryId);
}

export function getGuideById(id: string): FirstAidGuide | undefined {
  return firstAidGuides.find((g) => g.id === id);
}
