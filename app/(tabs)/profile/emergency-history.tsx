import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { useAuth } from "../../../src/context/AuthContext";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../src/firebase/config";

type EmergencyHistoryItem = {
  id: string;
  timestamp?: string;
  victimType?: string;
  status?: string;
  sessionStatus?: string;
  location?: { address?: string | null; latitude?: number; longitude?: number } | null;
};

export default function EmergencyHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
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
    // NOTE:
    // This query (where userId == X + orderBy timestamp desc) may require a Firestore composite index:
    //   Collection: emergencies
    //   Fields: userId (ASC), timestamp (DESC)
    // If you see "FirebaseError: The query requires an index", create the index using the link in the error.
    const q = query(ref, where("userId", "==", user.uid), orderBy("timestamp", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: EmergencyHistoryItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
            victimType: typeof data.victimType === "string" ? data.victimType : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
            sessionStatus: typeof data.sessionStatus === "string" ? data.sessionStatus : undefined,
            location: (data.location ?? data.patientLocation ?? null) as any,
          };
        });
        setItems(next);
        setLoading(false);
      },
      (err) => {
        // Avoid console.error here because it triggers a full-screen redbox in RN dev.
        console.warn("Emergency history listener error:", err);
        const code = (err as any)?.code as string | undefined;
        if (code === "failed-precondition") {
          setLoadError("This query requires a Firestore index. Please create the composite index for emergencies (userId + timestamp desc).");
        } else {
          setLoadError("Failed to load emergency history.");
        }
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const historyItems = useMemo(() => {
    return items.map((item) => {
      const dt = item.timestamp ? new Date(item.timestamp) : null;
      const date = dt && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : "—";
      const time =
        dt && !Number.isNaN(dt.getTime())
          ? dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
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
        typeof item.location?.latitude === "number" && typeof item.location?.longitude === "number"
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // Always return to Profile tab from Profile sub-screens
            router.replace("/(tabs)/profile");
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("emergencyHistory")}</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={styles.emptyText}>{t("loadingEmergencies")}</Text>
        </View>
      ) : historyItems.length > 0 ? (
        historyItems.map((item) => {
          const badgeStyle = getStatusBadgeStyle(item.sessionStatus);
          const textStyle = getStatusTextStyle(item.sessionStatus);

          return (
            <TouchableOpacity key={item.id} style={styles.historyCard} activeOpacity={0.85}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyType}>{item.type}</Text>
                <View style={[styles.statusBadge, badgeStyle]}>
                  <Text style={[styles.statusText, textStyle]} numberOfLines={1}>
                    {formatStatusLabel(item.statusText)}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyDate}>
                {item.date} at {item.time}
              </Text>
              {!!item.locationText && <Text style={styles.historyLocation}>{item.locationText}</Text>}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>{t("noEmergencyHistory")}</Text>
          <Text style={styles.emptySubtext}>{t("emergencyHistorySubtext")}</Text>
          {!!loadError && <Text style={styles.errorText}>{loadError}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

function formatStatusLabel(status: string) {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getStatusBadgeStyle(sessionStatus?: string) {
  switch (sessionStatus) {
    case "active":
      return { backgroundColor: "#DBEAFE" };
    case "resolved":
      return { backgroundColor: "#D1FAE5" };
    case "cancelled":
      return { backgroundColor: "#FEF2F2" };
    default:
      return { backgroundColor: "#F1F5F9" };
  }
}

function getStatusTextStyle(sessionStatus?: string) {
  switch (sessionStatus) {
    case "active":
      return { color: "#1D4ED8" };
    case "resolved":
      return { color: "#166534" };
    case "cancelled":
      return { color: "#B91C1C" };
    default:
      return { color: "#334155" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: "#003049",
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyType: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
  },
  statusBadge: {
    backgroundColor: "#D1FAE5",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2D6A4F",
  },
  historyDate: {
    fontSize: 14,
    color: "#6C757D",
  },
  historyLocation: {
    marginTop: 6,
    fontSize: 13,
    color: "#6C757D",
  },
  chevron: {
    position: "absolute",
    right: 20,
    top: 20,
    fontSize: 24,
    color: "#6C757D",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6C757D",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#ADB5BD",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
    fontWeight: "600",
  },
});





