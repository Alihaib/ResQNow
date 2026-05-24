import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../../../components/ui/Button";
import EmptyState from "../../../../components/ui/EmptyState";
import ScreenHeader from "../../../../components/ui/ScreenHeader";
import {
  FirstAidGuideCalmStrip,
  FirstAidGuideNavBar,
  FirstAidGuideProgressHeader,
  FirstAidGuideVoiceStrip,
  FirstAidStepFocusCard,
  computeGuideLayoutMetrics,
  firstAidTheme,
} from "../../../../components/first-aid";
import { useUiDirection } from "../../../../components/ui/layout";
import { useLanguage } from "../../../../src/context/LanguageContext";
import { firstAidCategories } from "../../../../src/firstAid/categories";
import { getGuideById } from "../../../../src/firstAid/guides";
import { pick, type Lang } from "../../../../src/firstAid/types";
import { pageStyles, tokens } from "../../../../src/ui/tokens";

function speechLocale(lang: Lang) {
  return lang === "he" ? "he-IL" : "en-US";
}

function parseStepDisplay(
  text: string,
  stepNumber: number,
  stepNowLabel: string,
): { headline: string; body: string; showHeadline: boolean } {
  const trimmed = text.trim();
  const split = trimmed.match(/^(.+?[.!?؟])\s+([\s\S]+)$/);
  if (split && split[2].length > 8 && split[1].length <= 88) {
    return {
      headline: split[1].trim(),
      body: split[2].trim(),
      showHeadline: true,
    };
  }
  return {
    headline: `${stepNowLabel} ${stepNumber}`,
    body: trimmed,
    showHeadline: false,
  };
}

export default function FirstAidGuideDetailScreen() {
  const { guideId } = useLocalSearchParams<{ guideId: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { directionVersion } = useUiDirection();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const id = typeof guideId === "string" ? guideId : "";
  const guide = getGuideById(id);
  const category = guide ? firstAidCategories.find((c) => c.id === guide.category) : undefined;

  const stepCount = guide?.steps.length ?? 0;
  const hasWarnings = (guide?.warnings.length ?? 0) > 0;
  const lastPageIndex = useMemo(() => {
    if (!guide) return 0;
    return hasWarnings ? guide.steps.length : Math.max(0, guide.steps.length - 1);
  }, [guide, hasWarnings]);

  const [pageIndex, setPageIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const speechSupported = Platform.OS !== "web";

  const layout = useMemo(
    () =>
      computeGuideLayoutMetrics(
        windowHeight,
        insets.top,
        insets.bottom,
        speechSupported,
      ),
    [windowHeight, insets.top, insets.bottom, speechSupported, directionVersion],
  );

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

  const warningBodyText = useMemo(() => {
    if (!guide || !isWarningPage) return "";
    return guide.warnings.map((w) => `• ${pick(lang, w)}`).join("\n\n");
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

  const totalProgressSteps = hasWarnings ? stepCount + 1 : stepCount;
  const progressIndex = isWarningPage ? stepCount : pageIndex;

  const stepIndicatorLabel = useMemo(() => {
    if (!guide) return "";
    if (isWarningPage) {
      return t("firstAidWarningsReview", "Important warnings");
    }
    return t("firstAidStepProgress", "Step {current} of {total}")
      .replace("{current}", String(pageIndex + 1))
      .replace("{total}", String(stepCount));
  }, [guide, isWarningPage, pageIndex, stepCount, t]);

  const focusContent = useMemo(() => {
    if (!guide) {
      return {
        headline: "",
        body: "",
        showHeadline: false,
        variant: "instruction" as const,
      };
    }
    if (isWarningPage) {
      return {
        headline: t("firstAidDoNot", "Do not"),
        body: warningBodyText,
        showHeadline: false,
        variant: "warning" as const,
      };
    }
    const parsed = parseStepDisplay(
      currentStepText,
      pageIndex + 1,
      t("firstAidStepNow", "Step"),
    );
    return { ...parsed, variant: "instruction" as const };
  }, [guide, isWarningPage, currentStepText, pageIndex, warningBodyText, t]);

  const canBack = pageIndex > 0;
  const canNext = guide ? pageIndex < lastPageIndex : false;

  const goBack = () => {
    Speech.stop();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(tabs)/firstaid/category/${guide?.category ?? "bleeding"}`);
    }
  };

  if (!guide) {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title={t("firstAidTitle")}
          onBack={goBack}
          fallbackRoute="/(tabs)/firstaid"
        />
        <View style={styles.missingBody}>
          <EmptyState
            ionIcon="alert-circle-outline"
            title={t("firstAidGuideMissing", "Guide not found.")}
          />
          <PrimaryButton
            label={t("goBack")}
            onPress={() => router.replace("/(tabs)/firstaid")}
            style={styles.missingBtn}
          />
        </View>
      </View>
    );
  }

  const categoryName = category ? pick(lang, category.title) : t("firstAidTitle");

  return (
    <View style={styles.screen}>
      <FirstAidGuideProgressHeader
        categoryName={categoryName}
        stepLabel={stepIndicatorLabel}
        currentIndex={progressIndex}
        totalSteps={totalProgressSteps}
        onBack={goBack}
      />

      <View style={styles.body}>
        <View style={styles.instructionZone}>
          <FirstAidStepFocusCard
            stepLabel={t("firstAidCurrentStepLabel", "Current step")}
            headline={focusContent.headline}
            body={focusContent.body}
            showHeadline={focusContent.showHeadline}
            variant={focusContent.variant}
            maxCardHeight={layout.instructionMaxHeight}
            typography={layout.typography}
          />
        </View>

        <View style={styles.footer}>
          {layout.showCalmLine ? (
            <FirstAidGuideCalmStrip
              message={t("firstAidStayCalm", "Stay calm — follow each step carefully")}
              lang={lang}
            />
          ) : null}
          {speechSupported ? (
            <FirstAidGuideVoiceStrip
              compact={layout.voiceCompact}
              playLabel={t("firstAidVoicePlay", "Play")}
              stopLabel={t("firstAidVoiceStop", "Stop")}
              autoLabel={t("firstAidVoiceAuto", "Auto")}
              onPlay={() => {
                if (isWarningPage) speakText(warningSpeechText);
                else speakText(currentStepText);
              }}
              onStop={() => Speech.stop()}
              autoPlay={autoPlay}
              onAutoPlayChange={setAutoPlay}
              lang={lang}
            />
          ) : null}
        </View>
      </View>

      <FirstAidGuideNavBar
        canBack={canBack}
        canNext={canNext}
        onBack={() => canBack && setPageIndex((p) => p - 1)}
        onNext={() => canNext && setPageIndex((p) => p + 1)}
        backLabel={t("firstAidBack", "Back")}
        nextLabel={t("firstAidNextStep", "Next Step")}
        lang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...pageStyles.screen,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.sm,
    justifyContent: "space-between",
  },
  instructionZone: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    paddingVertical: tokens.space.lg,
  },
  footer: {
    flexShrink: 0,
    gap: tokens.space.sm,
    paddingTop: tokens.space.sm,
  },
  missingBody: {
    flex: 1,
    paddingHorizontal: tokens.space.lg,
    justifyContent: "center",
  },
  missingBtn: {
    marginTop: tokens.space.lg,
  },
});
