const fs = require("fs");
const file = "app/admin/panel.tsx";
let s = fs.readFileSync(file, "utf8");

const reps = [
  [/import { theme } from "\.\.\/\.\.\/src\/ui\/theme";\n\n/, ""],
  [/import { tokens } from "\.\.\/\.\.\/src\/ui\/tokens";/, 'import { cardShadow, tokens } from "../../src/ui/tokens";'],
  [/theme\.colors\.bgPage/g, "tokens.color.bgPage"],
  [/theme\.colors\.bg\b/g, "tokens.color.bgPage"],
  [/theme\.colors\.surface/g, "tokens.color.bgSurface"],
  [/theme\.colors\.text\b/g, "tokens.color.textPrimary"],
  [/theme\.colors\.textMuted/g, "tokens.color.textMuted"],
  [/theme\.colors\.border/g, "tokens.color.border"],
  [/theme\.colors\.primary/g, "tokens.color.primary"],
  [/theme\.spacing\.(\w+)/g, "tokens.space.$1"],
  [/theme\.radius\.(\w+)/g, "tokens.radius.$1"],
  [/\.\.\.theme\.shadow\.card/g, "...cardShadow"],
  [/\.\.\.theme\.shadow\.primary/g, ""],
  [/\.\.\.theme\.typography\.h2,\n\s*color: tokens\.color\.textPrimary,/g, "fontSize: tokens.font.h2,\n    fontWeight: tokens.fontWeight.heavy,\n    color: tokens.color.textPrimary,"],
  [/"#ECFDF5"/g, "tokens.color.successBg"],
  [/"#FEF2F2"/g, "tokens.color.dangerBg"],
  [/"#FFFBEB"/g, "tokens.color.warningBg"],
  [/"#166534"/g, "tokens.color.successText"],
  [/"#B91C1C"/g, "tokens.color.dangerDark"],
  [/"#16A34A"/g, "tokens.color.success"],
  [/"#FCA5A5"/g, "tokens.color.dangerBorder"],
  [/📞 /g, ""],
  [/<Text style={styles\.emptyIcon}>👥<\/Text>\n\s*/, ""],
];

for (const [a, b] of reps) s = s.replace(a, b);
fs.writeFileSync(file, s);
console.log("admin panel migrated");
