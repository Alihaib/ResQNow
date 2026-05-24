import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppPageHeader from "../../components/ui/AppPageHeader";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import SectionHeader from "../../components/ui/SectionHeader";
import ShortcutCard from "../../components/ui/ShortcutCard";
import SosHeroButton from "../../components/ui/SosHeroButton";
import StatusChip from "../../components/ui/StatusChip";
import { useAuth } from "../../src/context/AuthContext";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import type {
  ActivityFeedGroup,
  ActivityFeedItem,
} from "../../src/hooks/useEmergencyActivityFeed";
import { useEmergencyActivityFeed } from "../../src/hooks/useEmergencyActivityFeed";
import { useUiDirection } from "../../components/ui/layout";
import { pageStyles, tokens } from "../../src/ui/tokens";
import { caseIdSuffix } from "../../src/utils/formatCaseId";

type ChipVariant = "danger" | "warning" | "success" | "info" | "neutral";

function chipVariantForEvent(eventType: string): ChipVariant {
  switch (eventType) {
    case "cancelled":
    case "dispatch_exhausted":
      return "danger";
    case "arrived":
    case "completed":
      return "success";
    case "enRoute":
    case "dispatched":
      return "info";
    case "rejected":
    case "ambulance_released":
      return "warning";
    default:
      return "neutral";
  }
}

export default function HomeTab() {
  const { user, role, approved } = useAuth();
  const { isEmergencyActive, navigateToActiveEmergency } = useEmergency();
  const { t, lang } = useLanguage();
  const { row } = useUiDirection();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groups, loading, error } = useEmergencyActivityFeed(
    user?.uid,
    role,
    approved,
    20,
  );

  /**
   * Local expand/collapse state keyed by `emergencyId`. We deliberately don't
   * derive this from the feed itself — collapsing is a UI concern only and
   * must survive realtime snapshot updates (the listener can fire many times
   * a second when a case is moving through its lifecycle).
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = useCallback((emergencyId: string) => {
    setExpanded((prev) => ({ ...prev, [emergencyId]: !prev[emergencyId] }));
  }, []);

  const formatActivityTime = (iso: string) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(lang === "he" ? "he-IL" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activityLabel = (eventType: string) => {
    const key = `activityEvent_${eventType}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const human = eventType.replace(/_/g, " ");
    return t("activityEvent_unknown", human);
  };

  const renderTimelineEvent = (item: ActivityFeedItem, index: number) => (
    <View
      key={item.id}
      style={[
        styles.eventRow,
        index !== 0 && styles.eventRowDivider,
      ]}
    >
      <View style={[styles.eventTopRow, row]}>
        <StatusChip
          label={activityLabel(item.eventType)}
          variant={chipVariantForEvent(item.eventType)}
          size="sm"
        />
        <Text style={styles.eventTime}>{formatActivityTime(item.timestampIso)}</Text>
      </View>
      {item.noteText ? (
        <Text style={styles.eventNote} numberOfLines={3}>
          {item.noteText}
        </Text>
      ) : null}
    </View>
  );

  const renderGroup = (group: ActivityFeedGroup) => {
    const isExpanded = !!expanded[group.emergencyId];
    const latest = group.events[0];
    const eventCount = group.events.length;
    return (
      <Card key={group.emergencyId} style={styles.groupCard}>
        <TouchableOpacity
          onPress={() => toggleExpanded(group.emergencyId)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={t("activityEmergencyRef", "Case {id}").replace(
            "{id}",
            caseIdSuffix(group.emergencyId),
          )}
          style={styles.groupHeader}
        >
          <View style={[styles.groupHeaderTop, row]}>
            <StatusChip
              label={activityLabel(latest.eventType)}
              variant={chipVariantForEvent(latest.eventType)}
              size="sm"
            />
            <Text style={styles.groupTime}>
              {formatActivityTime(latest.timestampIso)}
            </Text>
          </View>
          <View style={[styles.groupHeaderBottom, row]}>
            <Text style={styles.groupCaseId} selectable numberOfLines={1}>
              {t("activityEmergencyRef", "Case {id}").replace(
                "{id}",
                caseIdSuffix(group.emergencyId),
              )}
            </Text>
            <View style={[styles.groupHeaderRight, row]}>
              <Text style={styles.groupEventCount}>
                {t("activityEventCount", "{n} events").replace(
                  "{n}",
                  String(eventCount),
                )}
              </Text>
              <Text
                style={styles.groupChevron}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {isExpanded ? "▾" : "▸"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && eventCount > 0 ? (
          <View style={styles.groupBody}>
            {group.events.map(renderTimelineEvent)}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <AppPageHeader title="ResQNow" subtitle={t("home_subtitle")} />

      {isEmergencyActive ? (
        <Card tone="danger" style={styles.statusStrip}>
          <Text style={styles.statusTitle}>{t("emergencyActiveTitle")}</Text>
          <Text style={styles.statusSubtitle}>
            {t("continueActiveEmergencyHint")}
          </Text>
        </Card>
      ) : null}

      <View style={styles.hero}>
        <SosHeroButton
          size="large"
          label={isEmergencyActive ? t("emergencyActiveShort") : t("sos")}
          sublabel={
            isEmergencyActive
              ? t("tapToViewActiveEmergency")
              : t("tapForHelp")
          }
          activeEmergency={isEmergencyActive}
          onPress={() =>
            isEmergencyActive
              ? navigateToActiveEmergency()
              : router.push("/(tabs)/emergency")
          }
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t("quickActions")} />
        <View style={[styles.quickGrid, row]}>
          <View style={styles.quickCell}>
            <ShortcutCard
              ionIcon="medkit-outline"
              title={t("firstAid")}
              onPress={() => router.push("/(tabs)/firstaid")}
              style={styles.quickCard}
            />
          </View>
          <View style={styles.quickCell}>
            <ShortcutCard
              ionIcon="document-text-outline"
              title={t("medicalProfile")}
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.quickCard}
            />
          </View>
        </View>
      </View>

      {role === "doctor" && approved ? (
        <View style={styles.section}>
          <ShortcutCard
            ionIcon="pulse-outline"
            title={t("doctor_dashboard")}
            subtitle={t("manageCases")}
            emphasis="accent"
            onPress={() => router.push("/doctor/dashboard")}
          />
        </View>
      ) : null}

      {role === "ambulance" && approved ? (
        <View style={styles.section}>
          <ShortcutCard
            ionIcon="car-outline"
            title={t("ambulance_dashboard")}
            subtitle={t("viewLiveCalls")}
            emphasis="accent"
            onPress={() => router.push("/ambulance/dashboard")}
          />
        </View>
      ) : null}

      {role === "admin" ? (
        <View style={styles.section}>
          <ShortcutCard
            ionIcon="shield-outline"
            title={t("admin_panel")}
            subtitle={t("manageUsers")}
            emphasis="accent"
            onPress={() => router.push("/admin/panel")}
          />
        </View>
      ) : null}

      {/* Recent Activity — grouped per emergency, expandable. Live via onSnapshot. */}
      <View style={styles.section}>
        <SectionHeader
          overline={t("activityFeedOverline", "Live")}
          title={t("recentActivity")}
          accent={tokens.color.info}
        />
        {loading ? (
          <EmptyState loading title={t("activityLoading", "Loading activity…")} />
        ) : error ? (
          <EmptyState
            ionIcon="alert-circle-outline"
            title={t("activityLoadError", "Could not load activity.")}
            subtitle={
              error === "firestore_index"
                ? t(
                    "firestoreIndexError",
                    "Activity feed is temporarily unavailable. Please try again.",
                  )
                : t("activitySubtext")
            }
            tone="danger"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            ionIcon="time-outline"
            title={t("noRecentActivity")}
            subtitle={t("activitySubtext")}
          />
        ) : (
          <View style={styles.activityList}>{groups.map(renderGroup)}</View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    ...pageStyles.content,
  },
  statusStrip: {
    marginHorizontal: tokens.space.lg,
    marginBottom: tokens.space.md,
  },
  statusTitle: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.danger,
    marginBottom: tokens.space.xs,
  },
  statusSubtitle: {
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
  },
  hero: {
    alignItems: "center",
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
  },
  section: {
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.xl,
  },
  quickGrid: {
    gap: tokens.space.sm,
  },
  quickCell: { flex: 1 },
  quickCard: { marginBottom: 0 },
  // ---- Recent Activity (per-emergency group) ---------------------------
  activityList: {
    gap: tokens.space.sm,
  },
  groupCard: {
    marginBottom: 0,
  },
  groupHeader: {
    gap: tokens.space.sm,
  },
  groupHeaderTop: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  groupHeaderBottom: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  groupHeaderRight: {
    alignItems: "center",
    gap: tokens.space.sm,
    flexShrink: 0,
  },
  groupTime: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
    flexShrink: 0,
  },
  groupCaseId: {
    flexShrink: 1,
    fontSize: tokens.font.body,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    fontFamily: "monospace",
  },
  groupEventCount: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  groupChevron: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textFaint,
    fontWeight: "800",
    minWidth: 14,
    textAlign: "center",
  },
  groupBody: {
    marginTop: tokens.space.md,
    paddingTop: tokens.space.md,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  eventRow: {
    paddingVertical: tokens.space.sm,
  },
  eventRowDivider: {
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  eventTopRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  eventTime: {
    fontSize: tokens.font.caption,
    fontWeight: "700",
    color: tokens.color.textMuted,
    flexShrink: 0,
  },
  eventNote: {
    marginTop: tokens.space.xs,
    fontSize: tokens.font.body,
    color: tokens.color.textSecondary,
    fontWeight: "600",
  },
});
