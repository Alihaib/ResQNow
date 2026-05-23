import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import StatusChip from "../../../components/ui/StatusChip";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { caseIdSuffix } from "../../../src/utils/formatCaseId";
import { useUiDirection } from "../../../components/ui/layout";
import { tokens } from "../../../src/ui/tokens";

type EmergencyHistoryItem = {
  id: string;
  timestamp?: string;
  victimType?: string;
  status?: string;
  sessionStatus?: string;
  location?: { address?: string | null; latitude?: number; longitude?: number } | null;
};

function formatStatusLabel(status: string) {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusVariant(
  sessionStatus?: string,
): "info" | "success" | "danger" | "neutral" {
  switch (sessionStatus) {
    case "active":
      return "info";
    case "resolved":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export default function EmergencyHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { row, chevronForward } = useUiDirection();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EmergencyHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const ref = collection(db, "emergencies");
    const q = query(
      ref,
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: EmergencyHistoryItem[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            timestamp:
              typeof data.timestamp === "string" ? data.timestamp : undefined,
            victimType:
              typeof data.victimType === "string" ? data.victimType : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
            sessionStatus:
              typeof data.sessionStatus === "string"
                ? data.sessionStatus
                : undefined,
            location: (data.location ?? data.patientLocation ?? null) as EmergencyHistoryItem["location"],
          };
        });
        setItems(next);
        setLoading(false);
      },
      (err) => {
        console.warn("Emergency history listener error:", err);
        const code = (err as { code?: string })?.code;
        if (code === "failed-precondition") {
          setLoadError(
            "This query requires a Firestore index. Please create the composite index for emergencies (userId + timestamp desc).",
          );
        } else {
          setLoadError("Failed to load emergency history.");
        }
        setItems([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.uid]);

  const historyItems = useMemo(() => {
    return items.map((item) => {
      const dt = item.timestamp ? new Date(item.timestamp) : null;
      const date =
        dt && !Number.isNaN(dt.getTime())
          ? dt.toISOString().slice(0, 10)
          : "—";
      const time =
        dt && !Number.isNaN(dt.getTime())
          ? dt.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—";

      const type =
        item.victimType === "me"
          ? t("sosForMe")
          : item.victimType === "other"
            ? t("sosForOther")
            : t("emergency");

      const statusText = item.sessionStatus || item.status || t("unknownUser");
      const address = item.location?.address ?? null;
      const coords =
        typeof item.location?.latitude === "number" &&
        typeof item.location?.longitude === "number"
          ? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`
          : null;

      return {
        ...item,
        date,
        time,
        type,
        statusText,
        locationText: address || coords || null,
      };
    });
  }, [items, t]);

  return (
    <SubScreenShell
      title={t("emergencyHistory")}
      fallbackRoute="/(tabs)/profile"
      onBack={() => router.replace("/(tabs)/profile")}
    >
      {loading ? (
        <EmptyState loading tone="primary" title={t("loadingEmergencies")} />
      ) : historyItems.length > 0 ? (
        historyItems.map((item) => (
          <Card key={item.id} style={styles.historyCard}>
            <Text style={styles.historyCaseId} numberOfLines={1}>
              {t("activityEmergencyRef", "Case {id}").replace(
                "{id}",
                caseIdSuffix(item.id),
              )}
            </Text>
            <View style={[styles.historyHeader, row]}>
              <Text style={styles.historyType}>{item.type}</Text>
              <StatusChip
                label={formatStatusLabel(item.statusText)}
                variant={statusVariant(item.sessionStatus)}
                size="sm"
              />
            </View>
            <Text style={styles.historyDate}>
              {item.date} at {item.time}
            </Text>
            {!!item.locationText ? (
              <Text style={styles.historyLocation}>{item.locationText}</Text>
            ) : null}
            <Text style={styles.chevron}>{chevronForward}</Text>
          </Card>
        ))
      ) : (
        <>
          <EmptyState
            ionIcon="time-outline"
            title={t("noEmergencyHistory")}
            subtitle={t("emergencyHistorySubtext")}
          />
          {!!loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : null}
        </>
      )}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    marginBottom: tokens.space.sm,
  },
  historyHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.sm,
    gap: tokens.space.sm,
  },
  historyType: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    flex: 1,
  },
  historyCaseId: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textMuted,
    letterSpacing: 0.4,
    marginBottom: tokens.space.xs,
  },
  historyDate: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
  },
  historyLocation: {
    marginTop: tokens.space.xs,
    fontSize: tokens.font.caption,
    color: tokens.color.textSecondary,
  },
  chevron: {
    position: "absolute",
    end: tokens.space.lg,
    top: tokens.space.lg,
    fontSize: tokens.font.h3,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.semibold,
  },
  errorText: {
    marginTop: tokens.space.md,
    fontSize: tokens.font.caption,
    color: tokens.color.danger,
    textAlign: "center",
    fontWeight: tokens.fontWeight.semibold,
  },
});
