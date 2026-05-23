const fs = require("fs");
const path = require("path");

const map = {
  '"#F8F9FA"': "tokens.color.bgPage",
  '"#FFFFFF"': "tokens.color.bgSurface",
  '"#003049"': "tokens.color.textPrimary",
  '"#6C757D"': "tokens.color.textMuted",
  '"#D62828"': "tokens.color.primary",
  '"#DC2626"': "tokens.color.danger",
  '"#E9ECEF"': "tokens.color.border",
  '"#FFF5F5"': "tokens.color.dangerBg",
  '"#212529"': "tokens.color.textPrimary",
  '"#ADB5BD"': "tokens.color.textFaint",
};

const roots = [
  "app/(tabs)/profile",
  "app/(tabs)/settings",
  "app/(tabs)/firstaid",
  "app/admin",
  "app/auth",
  "app/doctor",
  "app/ambulance",
  "app/profile",
];

function depthToTokensImport(file) {
  const rel = path.relative("app", file).split(path.sep);
  const up = rel.length;
  return "../".repeat(up) + "src/ui/tokens";
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".tsx")) patch(p);
  }
}

function patch(file) {
  let s = fs.readFileSync(file, "utf8");
  const hasLegacy = Object.keys(map).some((k) => s.includes(k));
  if (!hasLegacy) return;

  if (!s.includes("from \"../../src/ui/tokens\"") && !s.includes("tokens.color")) {
    const imp = `import { tokens } from "${depthToTokensImport(file)}";\n`;
    const idx = s.indexOf('from "react-native"');
    if (idx !== -1) {
      const end = s.indexOf(";", idx) + 1;
      s = s.slice(0, end) + "\n" + imp + s.slice(end);
    }
  }

  for (const [hex, tok] of Object.entries(map)) {
    s = s.split(hex).join(tok);
  }
  fs.writeFileSync(file, s);
  console.log("patched", file);
}

for (const r of roots) {
  if (fs.existsSync(r)) walk(r);
}
