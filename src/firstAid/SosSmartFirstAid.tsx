import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { resolveSmartCase, type Lang, type QuickSituation } from "./smartInstructions";

type TFn = (key: string, fallback?: string) => string;

type Props = {
  lang: Lang;
  translate: TFn;
  crewEtaMinutes: number | null;
  ambulanceStatusText: string | null;
  isAmbulanceArrived: boolean;
  victimType: "me" | "other";
  onScrollToFirstAidSection?: () => void;
};

function CprRhythmModal({
  visible,
  onClose,
  translate,
  lang,
}: {
  visible: boolean;
  onClose: () => void;
  translate: TFn;
  lang: Lang;
}) {
  const [compressionCount, setCompressionCount] = useState(1);
  const [phase, setPhase] = useState<"compress" | "breath">("compress");
  const [breathIndex, setBreathIndex] = useState(1);
  const timers = useRef<{
    interval?: ReturnType<typeof setInterval>;
    timeouts: ReturnType<typeof setTimeout>[];
  }>({ timeouts: [] });

  const clearTimers = () => {
    if (timers.current.interval) {
      clearInterval(timers.current.interval);
      timers.current.interval = undefined;
    }
    timers.current.timeouts.forEach(clearTimeout);
    timers.current.timeouts = [];
  };

  useEffect(() => {
    if (!visible) {
      clearTimers();
      setCompressionCount(1);
      setPhase("compress");
      setBreathIndex(1);
      return;
    }

    const scheduleBreaths = () => {
      setPhase("breath");
      setBreathIndex(1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const t1 = setTimeout(() => {
        setBreathIndex(2);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2800);
      timers.current.timeouts.push(t1);
      const t2 = setTimeout(() => {
        setPhase("compress");
        let n = 1;
        setCompressionCount(1);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        timers.current.interval = setInterval(() => {
          if (n >= 30) {
            if (timers.current.interval) clearInterval(timers.current.interval);
            timers.current.interval = undefined;
            scheduleBreaths();
            return;
          }
          n += 1;
          setCompressionCount(n);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 500);
      }, 5600);
      timers.current.timeouts.push(t2);
    };

    let n = 1;
    setCompressionCount(1);
    setPhase("compress");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    timers.current.interval = setInterval(() => {
      if (n >= 30) {
        if (timers.current.interval) clearInterval(timers.current.interval);
        timers.current.interval = undefined;
        scheduleBreaths();
        return;
      }
      n += 1;
      setCompressionCount(n);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 500);

    return () => clearTimers();
  }, [visible]);

  const compressLabel = translate("sosCprCompressLabel", "Compressions");
  const breathLabel = translate("sosCprBreathLabel", "Breaths");
  const hint = translate("sosCprBeatHint", "~100–120/min · follow training if you have it");

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.cprModalRoot}>
        <Text style={styles.cprModalTitle}>{translate("sosCprTitle", "CPR rhythm helper")}</Text>
        <Text style={styles.cprModalHint}>{hint}</Text>

        {phase === "compress" ? (
          <>
            <Text style={styles.cprPhaseLabel}>{compressLabel}</Text>
            <Text style={styles.cprBigNumber}>{compressionCount}</Text>
            <Text style={styles.cprSubNumber}>/ 30</Text>
          </>
        ) : (
          <>
            <Text style={styles.cprPhaseLabel}>{breathLabel}</Text>
            <Text style={styles.cprBigNumber}>{breathIndex}</Text>
            <Text style={styles.cprSubNumber}>/ 2</Text>
          </>
        )}

        <Pressable style={styles.cprStopBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cprStopBtnText}>{translate("sosCprStop", "Stop CPR mode")}</Text>
        </Pressable>
        <Text style={styles.cprLangNote}>
          {lang === "he" ? "המשיכו עד שהצוות מחליף" : "Continue until responders take over"}
        </Text>
      </View>
    </Modal>
  );
}

export function SosSmartFirstAid({
  lang,
  translate,
  crewEtaMinutes,
  ambulanceStatusText,
  isAmbulanceArrived,
}: Props) {
  const router = useRouter();

  // No user inputs: keep smartCase computation active internally.
  const smartCase = useMemo(
    () =>
      resolveSmartCase({
        conscious: true,
        breathing: true,
        bleeding: false,
        situation: "none" as QuickSituation,
      }),
  );

  const [cprModalVisible, setCprModalVisible] = useState(false);
  useEffect(() => {
    if (smartCase !== "not_breathing") setCprModalVisible(false);
  }, [smartCase]);

  return (
    <View style={styles.card}>
      <CprRhythmModal
        visible={cprModalVisible}
        onClose={() => setCprModalVisible(false)}
        translate={translate}
        lang={lang}
      />

      {(crewEtaMinutes != null || ambulanceStatusText?.trim() || isAmbulanceArrived) ? (
        <View style={styles.statusStrip}>
          {isAmbulanceArrived ? (
            <Text style={styles.statusPrimary}>{translate("ambulanceArrivedShort", "Ambulance arrived")}</Text>
          ) : crewEtaMinutes != null ? (
            <Text style={styles.statusPrimary}>
              {translate("sosCrewEta", "Crew ETA · ~{minutes} min (estimate)").replace("{minutes}", String(crewEtaMinutes))}
            </Text>
          ) : (
            <Text style={styles.statusMuted}>{translate("sosEtaPending", "ETA: updating…")}</Text>
          )}
          {ambulanceStatusText?.trim() ? (
            <Text style={styles.statusSecondary} numberOfLines={2}>
              {translate("sosCrewStatus", "Crew status")}: {ambulanceStatusText.trim()}
            </Text>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.libraryBtn}
        onPress={() => router.push(`/(tabs)/firstaid?openMode=sos&smartCase=${smartCase}`)}
        activeOpacity={0.9}
      >
        <Text style={styles.libraryBtnText}>{translate("sosFirstAidGuideBtn", "📚 First Aid Guide")}</Text>
      </TouchableOpacity>

      {smartCase === "not_breathing" ? (
        <TouchableOpacity
          style={styles.cprBtn}
          onPress={() => setCprModalVisible(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.cprBtnText}>{translate("sosCprStart", "Start CPR mode")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#B91C1C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statusStrip: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 12,
  },
  statusPrimary: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  statusMuted: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  statusSecondary: { marginTop: 6, fontSize: 14, fontWeight: "700", color: "#334155", lineHeight: 20 },
  libraryBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  libraryBtnText: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  cprBtn: {
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cprBtnText: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  cprModalRoot: {
    flex: 1,
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cprModalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 8,
  },
  cprModalHint: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  cprPhaseLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#38BDF8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  cprBigNumber: {
    fontSize: 120,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 128,
  },
  cprSubNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 40,
  },
  cprStopBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 220,
    alignItems: "center",
  },
  cprStopBtnText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#B91C1C",
  },
  cprLangNote: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
  },
});
