/**
 * Expo dynamic config. Merges over the static values in `app.json` and
 * injects build-time env values into `expo.extra` so they are reachable at
 * runtime via `expo-constants` (`Constants.expoConfig.extra`).
 *
 * Pipeline:
 *   .env  →  process.env  →  app.config.js  →  expo.extra.openAiApiKey
 *         →  Constants.expoConfig.extra.openAiApiKey  →  OpenAI request
 *
 * `.env` is git-ignored (see .gitignore). Never commit real keys.
 *
 * For production builds via EAS, set the same variable as an EAS secret:
 *   eas secret:create --scope project --name OPENAI_API_KEY --value "sk-..."
 */

const path = require("path");

// IMPORTANT: `override: true`.
//
// By default dotenv refuses to overwrite any variable that already exists in
// process.env. On Windows / EAS / nested shells, a stale `OPENAI_API_KEY`
// (often a leftover placeholder like `sk-your-openai-key-here`) can be
// inherited from the parent shell or from a previous `expo start` session
// that baked the wrong value into Metro's cache. Without `override: true`,
// `.env` is silently ignored and that stale value wins.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({
    path: path.resolve(__dirname, ".env"),
    override: true,
  });
} catch {
  // dotenv missing — value must come from shell / EAS secret. Continue.
}

/**
 * Strings that must never be sent to OpenAI. Anything matching is treated as
 * "no key configured" so the AI button is hidden and the misconfiguration is
 * surfaced loudly in the Expo terminal instead of silently 401-ing.
 */
const PLACEHOLDER_PATTERNS = [
  /^sk-your-/i,
  /^your-openai-api-key-here$/i,
  /openai-key-here/i,
  /^sk-xxx/i,
  /^changeme/i,
];

function isPlaceholder(value) {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

module.exports = ({ config }) => {
  const rawKey =
    process.env.OPENAI_API_KEY ||
    process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
    "";

  // STEP 1 LOG — proves whether dotenv populated process.env at all.
  // We mask the value: never print a real secret to logs.
  const masked = rawKey ? `${rawKey.slice(0, 7)}…(len=${rawKey.length})` : "<empty>";
  // eslint-disable-next-line no-console
  console.log("[ENV DEBUG] OPENAI_API_KEY =", masked);

  const placeholder = isPlaceholder(rawKey);
  if (placeholder) {
    // eslint-disable-next-line no-console
    console.warn(
      "[app.config] OPENAI_API_KEY looks like a PLACEHOLDER:",
      masked,
      "→ ignoring. Edit .env with a real key (sk-…) and restart Expo with `npx expo start --clear`.",
    );
  }

  const openAiApiKey = placeholder ? "" : rawKey;

  // STEP 2 LOG — proves which value (if any) actually reaches expo.extra.
  // eslint-disable-next-line no-console
  console.log(
    "[CONFIG DEBUG] extra.openAiApiKey =",
    openAiApiKey ? `${openAiApiKey.slice(0, 7)}…(len=${openAiApiKey.length})` : "<empty>",
  );

  if (!openAiApiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "[app.config] No usable OPENAI_API_KEY. The AI Companion will be hidden until a real key is set in .env.",
    );
  }

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      openAiApiKey,
    },
  };
};
