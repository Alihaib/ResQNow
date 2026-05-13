/**
 * OpenAI-powered emergency triage service.
 *
 * EXPORTS
 * - `analyzeEmergencyTriage(context, history?)` — structured triage decision
 *   that classifies the situation, suggests one next action, and optionally
 *   recommends an existing first-aid guide. THIS IS THE PRIMARY ENTRY POINT
 *   used by the in-emergency UI.
 * - `getEmergencyHelp(context, history?)` — legacy one-step-at-a-time text
 *   helper. Kept for any caller that still needs free-form guidance; the
 *   triage flow does not depend on it.
 *
 * The OpenAI API key is read at runtime from `expo-constants`
 * (`expoConfig.extra.openAiApiKey`), populated by `app.config.js` from
 * `process.env.OPENAI_API_KEY`. See `.env.example`.
 *
 * NOTE: This service is intentionally decoupled from dispatch / Firestore
 * lifecycle / GPS / chat / role management. Failures here MUST NOT block
 * the SOS flow.
 */

import Constants from "expo-constants";
import { getGuideById } from "../firstAid/guides";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL_PRIMARY = "gpt-4.1-mini";
const OPENAI_MODEL_FALLBACK = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 20_000;

const DEBUG_TAG = "[OpenAI Emergency]";

/* -------------------------------------------------------------------------- */
/*                              Public types                                  */
/* -------------------------------------------------------------------------- */

/** Message format accepted by the service (subset of OpenAI's). */
export type EmergencyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Triage categories supported by the AI decision layer. */
export const TRIAGE_CATEGORIES = [
  "cpr", // not breathing / unconscious — start CPR
  "choking",
  "bleeding",
  "burn",
  "seizure",
  "chest_pain",
  "breathing", // breathing difficulty (asthma / wheeze / etc.)
  "allergic",
  "fainting",
  "other",
] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

export type TriageUrgency = "call_now" | "follow_guide" | "ask_more";
export type TriageConfidence = "low" | "medium" | "high";

/** Structured triage decision returned to the UI. */
export type TriageResult = {
  category: TriageCategory;
  confidence: TriageConfidence;
  /** Single short next action shown to the bystander. */
  nextAction: string;
  /** Optional single yes/no question to refine the recommendation. */
  askQuestion?: string;
  /** Optional whitelisted guide id from `src/firstAid/guides.ts`. */
  suggestedGuideId?: string;
  urgency: TriageUrgency;
  /** Short summary for medical team (no diagnosis, observed signs only). */
  summary: string;
  /** True if AI requested follow-up (urgency === "ask_more"). */
  needsMoreInfo: boolean;
};

/** Custom error so the UI can show friendly, localized messages. */
export class OpenAiEmergencyError extends Error {
  code:
    | "missing_key"
    | "invalid_key"
    | "insufficient_quota"
    | "bad_request"
    | "network"
    | "timeout"
    | "rate_limited"
    | "server"
    | "empty"
    | "bad_json"
    | "unknown";
  status?: number;
  /** OpenAI `error.message` or raw body snippet (safe for logs / __DEV__ UI). */
  apiDetail?: string;

  constructor(
    code: OpenAiEmergencyError["code"],
    message: string,
    status?: number,
    apiDetail?: string,
  ) {
    super(message);
    this.name = "OpenAiEmergencyError";
    this.code = code;
    this.status = status;
    this.apiDetail = apiDetail;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Key + config plumbing                           */
/* -------------------------------------------------------------------------- */

function debugLog(message: string, data?: Record<string, unknown>) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    if (data) {
      console.log(DEBUG_TAG, message, data);
    } else {
      console.log(DEBUG_TAG, message);
    }
  }
}

/** Strings that must NEVER be sent to OpenAI (template / doc placeholders). */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^sk-your-/i,
  /^your-openai-api-key-here$/i,
  /openai-key-here/i,
  /^sk-xxx/i,
  /^changeme/i,
];

function isPlaceholderKey(value: string): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

function readOpenAiKeyFromConstants(): string {
  const tryExtra = (extra: unknown): string => {
    if (!extra || typeof extra !== "object") return "";
    const v = (extra as Record<string, unknown>).openAiApiKey;
    return typeof v === "string" ? v.trim() : "";
  };

  const fromExpoConfig = tryExtra(Constants.expoConfig?.extra);
  if (fromExpoConfig) return fromExpoConfig;

  const manifest = Constants.manifest as Record<string, unknown> | null;
  if (manifest?.extra) {
    const k = tryExtra(manifest.extra);
    if (k) return k;
  }

  const m2 = Constants.manifest2 as Record<string, unknown> | null | undefined;
  const m2Extra = m2?.extra as Record<string, unknown> | undefined;
  const expoClientConfig = m2Extra?.expoClient as Record<string, unknown> | undefined;
  const fromM2 = tryExtra(expoClientConfig?.extra);
  if (fromM2) return fromM2;

  return "";
}

function readApiKey(): string {
  const raw = readOpenAiKeyFromConstants();
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const masked = raw ? `${raw.slice(0, 7)}…(len=${raw.length})` : "<empty>";
    // eslint-disable-next-line no-console
    console.log("[RUNTIME DEBUG] key =", masked);
  }
  if (isPlaceholderKey(raw)) return "";
  return raw;
}

/** True iff a real (non-placeholder) key is configured. */
export function isOpenAiConfigured(): boolean {
  return readApiKey().length > 0;
}

/* -------------------------------------------------------------------------- */
/*                           Shared HTTP infrastructure                       */
/* -------------------------------------------------------------------------- */

function classifyOpenAiHttpError(
  status: number,
  openAiMessage: string,
  rawBodySnippet: string,
): OpenAiEmergencyError {
  const detail = openAiMessage || rawBodySnippet.slice(0, 280);
  if (status === 401) return new OpenAiEmergencyError("invalid_key", "Invalid OpenAI API key.", 401, detail);
  if (status === 402 || status === 403) {
    return new OpenAiEmergencyError(
      "insufficient_quota",
      "OpenAI billing / access issue.",
      status,
      detail,
    );
  }
  if (status === 400) {
    return new OpenAiEmergencyError(
      "bad_request",
      "OpenAI rejected the request.",
      400,
      detail,
    );
  }
  if (status === 429) {
    return new OpenAiEmergencyError(
      "rate_limited",
      detail || "AI service is busy.",
      429,
      detail,
    );
  }
  if (status >= 500) {
    return new OpenAiEmergencyError(
      "server",
      detail || `AI service error (${status}).`,
      status,
      detail,
    );
  }
  return new OpenAiEmergencyError(
    "unknown",
    detail || `AI request failed (${status}).`,
    status,
    detail,
  );
}

type ChatCallOptions = {
  /** Force JSON-only output. */
  jsonOnly?: boolean;
  /** Cap on response tokens. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
};

/**
 * Single shared OpenAI chat call. Handles auth, timeout, model fallback, and
 * error classification. Returns the assistant's raw text content.
 */
async function callOpenAi(
  systemPrompt: string,
  history: EmergencyChatMessage[] | undefined,
  userMessage: string,
  opts: ChatCallOptions = {},
): Promise<string> {
  const apiKey = readApiKey();
  debugLog("API key diagnostics", {
    OPENAI_KEY_LOADED: apiKey.length > 0 ? "yes" : "no",
    keyLength: apiKey.length,
    expoConfigPresent: Constants.expoConfig != null,
  });
  if (!apiKey) {
    throw new OpenAiEmergencyError(
      "missing_key",
      "OPENAI_API_KEY is not configured. Edit .env and restart Expo with `npx expo start --clear`.",
    );
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const baseBody: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 240,
  };
  if (opts.jsonOnly) {
    baseBody.response_format = { type: "json_object" };
  }

  const tryWithModel = async (model: string, signal: AbortSignal) => {
    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, ...baseBody }),
        signal,
      });
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        throw new OpenAiEmergencyError("timeout", "AI request timed out.");
      }
      debugLog("fetch threw (network layer)", {
        name: e?.name,
        message: e?.message,
      });
      throw new OpenAiEmergencyError(
        "network",
        e?.message || "Network error contacting AI service.",
      );
    }

    const rawText = await response.text();
    let parsed: {
      error?: { message?: string; type?: string; code?: string };
      choices?: { message?: { content?: unknown } }[];
    } = {};
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      const apiMsg = parsed?.error?.message ?? "";
      debugLog("OpenAI HTTP error", {
        status: response.status,
        model,
        openAiType: parsed?.error?.type ?? "",
        openAiCode: parsed?.error?.code ?? "",
        openAiMessage: apiMsg,
        rawBodyPreview: rawText.slice(0, 600),
      });
      throw classifyOpenAiHttpError(response.status, apiMsg, rawText);
    }

    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      debugLog("Empty / non-string assistant content", {
        model,
        rawBodyPreview: rawText.slice(0, 600),
      });
      throw new OpenAiEmergencyError(
        "empty",
        "AI returned an empty response.",
        response.status,
        rawText.slice(0, 200),
      );
    }
    return content.trim();
  };

  let controller = new AbortController();
  let timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    try {
      return await tryWithModel(OPENAI_MODEL_PRIMARY, controller.signal);
    } catch (first: unknown) {
      const modelRelated =
        first instanceof OpenAiEmergencyError &&
        first.code === "bad_request" &&
        /model/i.test(first.apiDetail || first.message || "");
      if (modelRelated) {
        clearTimeout(timeoutId);
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
        debugLog("Retrying with fallback model", {
          primary: OPENAI_MODEL_PRIMARY,
          fallback: OPENAI_MODEL_FALLBACK,
        });
        return await tryWithModel(OPENAI_MODEL_FALLBACK, controller.signal);
      }
      throw first;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/* -------------------------------------------------------------------------- */
/*                          Triage assistant (primary)                        */
/* -------------------------------------------------------------------------- */

/**
 * Whitelist of guide ids the AI is allowed to suggest. Mirrors `firstAidGuides`
 * in `src/firstAid/guides.ts`. Anything outside this list is silently dropped
 * so the UI never tries to navigate to a non-existent route.
 */
const ALLOWED_GUIDE_IDS: ReadonlyArray<string> = [
  "breathing_cpr_overview",
  "breathing_choking_conscious",
  "breathing_asthma",
  "bleeding_basic",
  "bleeding_nose",
  "burns_cool",
  "burns_chemical",
  "heart_attack",
  "stroke_fast",
  "seizure",
  "febrile_seizure_child",
  "allergic_anaphylaxis",
  "allergic_mild_hives",
  "poisoning_swallow",
  "poisoning_fumes",
  "drowning",
  "drowning_hypothermia",
  "heatstroke",
  "heat_exhaustion",
  "injuries_sprain",
  "injuries_fracture_suspect",
  "injuries_head_mild",
];

/**
 * Default guide id for each triage category. Used as a soft fallback when
 * the AI omits `suggestedGuideId`. Categories without a single obvious
 * default (e.g. `fainting`, `other`) intentionally map to `null`.
 */
export const TRIAGE_CATEGORY_DEFAULT_GUIDE: Record<TriageCategory, string | null> = {
  cpr: "breathing_cpr_overview",
  choking: "breathing_choking_conscious",
  bleeding: "bleeding_basic",
  burn: "burns_cool",
  seizure: "seizure",
  chest_pain: "heart_attack",
  breathing: "breathing_asthma",
  allergic: "allergic_anaphylaxis",
  fainting: null,
  other: null,
};

/**
 * Strict system prompt. Output MUST be a single JSON object — the
 * `response_format: { type: "json_object" }` parameter enforces this at the
 * model level, and `parseTriageJson` enforces it again at parse time.
 */
const TRIAGE_SYSTEM_PROMPT = `
You are the Emergency Triage Assistant inside the ResQNow first-aid app.
An ambulance is already on the way. Your only job is to help the bystander
choose the right first-aid guide and the single next action while waiting.

OUTPUT FORMAT — CRITICAL
Return ONLY ONE JSON object, nothing else. Keys (all required):
{
  "category": one of [cpr, choking, bleeding, burn, seizure, chest_pain, breathing, allergic, fainting, other],
  "confidence": one of [low, medium, high],
  "nextAction": short imperative sentence, <= 24 words, calm second-person tone,
  "askQuestion": ONE short yes/no question, <= 18 words, or empty string,
  "suggestedGuideId": one of the supported guide IDs below, or empty string,
  "urgency": one of [call_now, follow_guide, ask_more],
  "summary": <= 30 words, observed signs only, no diagnosis, no jargon
}

SAFETY RULES — NEVER BREAK
- One question at a time. Never combine questions.
- Never diagnose. Never name medical conditions.
- Never give long explanations or theory.
- Never use emojis.
- Never use medical jargon.
- Never claim false certainty — set confidence honestly.
- For severe situations (not breathing, unresponsive, severe chest pain,
  heavy uncontrolled bleeding, severe allergic reaction, stroke signs,
  drowning, severe burn, seizure > 5 min, or anything unclear and
  potentially life-threatening): set "urgency": "call_now".
- For mild / clear situations with a matching guide: "urgency": "follow_guide".
- If you need one more answer to decide: "urgency": "ask_more" and provide
  a yes/no question in askQuestion.
- Reply in the user's language (English or Hebrew). All string values must
  use that language.

SUPPORTED GUIDE IDs (use exactly):
- breathing_cpr_overview          (adult not breathing — start CPR)
- breathing_choking_conscious     (conscious adult choking)
- breathing_asthma                (asthma / wheezing)
- bleeding_basic                  (heavy bleeding)
- bleeding_nose                   (nosebleed)
- burns_cool                      (thermal burn)
- burns_chemical                  (chemical splash)
- heart_attack                    (chest pain / suspected heart attack)
- stroke_fast                     (FAST signs / suspected stroke)
- seizure                         (adult seizure)
- febrile_seizure_child           (child febrile seizure)
- allergic_anaphylaxis            (severe allergic reaction)
- allergic_mild_hives             (mild hives / itching)
- poisoning_swallow               (swallowed poison)
- poisoning_fumes                 (inhaled fumes / gas)
- drowning                        (drowning rescue)
- drowning_hypothermia            (cold water exposure)
- heatstroke                      (severe heat illness)
- heat_exhaustion                 (heat exhaustion)
- injuries_sprain                 (sprain)
- injuries_fracture_suspect       (suspected fracture)
- injuries_head_mild              (minor head bump)

TYPICAL CATEGORY → GUIDE
cpr → breathing_cpr_overview
choking → breathing_choking_conscious
bleeding → bleeding_basic OR bleeding_nose
burn → burns_cool OR burns_chemical
seizure → seizure OR febrile_seizure_child
chest_pain → heart_attack
breathing → breathing_asthma (use breathing_cpr_overview if NOT breathing)
allergic → allergic_anaphylaxis OR allergic_mild_hives
fainting → "" (no single guide)
other → ""

Output JSON only. No prose, no markdown, no code fences.
`.trim();

function clampString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asCategory(v: unknown): TriageCategory {
  if (typeof v !== "string") return "other";
  const norm = v.trim().toLowerCase().replace(/[\s-]+/g, "_") as TriageCategory;
  return (TRIAGE_CATEGORIES as ReadonlyArray<string>).includes(norm)
    ? (norm as TriageCategory)
    : "other";
}

function asConfidence(v: unknown): TriageConfidence {
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

function asUrgency(v: unknown): TriageUrgency {
  if (v === "call_now" || v === "follow_guide" || v === "ask_more") return v;
  return "follow_guide";
}

function asGuideId(v: unknown, category: TriageCategory): string | undefined {
  const raw = typeof v === "string" ? v.trim() : "";
  if (raw && ALLOWED_GUIDE_IDS.includes(raw) && getGuideById(raw)) {
    return raw;
  }
  // Soft fallback to the category's default guide.
  const fallback = TRIAGE_CATEGORY_DEFAULT_GUIDE[category];
  if (fallback && ALLOWED_GUIDE_IDS.includes(fallback) && getGuideById(fallback)) {
    return fallback;
  }
  return undefined;
}

/**
 * Defensive JSON parser. The model is instructed (and forced via
 * `response_format`) to return JSON, but real-world responses sometimes wrap
 * the object in markdown fences or prose, so we extract the outermost JSON
 * block heuristically.
 */
function parseTriageJson(raw: string): Record<string, unknown> {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const slice = stripped.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(slice) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  throw new OpenAiEmergencyError(
    "bad_json",
    "AI did not return valid JSON.",
    undefined,
    raw.slice(0, 200),
  );
}

/**
 * Run a structured triage analysis.
 *
 * @param context Free-form description of the current emergency. Required.
 * @param history Optional prior turns. The UI typically passes the previous
 *                AI question + the bystander's yes/no answer here so the
 *                triage decision can converge.
 */
export async function analyzeEmergencyTriage(
  context: string,
  history?: EmergencyChatMessage[],
): Promise<TriageResult> {
  const trimmed = (context ?? "").trim();
  if (!trimmed) {
    throw new OpenAiEmergencyError(
      "unknown",
      "Empty context — provide a situation description.",
    );
  }

  const raw = await callOpenAi(TRIAGE_SYSTEM_PROMPT, history, trimmed, {
    jsonOnly: true,
    temperature: 0.1,
    maxTokens: 300,
  });

  const obj = parseTriageJson(raw);
  const category = asCategory(obj.category);
  const urgency = asUrgency(obj.urgency);
  const result: TriageResult = {
    category,
    confidence: asConfidence(obj.confidence),
    nextAction:
      clampString(obj.nextAction, 240) ||
      "Stay calm. Keep them safe and wait for the ambulance.",
    askQuestion: clampString(obj.askQuestion, 180) || undefined,
    suggestedGuideId: asGuideId(obj.suggestedGuideId, category),
    urgency,
    summary: clampString(obj.summary, 280) || "Bystander reported an emergency.",
    needsMoreInfo: urgency === "ask_more",
  };

  // Hard safety: if AI says ask_more but didn't provide a question, downgrade
  // to follow_guide so the UI doesn't get stuck.
  if (result.urgency === "ask_more" && !result.askQuestion) {
    result.urgency = "follow_guide";
    result.needsMoreInfo = false;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                Legacy free-form helper (kept for compatibility)            */
/* -------------------------------------------------------------------------- */

const LEGACY_SYSTEM_PROMPT = `
You are the First Aid Companion inside the ResQNow emergency app. An ambulance
is already on the way. Reply with ONLY ONE short step at a time, <= 35 words,
calm second-person tone, no diagnosis, no jargon, no emojis. If you need info,
ask ONE simple yes/no question. Reply in the user's language (English or Hebrew).
`.trim();

/**
 * Free-form one-step-at-a-time helper. Triage UI does NOT use this. Kept so
 * any future caller (or tests) can still pull short text guidance.
 */
export async function getEmergencyHelp(
  context: string,
  history?: EmergencyChatMessage[],
): Promise<string> {
  const trimmed = (context ?? "").trim();
  if (!trimmed) {
    throw new OpenAiEmergencyError(
      "unknown",
      "Empty context — provide a situation description.",
    );
  }
  return callOpenAi(LEGACY_SYSTEM_PROMPT, history, trimmed, {
    temperature: 0.2,
    maxTokens: 120,
  });
}
