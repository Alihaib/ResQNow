/**
 * AI Emergency Triage Assistant — modal sheet.
 *
 * Behaviour:
 *  - Calls `analyzeEmergencyTriage()` with the current emergency context.
 *  - Renders a structured triage card: category, next action, optional yes/no
 *    question and an optional "open guide" button.
 *  - When the AI marks urgency = "call_now" the UI shows a reassurance card
 *    only — the SOS flow has already dispatched the ambulance, so this
 *    component never offers phone-dial actions or external calls.
 *  - If OpenAI is unavailable or fails, falls back to the built-in first-aid
 *    library (router push to `/(tabs)/firstaid`).
 *
 * This component is intentionally decoupled from SOS dispatch, Firestore
 * lifecycle, GPS, chat and role management — it only reads the parent's
 * emergency context string and asks the AI for a routing decision.
 */

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AiOrb,
  GlassSurface,
  VoiceWaveform,
} from "./ai-emergency";
import { AI_RADIUS, aiEmergencyTheme } from "./ai-emergency/theme";
import { tokens } from "../src/ui/tokens";
import { useUiDirection } from "./ui/layout";

import { firstAidCategories } from "../src/firstAid/categories";
import { getGuideById } from "../src/firstAid/guides";
import { pick, type Lang } from "../src/firstAid/types";
import {
  EmergencyChatMessage,
  OpenAiEmergencyError,
  TriageCategory,
  TriageResult,
  analyzeEmergencyTriage,
} from "../src/services/openaiEmergency";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Short description of the active emergency (built by the parent screen). */
  context: string;
  /** App language ("en" / "he"). Used to render localized category labels. */
  lang: Lang;
  /** i18n function — re-uses the app's LanguageContext. */
  translate: (key: string, fallback?: string) => string;
  /** Called when the user taps "Open the recommended guide". */
  onOpenGuide: (guideId: string) => void;
  /**
   * Called when the user taps "Open the first-aid library" (fallback /
   * "other" category / AI unavailable).
   */
  onOpenLibrary: () => void;
  accentColor?: string;
};

/* -------------------------------------------------------------------------- */
/*                              Category metadata                             */
/* -------------------------------------------------------------------------- */

/**
 * Map an AI triage category to the matching first-aid library category id.
 * Lets us render the existing localized title + icon + accent for "Bleeding",
 * "Breathing issues", "Heart & chest", etc., without re-hardcoding strings.
 */
const TRIAGE_TO_LIBRARY_CATEGORY: Record<TriageCategory, string | null> = {
  cpr: "breathing",
  choking: "breathing",
  bleeding: "bleeding",
  burn: "burns",
  seizure: "seizures",
  chest_pain: "cardiac",
  breathing: "breathing",
  allergic: "allergic",
  fainting: null,
  other: null,
};

function getCategoryMeta(triageCategory: TriageCategory, lang: Lang): {
  label: string;
  icon: string;
  accent: string;
} {
  const libraryId = TRIAGE_TO_LIBRARY_CATEGORY[triageCategory];
  const cat = libraryId ? firstAidCategories.find((c) => c.id === libraryId) : undefined;
  if (cat) {
    return { label: pick(lang, cat.title), icon: cat.icon, accent: cat.accent };
  }
  // No matching library category (fainting / other) — neutral chip.
  return { label: triageCategory.replace(/_/g, " "), icon: "🩺", accent: "#475569" };
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function AiEmergencyCompanion({
  visible,
  onClose,
  context,
  lang,
  translate,
  onOpenGuide,
  onOpenLibrary,
  accentColor = tokens.color.aiBlue,
}: Props) {
  type Phase = "idle" | "loading" | "result" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [history, setHistory] = useState<EmergencyChatMessage[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorIsFatal, setErrorIsFatal] = useState(false);

  const resetSession = useCallback(() => {
    setPhase("idle");
    setHistory([]);
    setResult(null);
    setError(null);
    setErrorIsFatal(false);
  }, []);

  const friendlyErrorFor = useCallback(
    (err: unknown): { message: string; fatal: boolean } => {
      if (err instanceof OpenAiEmergencyError) {
        switch (err.code) {
          case "missing_key":
          case "invalid_key":
          case "insufficient_quota":
            return {
              message: translate(
                "aiTriageFallback",
                "AI is unavailable. Open the first-aid library instead.",
              ),
              fatal: true,
            };
          case "timeout":
            return {
              message: translate("aiTimeout", "AI took too long. Please try again."),
              fatal: false,
            };
          case "rate_limited":
            return {
              message: translate("aiBusy", "AI is busy. Please try again shortly."),
              fatal: false,
            };
          case "network":
            return {
              message: translate(
                "aiNetworkError",
                "Could not reach AI service. Check your connection.",
              ),
              fatal: false,
            };
          case "bad_json":
          case "empty":
          case "server":
          case "bad_request":
          default:
            return {
              message: translate(
                "aiTriageFallback",
                "AI is unavailable. Open the first-aid library instead.",
              ),
              fatal: true,
            };
        }
      }
      return {
        message: translate(
          "aiTriageFallback",
          "AI is unavailable. Open the first-aid library instead.",
        ),
        fatal: true,
      };
    },
    [translate],
  );

  const runTriage = useCallback(
    async (userTurn: string, nextHistory: EmergencyChatMessage[]) => {
      setPhase("loading");
      setError(null);
      setErrorIsFatal(false);
      try {
        const r = await analyzeEmergencyTriage(userTurn, nextHistory);
        // Append the model's reply (compact JSON-as-string) into history so the
        // model can converge across follow-up turns.
        const replyForHistory = JSON.stringify({
          category: r.category,
          urgency: r.urgency,
          askQuestion: r.askQuestion ?? "",
          nextAction: r.nextAction,
          suggestedGuideId: r.suggestedGuideId ?? "",
        });
        setHistory([
          ...nextHistory,
          { role: "user", content: userTurn },
          { role: "assistant", content: replyForHistory },
        ]);
        setResult(r);
        setPhase("result");
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.error("[AiTriage] error:", err);
        }
        const { message, fatal } = friendlyErrorFor(err);
        setError(message);
        setErrorIsFatal(fatal);
        setPhase("error");
      }
    },
    [friendlyErrorFor],
  );

  const handleStart = useCallback(() => {
    void runTriage(context, []);
  }, [context, runTriage]);

  const handleAnswer = useCallback(
    (answer: "yes" | "no" | "not_sure") => {
      if (!result?.askQuestion) return;
      const localized =
        answer === "yes"
          ? translate("aiTriageYes", "Yes")
          : answer === "no"
            ? translate("aiTriageNo", "No")
            : translate("aiTriageNotSure", "Not sure");
      const userTurn = `Q: ${result.askQuestion}\nA: ${localized}`;
      void runTriage(userTurn, history);
    },
    [history, result?.askQuestion, runTriage, translate],
  );

  const handleRefine = useCallback(() => {
    // Re-ask the AI for an updated decision with the current history.
    void runTriage(
      translate(
        "aiTriageRefinePrompt",
        "Re-evaluate based on what we know so far and produce an updated decision.",
      ),
      history,
    );
  }, [history, runTriage, translate]);

  const handleOpenGuide = useCallback(() => {
    if (result?.suggestedGuideId) {
      onClose();
      setTimeout(() => onOpenGuide(result.suggestedGuideId as string), 220);
    }
  }, [onClose, onOpenGuide, result?.suggestedGuideId]);

  const handleOpenLibrary = useCallback(() => {
    onClose();
    setTimeout(() => onOpenLibrary(), 220);
  }, [onClose, onOpenLibrary]);

  const handleShareSummary = useCallback(async () => {
    if (!result?.summary) return;
    try {
      await Share.share({
        message: result.summary,
        title: translate("aiTriageSummaryShareTitle", "Emergency summary"),
      });
    } catch {
      // ignore — Share.share rejects on user cancel.
    }
  }, [result?.summary, translate]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(resetSession, 250);
  }, [onClose, resetSession]);

  const categoryMeta = useMemo(
    () => (result ? getCategoryMeta(result.category, lang) : null),
    [result, lang],
  );

  const guidePreviewTitle = useMemo(() => {
    if (!result?.suggestedGuideId) return null;
    const g = getGuideById(result.suggestedGuideId);
    return g ? pick(lang, g.title) : null;
  }, [lang, result?.suggestedGuideId]);

  const confidenceLabel = useMemo(() => {
    if (!result) return "";
    switch (result.confidence) {
      case "high":
        return translate("aiTriageConfidenceHigh", "High confidence");
      case "low":
        return translate("aiTriageConfidenceLow", "Low confidence");
      case "medium":
      default:
        return translate("aiTriageConfidenceMedium", "Medium confidence");
    }
  }, [result, translate]);

  const aiListening = phase === "loading";
  const { row, text: dirText } = useUiDirection();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <GlassSurface radius={AI_RADIUS.sheet} style={styles.sheet}>
          <View style={styles.sheetInner}>
            <View style={[styles.header, row]}>
              <View style={[styles.headerLeft, row]}>
                <AiOrb size={44} active={phase !== "idle"} listening={aiListening} />
                <View style={styles.headerTitles}>
                  <Text style={styles.title} numberOfLines={1}>
                    {translate("aiTriageTitle", "AI Triage Assistant")}
                  </Text>
                  <View style={[styles.liveRow, row]}>
                    <View style={[styles.liveDot, phase !== "idle" && styles.liveDotOn]} />
                    <Text style={styles.liveText}>
                      {aiListening
                        ? translate("aiThinking", "Thinking…")
                        : "AI Emergency OS"}
                    </Text>
                    {aiListening ? <VoiceWaveform active compact /> : null}
                  </View>
                </View>
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closePressed]}
                accessibilityRole="button"
                accessibilityLabel={translate("aiClose", "Close")}
              >
                <Ionicons name="close" size={22} color={tokens.color.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>
              {translate(
                "aiTriageDisclaimer",
                "Helps route you to the right first-aid guide. Not a diagnosis.",
              )}
            </Text>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {phase === "idle" ? (
                <GlassSurface radius={AI_RADIUS.card} style={styles.introCard}>
                  <View style={styles.introInner}>
                    <AiOrb size={88} active listening={false} />
                    <Text style={[styles.intro, dirText]}>
                      {translate(
                        "aiTriageIntro",
                        "Tap Start. The assistant will ask short questions to choose the right guide and one next action.",
                      )}
                    </Text>
                  </View>
                </GlassSurface>
              ) : null}

              {phase === "loading" ? (
                <GlassSurface radius={AI_RADIUS.card} style={styles.loadingCard}>
                  <View style={styles.loadingBlock}>
                    <AiOrb size={72} active listening />
                    <VoiceWaveform active />
                    <Text style={styles.loadingText}>
                      {translate("aiThinking", "Thinking…")}
                    </Text>
                    <Text style={styles.loadingSub}>
                      {translate("aiTriageListening", "AI is analyzing your emergency context")}
                    </Text>
                  </View>
                </GlassSurface>
              ) : null}

              {phase === "result" && result && categoryMeta ? (
                <View style={styles.resultBlock}>
                  <GlassSurface radius={AI_RADIUS.card} style={styles.aiMsgCard}>
                    <View style={[styles.aiMsgRow, row]}>
                      <View style={styles.aiAvatar}>
                        <Ionicons name="sparkles" size={18} color={aiEmergencyTheme.primary} />
                      </View>
                      <View style={styles.aiMsgBody}>
                        <View
                          style={[
                            styles.categoryChip,
                            row,
                            { borderColor: categoryMeta.accent },
                          ]}
                        >
                          <Text style={styles.categoryIcon}>{categoryMeta.icon}</Text>
                          <Text style={[styles.categoryLabel, { color: categoryMeta.accent }]}>
                            {categoryMeta.label}
                          </Text>
                          <Text style={styles.confidenceTag}>· {confidenceLabel}</Text>
                        </View>
                      </View>
                    </View>
                  </GlassSurface>

                  <GlassSurface radius={AI_RADIUS.card} style={styles.actionCardCallout}>
                    <Text style={styles.actionKicker}>
                      {translate("aiTriageNextActionLabel", "Do this now")}
                    </Text>
                    <Text style={styles.actionText}>{result.nextAction}</Text>
                  </GlassSurface>

                  {result.askQuestion ? (
                    <GlassSurface radius={AI_RADIUS.card} style={styles.questionCard}>
                      <Text style={styles.questionLabel}>
                        {translate("aiTriageQuestionLabel", "Quick check")}
                      </Text>
                      <Text style={styles.questionText}>{result.askQuestion}</Text>
                      <View style={[styles.answerRow, row]}>
                        <TouchableOpacity
                          style={[styles.answerBtn, styles.answerYes]}
                          onPress={() => handleAnswer("yes")}
                        >
                          <Text style={styles.answerBtnText}>
                            {translate("aiTriageYes", "Yes")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.answerBtn, styles.answerNo]}
                          onPress={() => handleAnswer("no")}
                        >
                          <Text style={styles.answerBtnText}>
                            {translate("aiTriageNo", "No")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.answerBtn, styles.answerUnknown]}
                          onPress={() => handleAnswer("not_sure")}
                        >
                          <Text style={styles.answerBtnTextSecondary}>
                            {translate("aiTriageNotSure", "Not sure")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </GlassSurface>
                  ) : null}

                  {result.urgency === "call_now" ? (
                    <GlassSurface
                      radius={AI_RADIUS.card}
                      style={styles.assistanceOnWayCard}
                    >
                      <View
                        style={[styles.assistanceRow, row]}
                        accessibilityRole="alert"
                      >
                        <Text style={styles.assistanceOnWayIcon}>🚑</Text>
                        <Text style={styles.assistanceOnWayText}>
                          {translate(
                            "aiTriageAssistanceOnWay",
                            "Emergency services have already been notified and are on the way.",
                          )}
                        </Text>
                      </View>
                    </GlassSurface>
                  ) : null}

                  {result.suggestedGuideId && guidePreviewTitle ? (
                    <TouchableOpacity
                      style={[styles.guideBtn, { backgroundColor: accentColor }]}
                      onPress={handleOpenGuide}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.guideBtnKicker}>
                        {translate("aiTriageOpenGuide", "Open the recommended guide")}
                      </Text>
                      <Text style={styles.guideBtnTitle}>{guidePreviewTitle}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.guideBtn, styles.guideBtnMuted]}
                      onPress={handleOpenLibrary}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.guideBtnKicker}>
                        {translate(
                          "aiTriageOpenLibrary",
                          "Browse the first-aid library",
                        )}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {result.summary ? (
                    <GlassSurface radius={AI_RADIUS.card} style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>
                        {translate(
                          "aiTriageSummaryLabel",
                          "Summary for medical team",
                        )}
                      </Text>
                      <Text style={styles.summaryText}>{result.summary}</Text>
                      <TouchableOpacity
                        style={styles.summaryShareBtn}
                        onPress={handleShareSummary}
                      >
                        <Text style={styles.summaryShareBtnText}>
                          {translate("aiTriageShareSummary", "Share summary")}
                        </Text>
                      </TouchableOpacity>
                    </GlassSurface>
                  ) : null}
                </View>
              ) : null}

              {phase === "error" && error ? (
                <GlassSurface radius={AI_RADIUS.card} style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </GlassSurface>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              {phase === "idle" ? (
                <>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                    onPress={handleStart}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryBtnText}>
                      {translate("aiTriageStart", "Start triage")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleOpenLibrary}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {translate("aiTriageOpenLibrary", "Browse the first-aid library")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {phase === "result" ? (
                <>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                    onPress={handleRefine}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryBtnText}>
                      {translate("aiTriageRefine", "Refine answer")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
                    <Text style={styles.secondaryBtnText}>
                      {translate("aiDone", "Done")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {phase === "error" ? (
                <>
                  {errorIsFatal ? (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                      onPress={handleOpenLibrary}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.primaryBtnText}>
                        {translate(
                          "aiTriageOpenLibrary",
                          "Browse the first-aid library",
                        )}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                      onPress={handleStart}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.primaryBtnText}>
                        {translate("aiTriageRetry", "Try again")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
                    <Text style={styles.secondaryBtnText}>
                      {translate("aiDone", "Done")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {phase === "loading" ? (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { opacity: 0.6 }]}
                  disabled
                >
                  <Text style={styles.secondaryBtnText}>
                    {translate("aiThinking", "Thinking…")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    minHeight: 440,
    borderTopLeftRadius: AI_RADIUS.sheet,
    borderTopRightRadius: AI_RADIUS.sheet,
    overflow: "hidden",
  },
  sheetInner: {
    paddingTop: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.xl,
  },
  header: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tokens.space.sm,
    gap: tokens.space.md,
  },
  headerLeft: {
    alignItems: "center",
    gap: tokens.space.md,
    flex: 1,
  },
  headerTitles: { flex: 1 },
  title: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  liveRow: {
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.textFaint,
  },
  liveDotOn: { backgroundColor: aiEmergencyTheme.primary },
  liveText: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: aiEmergencyTheme.primary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
  },
  closePressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  disclaimer: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    marginBottom: tokens.space.md,
    lineHeight: 18,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: tokens.space.md, gap: tokens.space.md },
  introCard: { marginBottom: tokens.space.xs },
  introInner: {
    alignItems: "center",
    padding: tokens.space.xl,
    gap: tokens.space.md,
  },
  intro: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  loadingCard: {},
  loadingBlock: {
    alignItems: "center",
    gap: tokens.space.md,
    paddingVertical: tokens.space.xxl,
    paddingHorizontal: tokens.space.lg,
  },
  loadingText: {
    fontSize: tokens.font.label,
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.semibold,
  },
  loadingSub: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  resultBlock: { gap: tokens.space.md },
  aiMsgCard: {},
  aiMsgRow: {
    gap: tokens.space.md,
    padding: tokens.space.lg,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  aiMsgBody: { flex: 1 },
  categoryChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    borderRadius: AI_RADIUS.chip,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.6)",
    gap: 6,
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: { fontSize: 13, fontWeight: tokens.fontWeight.heavy },
  confidenceTag: {
    fontSize: 12,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.semibold,
  },
  actionCardCallout: { padding: tokens.space.lg },
  actionKicker: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    color: aiEmergencyTheme.primary,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  actionText: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 26,
  },
  questionCard: { padding: tokens.space.lg },
  questionLabel: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  questionText: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 22,
    marginBottom: tokens.space.md,
  },
  answerRow: { gap: tokens.space.sm },
  answerBtn: {
    flex: 1,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    alignItems: "center",
  },
  answerYes: { backgroundColor: tokens.color.success },
  answerNo: { backgroundColor: tokens.color.danger },
  answerUnknown: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  answerBtnText: {
    color: tokens.color.textOnPrimary,
    fontWeight: tokens.fontWeight.heavy,
    fontSize: tokens.font.bodyLg,
  },
  answerBtnTextSecondary: {
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.heavy,
    fontSize: tokens.font.bodyLg,
  },
  assistanceOnWayCard: {},
  assistanceRow: {
    alignItems: "center",
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  assistanceOnWayIcon: { fontSize: 24 },
  assistanceOnWayText: {
    flex: 1,
    color: tokens.color.dangerDark,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    lineHeight: 20,
  },
  guideBtn: {
    borderRadius: AI_RADIUS.card,
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    shadowColor: aiEmergencyTheme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  guideBtnMuted: { backgroundColor: tokens.color.slate },
  guideBtnKicker: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.92,
  },
  guideBtnTitle: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  summaryCard: { padding: tokens.space.lg },
  summaryLabel: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    lineHeight: 20,
    marginBottom: tokens.space.md,
  },
  summaryShareBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    borderRadius: AI_RADIUS.chip,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  summaryShareBtnText: {
    fontSize: tokens.font.caption,
    color: aiEmergencyTheme.primary,
    fontWeight: tokens.fontWeight.semibold,
  },
  errorCard: { padding: tokens.space.lg },
  errorText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.warningText,
    fontWeight: tokens.fontWeight.medium,
    lineHeight: 20,
  },
  footer: { marginTop: tokens.space.lg, gap: tokens.space.sm },
  primaryBtn: {
    borderRadius: AI_RADIUS.card,
    paddingVertical: tokens.space.lg,
    alignItems: "center",
  },
  primaryBtnText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  secondaryBtn: {
    borderRadius: AI_RADIUS.card,
    paddingVertical: tokens.space.md,
    alignItems: "center",
    backgroundColor: "rgba(241, 245, 249, 0.9)",
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  secondaryBtnText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
});
