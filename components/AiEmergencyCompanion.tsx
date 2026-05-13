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

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  accentColor = "#DC2626",
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { borderTopColor: accentColor }]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {translate("aiTriageTitle", "AI Triage Assistant")}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={translate("aiClose", "Close")}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
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
          >
            {phase === "idle" ? (
              <View>
                <Text style={styles.intro}>
                  {translate(
                    "aiTriageIntro",
                    "Tap Start. The assistant will ask short questions to choose the right guide and one next action.",
                  )}
                </Text>
              </View>
            ) : null}

            {phase === "loading" ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={accentColor} />
                <Text style={styles.loadingText}>
                  {translate("aiThinking", "Thinking…")}
                </Text>
              </View>
            ) : null}

            {phase === "result" && result && categoryMeta ? (
              <View style={styles.resultBlock}>
                {/* Category chip */}
                <View
                  style={[
                    styles.categoryChip,
                    { borderColor: categoryMeta.accent },
                  ]}
                >
                  <Text style={styles.categoryIcon}>{categoryMeta.icon}</Text>
                  <Text style={[styles.categoryLabel, { color: categoryMeta.accent }]}>
                    {categoryMeta.label}
                  </Text>
                  <Text style={styles.confidenceTag}>· {confidenceLabel}</Text>
                </View>

                {/* Next action */}
                <View style={[styles.actionCardCallout, { borderColor: accentColor }]}>
                  <Text style={styles.actionKicker}>
                    {translate("aiTriageNextActionLabel", "Do this now")}
                  </Text>
                  <Text style={styles.actionText}>{result.nextAction}</Text>
                </View>

                {/* Optional follow-up question */}
                {result.askQuestion ? (
                  <View style={styles.questionCard}>
                    <Text style={styles.questionLabel}>
                      {translate("aiTriageQuestionLabel", "Quick check")}
                    </Text>
                    <Text style={styles.questionText}>{result.askQuestion}</Text>
                    <View style={styles.answerRow}>
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
                  </View>
                ) : null}

                {/*
                  Reassurance card — shown when the AI flags urgency = call_now.
                  The SOS flow has already dispatched the ambulance, so the
                  triage modal never exposes any phone-call action. We only
                  reassure the user that help is already on its way.
                */}
                {result.urgency === "call_now" ? (
                  <View
                    style={styles.assistanceOnWayCard}
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
                ) : null}

                {/* Suggested guide */}
                {result.suggestedGuideId && guidePreviewTitle ? (
                  <TouchableOpacity
                    style={[styles.guideBtn, { backgroundColor: accentColor }]}
                    onPress={handleOpenGuide}
                  >
                    <Text style={styles.guideBtnKicker}>
                      {translate("aiTriageOpenGuide", "Open the recommended guide")}
                    </Text>
                    <Text style={styles.guideBtnTitle}>{guidePreviewTitle}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.guideBtn, { backgroundColor: "#475569" }]}
                    onPress={handleOpenLibrary}
                  >
                    <Text style={styles.guideBtnKicker}>
                      {translate(
                        "aiTriageOpenLibrary",
                        "Browse the first-aid library",
                      )}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Summary for medical team */}
                {result.summary ? (
                  <View style={styles.summaryCard}>
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
                  </View>
                ) : null}
              </View>
            ) : null}

            {phase === "error" && error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {phase === "idle" ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                  onPress={handleStart}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "90%",
    minHeight: 420,
    borderTopWidth: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: "900", color: "#003049", flex: 1 },
  closeBtn: {
    fontSize: 22,
    color: "#6C757D",
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  disclaimer: { fontSize: 12, color: "#6C757D", marginBottom: 12 },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 12, gap: 12 },
  intro: { fontSize: 15, color: "#212529", lineHeight: 22 },
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
    justifyContent: "center",
  },
  loadingText: { fontSize: 15, color: "#6C757D", fontWeight: "600" },

  resultBlock: { gap: 12 },

  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: { fontSize: 13, fontWeight: "900" },
  confidenceTag: { fontSize: 12, color: "#475569", fontWeight: "700" },

  actionCardCallout: {
    backgroundColor: "#FFF7F7",
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
  },
  actionKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#DC2626",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  actionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    lineHeight: 26,
  },

  questionCard: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 22,
    marginBottom: 12,
  },
  answerRow: { flexDirection: "row", gap: 8 },
  answerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  answerYes: { backgroundColor: "#16A34A" },
  answerNo: { backgroundColor: "#DC2626" },
  answerUnknown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  answerBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  answerBtnTextSecondary: { color: "#0F172A", fontWeight: "900", fontSize: 14 },

  assistanceOnWayCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    gap: 12,
  },
  assistanceOnWayIcon: { fontSize: 24 },
  assistanceOnWayText: {
    flex: 1,
    color: "#7F1D1D",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },

  guideBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  guideBtnKicker: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.9,
  },
  guideBtnTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 14,
    color: "#212529",
    lineHeight: 20,
    marginBottom: 10,
  },
  summaryShareBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  summaryShareBtnText: { fontSize: 12, color: "#0F172A", fontWeight: "800" },

  errorCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 14,
  },
  errorText: { fontSize: 14, color: "#92400E", fontWeight: "600", lineHeight: 20 },

  footer: { marginTop: 16, gap: 10 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F1F3F5",
  },
  secondaryBtnText: { color: "#495057", fontSize: 15, fontWeight: "700" },
});
