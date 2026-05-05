import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { firstAidCategories } from "../../../../src/firstAid/categories";
import { getGuideById } from "../../../../src/firstAid/guides";
import { pick, type Lang } from "../../../../src/firstAid/types";
import { useLanguage } from "../../../../src/context/LanguageContext";

function speechLocale(lang: Lang) {
  return lang === "he" ? "he-IL" : "en-US";
}

function AnimatedGuideStep({
  index,
  activeIndex,
  accent,
  text,
}: {
  index: number;
  activeIndex: number;
  accent: string;
  text: string;
}) {
  const opacity = useSharedValue(index === activeIndex ? 1 : 0.4);
  const scale = useSharedValue(index === activeIndex ? 1 : 0.95);

  useEffect(() => {
    const on = index === activeIndex;
    opacity.value = withTiming(on ? 1 : 0.4, { duration: 220, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(on ? 1 : 0.95, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, index, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const active = index === activeIndex;

  return (
    <Animated.View
      style={[
        styles.stepCard,
        anim,
        active && styles.stepCardActive,
        active && { borderColor: accent },
      ]}
    >
      <View style={[styles.stepNum, { backgroundColor: active ? accent : "#94A3B8" }]}>
        <Text style={styles.stepNumText}>{index + 1}</Text>
      </View>
      <Text style={[styles.stepText, !active && styles.stepTextDim]}>{text}</Text>
    </Animated.View>
  );
}

export default function FirstAidGuideDetailScreen() {
  const { guideId } = useLocalSearchParams<{ guideId: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const id = typeof guideId === "string" ? guideId : "";
  const guide = getGuideById(id);
  const category = guide ? firstAidCategories.find((c) => c.id === guide.category) : undefined;
  const accent = category?.accent ?? "#D62828";

  const stepCount = guide?.steps.length ?? 0;
  const hasWarnings = (guide?.warnings.length ?? 0) > 0;
  const lastPageIndex = useMemo(() => {
    if (!guide) return 0;
    return hasWarnings ? guide.steps.length : Math.max(0, guide.steps.length - 1);
  }, [guide, hasWarnings]);

  const [pageIndex, setPageIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const stepLayouts = useRef<Record<number, number>>({});

  useEffect(() => {
    setPageIndex(0);
  }, [id]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const isWarningPage = !!guide && hasWarnings && pageIndex === guide.steps.length;

  const speakText = useCallback(
    (text: string) => {
      if (Platform.OS === "web") return;
      Speech.stop();
      Speech.speak(text, {
        language: speechLocale(lang),
        rate: 0.9,
      });
    },
    [lang],
  );

  const currentStepText = useMemo(() => {
    if (!guide || isWarningPage) return "";
    return pick(lang, guide.steps[pageIndex]);
  }, [guide, isWarningPage, lang, pageIndex]);

  const warningSpeechText = useMemo(() => {
    if (!guide || !isWarningPage) return "";
    return guide.warnings.map((w) => pick(lang, w)).join(". ");
  }, [guide, isWarningPage, lang]);

  useEffect(() => {
    if (!autoPlay || !guide || Platform.OS === "web") return;
    if (isWarningPage) {
      Speech.stop();
      Speech.speak(warningSpeechText, { language: speechLocale(lang), rate: 0.9 });
    } else {
      speakText(currentStepText);
    }
  }, [autoPlay, currentStepText, guide, isWarningPage, lang, pageIndex, speakText, warningSpeechText]);

  useEffect(() => {
    if (!autoPlay && Platform.OS !== "web") Speech.stop();
  }, [autoPlay]);

  useEffect(() => {
    const y = stepLayouts.current[pageIndex];
    if (y != null && scrollRef.current && !isWarningPage) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  }, [pageIndex, isWarningPage]);

  const warnOpacity = useSharedValue(1);
  const warnScale = useSharedValue(1);
  useEffect(() => {
    if (!isWarningPage) return;
    warnOpacity.value = 0;
    warnScale.value = 0.97;
    warnOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    warnScale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [isWarningPage, pageIndex, warnOpacity, warnScale]);

  const warnAnim = useAnimatedStyle(() => ({
    opacity: warnOpacity.value,
    transform: [{ scale: warnScale.value }],
  }));

  const progressLabel = useMemo(() => {
    if (!guide) return "";
    if (isWarningPage) {
      return t("firstAidWarningsReview", "Important warnings");
    }
    return t("firstAidStepProgress", "Step {current} of {total}")
      .replace("{current}", String(pageIndex + 1))
      .replace("{total}", String(stepCount));
  }, [guide, isWarningPage, pageIndex, stepCount, t]);

  const canBack = pageIndex > 0;
  const canNext = guide ? pageIndex < lastPageIndex : false;
  const isLastPage = guide ? pageIndex >= lastPageIndex : false;

  const speechSupported = Platform.OS !== "web";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: accent }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Speech.stop();
            router.canGoBack()
              ? router.back()
              : router.replace(`/(tabs)/firstaid/category/${guide?.category ?? "bleeding"}`);
          }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {guide ? pick(lang, guide.title) : t("firstAidTitle")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!guide ? (
        <View style={styles.missing}>
          <Text style={styles.missingText}>{t("firstAidGuideMissing", "Guide not found.")}</Text>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/firstaid")}>
            <Text style={styles.link}>{t("goBack")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.progressMuted}>{progressLabel}</Text>

          {speechSupported ? (
            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={[styles.voiceBtn, { borderColor: accent }]}
                onPress={() => {
                  if (isWarningPage) speakText(warningSpeechText);
                  else speakText(currentStepText);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.voiceBtnText, { color: accent }]}>{t("firstAidVoicePlay", "🔊 Play")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.voiceBtn}
                onPress={() => Speech.stop()}
                activeOpacity={0.85}
              >
                <Text style={styles.voiceBtnText}>{t("firstAidVoiceStop", "⏹ Stop")}</Text>
              </TouchableOpacity>
              <View style={styles.autoWrap}>
                <Text style={styles.autoLabel}>{t("firstAidVoiceAuto", "🔁 Auto")}</Text>
                <Switch value={autoPlay} onValueChange={setAutoPlay} trackColor={{ true: accent }} />
              </View>
            </View>
          ) : null}

          {isWarningPage ? (
            <Animated.View style={[styles.warnPageCard, warnAnim]}>
              <Text style={[styles.kicker, styles.warnKicker]}>{t("firstAidDoNot", "Do not")}</Text>
              <View style={styles.warnBox}>
                {guide.warnings.map((w, i) => (
                  <Text key={i} style={styles.warnLine}>
                    • {pick(lang, w)}
                  </Text>
                ))}
              </View>
            </Animated.View>
          ) : (
            <>
              <Text style={styles.kicker}>{t("firstAidDoThis", "Do this")}</Text>
              {guide.steps.map((step, i) => (
                <View
                  key={i}
                  onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    stepLayouts.current[i] = y + height * 0.15;
                  }}
                >
                  <AnimatedGuideStep
                    index={i}
                    activeIndex={pageIndex}
                    accent={accent}
                    text={pick(lang, step)}
                  />
                </View>
              ))}
            </>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnGhost, !canBack && styles.navBtnDisabled]}
              disabled={!canBack}
              onPress={() => canBack && setPageIndex((p) => p - 1)}
              activeOpacity={0.85}
            >
              <Text style={[styles.navBtnTextGhost, !canBack && styles.navBtnTextDisabled]}>
                {t("firstAidBack", "Back")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.navBtn,
                styles.navBtnPrimary,
                { backgroundColor: accent },
                !canNext && styles.navBtnDisabled,
              ]}
              disabled={!canNext}
              onPress={() => canNext && setPageIndex((p) => p + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.navBtnTextPrimary}>{t("firstAidNext", "Next")}</Text>
            </TouchableOpacity>
          </View>

          {isLastPage ? (
            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>{t("generalGuidelines")}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { width: 40 },
  backText: { fontSize: 32, color: "#fff", fontWeight: "800" },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: "900", color: "#fff", textAlign: "center" },
  headerSpacer: { width: 40 },
  scroll: { padding: 18, paddingBottom: 40 },
  progressMuted: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 12,
    textAlign: "center",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 10,
  },
  voiceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  voiceBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#334155",
  },
  autoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  autoLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },
  kicker: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  warnKicker: { marginBottom: 10 },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  stepCardActive: {
    backgroundColor: "#F8FAFC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  stepText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 26,
  },
  stepTextDim: {
    color: "#64748B",
    fontWeight: "600",
  },
  warnPageCard: {
    marginBottom: 8,
    alignSelf: "stretch",
  },
  warnBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  warnLine: {
    fontSize: 17,
    fontWeight: "700",
    color: "#991B1B",
    lineHeight: 25,
    marginBottom: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnGhost: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  navBtnPrimary: {},
  navBtnDisabled: {
    opacity: 0.45,
  },
  navBtnTextGhost: {
    fontSize: 17,
    fontWeight: "800",
    color: "#334155",
  },
  navBtnTextPrimary: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  navBtnTextDisabled: {
    color: "#94A3B8",
  },
  footerNote: {
    marginTop: 24,
    padding: 14,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  footerNoteText: { fontSize: 13, color: "#92400E", fontWeight: "600", lineHeight: 19 },
  missing: { padding: 24, alignItems: "center" },
  missingText: { fontSize: 16, color: "#64748B", marginBottom: 12 },
  link: { fontSize: 16, color: "#2563EB", fontWeight: "800" },
});
